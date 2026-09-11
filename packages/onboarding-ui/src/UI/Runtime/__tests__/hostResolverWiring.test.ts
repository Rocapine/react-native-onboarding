import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every `ScreenHost` builder must thread `requestPermission` (#196, review
 * round 1, findings 3 and 6).
 *
 * `ScreenRenderer` has THREE callers, each building its own `ScreenHost`, and
 * the first version of this action set the resolver on only one of them. The
 * result was that the same authored payload took a different branch depending
 * on which surface rendered it: a consumer who passed `requestPermission` to
 * `OnboardingPage` got their resolver for a `ComposableScreen` step and the
 * bundled one for a byte-identical action inside a `Paywall` step in the same
 * flow — so on a build with none of the optional Expo modules the second one
 * resolved `"unavailable"` and the user was recorded as refusing a permission
 * they were never asked for. No error anywhere; both surfaces "worked".
 *
 * TypeScript cannot catch it: the field is optional on `ScreenHost` (it must
 * be — a host with nothing special to add leaves it unset), so omitting it type
 * checks. `OnboardingPage`'s `_ConsumerHostFieldsAreReachable` gate is the
 * mirror of this check one level up (is the field reachable from the documented
 * entry point at all?) and equally cannot see this: it proves the prop exists,
 * not that every host builder forwards it.
 *
 * Source-level, like `unknownElementTypes.test.ts`, because these are React
 * components and this suite runs in plain Node with no renderer.
 */

const SRC = join(__dirname, "../../..");

/** Every file that builds a `ScreenHost` to hand to `ScreenRenderer`. */
const HOST_BUILDERS = [
  "UI/Pages/ComposableScreen/Renderer.tsx",
  "UI/Pages/Paywall/Renderer.tsx",
  "UI/Paywall/PaywallHost.tsx",
] as const;

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/**
 * Every non-test source file under `src/UI` that renders `<ScreenRenderer>`,
 * found by WALKING THE TREE.
 *
 * Review round 2, finding 3: this used to be `HOST_BUILDERS.filter(f =>
 * read(f).includes("<ScreenRenderer"))`, which filters the hardcoded list by a
 * property every member of it already has — so it asserted that the three known
 * files still contain the tag and could never see a fourth. Verified by adding
 * a `UI/Pages/ZZFake/Renderer.tsx` with an unwired host: all four tests in this
 * file passed. They do not now.
 *
 * `__tests__` is excluded because this file's own source contains the literal.
 */
const findScreenRendererCallers = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (readFileSync(full, "utf8").includes("<ScreenRenderer"))
        out.push(relative(SRC, full));
    }
  };
  walk(join(SRC, "UI"));
  return out.sort();
};

/** The object literal passed to `useMemo` for `const host: ScreenHost = …`. */
const hostLiteral = (source: string): string => {
  const start = source.indexOf("const host: ScreenHost");
  expect(start, "no `const host: ScreenHost` in this file").toBeGreaterThan(-1);
  // Up to the end of the useMemo dependency array — enough to cover both the
  // literal and its deps, which is where a stale-identity bug would show.
  const end = source.indexOf("\n  );", start);
  return source.slice(start, end === -1 ? source.length : end);
};

describe("ScreenHost builders — requestPermission wiring", () => {
  it("covers every host builder in the package", () => {
    // A fourth `ScreenRenderer` caller must be added to HOST_BUILDERS above, or
    // it silently opts out of the resolver. This is the whole point of the file:
    // the list below is not the source of truth, the tree is.
    expect(findScreenRendererCallers()).toEqual([...HOST_BUILDERS].sort());
  });

  it("sets requestPermission on the host it builds", () => {
    for (const file of HOST_BUILDERS) {
      expect(hostLiteral(read(file)), `${file} builds a ScreenHost without requestPermission`).toMatch(
        /requestPermission/
      );
    }
  });

  it("lets a consumer supply the resolver on every entry point", () => {
    // The three documented entry points, one per host builder: an onboarding
    // step, a paywall step in flow position, and a `present()`-ed paywall.
    expect(read("UI/OnboardingPage.tsx")).toMatch(/requestPermission\?: PermissionResolver/);
    expect(read("UI/Pages/Paywall/Renderer.tsx")).toMatch(/requestPermission\?: PermissionResolver/);
    expect(read("UI/Paywall/PaywallHost.tsx")).toMatch(/requestPermission\?: PermissionResolver/);
  });

  it("forwards it from OnboardingPage to the Paywall step renderer", () => {
    // The finding's exact scenario: the consumer DID pass a resolver, and a
    // `Paywall` step reached through the same `OnboardingPage` did not get it.
    const source = read("UI/OnboardingPage.tsx");
    const tag = source.slice(source.indexOf("<PaywallStepRenderer"));
    expect(tag.slice(0, tag.indexOf("/>"))).toMatch(/requestPermission=\{requestPermission\}/);
  });
});
