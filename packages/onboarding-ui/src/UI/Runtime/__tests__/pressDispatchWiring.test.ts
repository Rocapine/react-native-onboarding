import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every press dispatch goes through `runGuardedActions`, never `runActions`
 * (#191, review round 1, findings 2, 3 and 8).
 *
 * Two holes this closes, both invisible to TypeScript and to every behavioural
 * test in this suite:
 *
 * 1. **Nothing asserted that `Button` routes through the guard.** The guard
 *    tests call `runGuardedActions` directly with a hand-built ctx, and
 *    `inFlight.test.ts` tests the registry in isolation — so reverting
 *    `ButtonElement`'s one call site back to `runActions` left all 382 tests
 *    green while `actions.pending` was never published and a second tap ran the
 *    handler again. `runActions` is still exported (the recursion needs it), so
 *    the revert type checks too.
 * 2. **The generic `onPress` was not wired at all.** `onPress` is schema-valid
 *    on every element through `BaseBoxProps`, and the published docs promise the
 *    pending keys and the dropped second press for the `custom` action
 *    generally. CLAUDE.md's own rule — a cross-element behaviour prop is wired
 *    once centrally in `renderElement.tsx`, never per element — says the same.
 *
 * Source-level, like `hostResolverWiring.test.ts` and
 * `unknownElementTypes.test.ts`: these are React components and this suite runs
 * in plain Node with no renderer.
 */

const SRC = join(__dirname, "../../..");
const DISPATCHER = "UI/Runtime/elements/runActions.ts";

/** Comments stripped, so a doc comment naming `runActions(...)` is not a hit. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const sourceFiles = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(relative(SRC, full));
      }
    }
  };
  walk(join(SRC, "UI"));
  return out;
};

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("press dispatch is guarded (#191)", () => {
  it("finds the runtime sources to scan", () => {
    expect(sourceFiles().length).toBeGreaterThan(20);
    expect(statSync(join(SRC, DISPATCHER)).isFile()).toBe(true);
  });

  it("no renderer calls runActions directly — only runGuardedActions", () => {
    const callers = sourceFiles().filter(
      (f) => f !== DISPATCHER && /(?<![A-Za-z])runActions\s*\(/.test(stripComments(read(f)))
    );
    expect(callers).toEqual([]);
  });

  it("Button dispatches its press through the guard, keyed by its own id", () => {
    expect(stripComments(read("UI/Runtime/elements/ButtonElement.tsx"))).toMatch(
      /runGuardedActions\(\s*element\.id\s*,/
    );
  });

  it("the generic onPress dispatches through the guard, keyed by the element id", () => {
    expect(stripComments(read("UI/Runtime/elements/renderElement.tsx"))).toMatch(
      /runGuardedActions\(\s*element\.id\s*,/
    );
  });
});
