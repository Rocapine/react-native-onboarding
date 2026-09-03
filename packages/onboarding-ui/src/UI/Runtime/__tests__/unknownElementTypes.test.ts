import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The UI half of forward compatibility for element TYPES (#209).
 *
 * These are SOURCE-level assertions on purpose. There is no rendering harness in
 * this package (vitest runs in plain Node — `react-native` is Flow-typed and
 * cannot be imported here, and neither can the UI element schemas, which pull in
 * every renderer), so the behaviour of the strip itself is covered by
 * `packages/onboarding/src/__tests__/unknownElementTypes.test.ts` against the
 * shared, RN-free implementation. What can only be checked HERE is the wiring:
 *
 *   1. every element-tree parse boundary in this package strips first — the
 *      whole defect was one boundary that did not, and a new boundary added
 *      later would silently reintroduce it;
 *   2. the schema's element types, the renderer's dispatch, and the headless
 *      schema's types are the SAME set. This is the drift TypeScript cannot
 *      catch (the UI re-declares its own Zod schemas), and for a strip keyed on
 *      "known types" the drift is no longer cosmetic: a type the headless
 *      schema does not declare is a type this app would now silently omit
 *      instead of rendering.
 */

const UI_SRC = join(__dirname, "../../..");
const HEADLESS_SCREEN_TYPES = join(
  __dirname,
  "../../../../../onboarding/src/screens/types.ts"
);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });

/** Comments carry example call sites; only real code counts. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The full argument text of a call, paren-balanced, so multi-line calls work. */
const callArgument = (source: string, openParenIndex: number): string => {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex);
};

const typesFrom = (source: string): string[] =>
  [...source.matchAll(/type:\s*z\.literal\("([A-Za-z]+)"\)/g)].map((m) => m[1]).sort();

describe("every element-tree parse boundary strips unknown element types", () => {
  const boundaries = sourceFiles(UI_SRC).flatMap((file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    return [
      ...source.matchAll(/(ScreenElementsSchema|ComposableScreenStepTypeSchema)\.(safeParse|parse)\(/g),
    ].map((match) => ({
      file: relative(UI_SRC, file),
      call: `${match[1]}.${match[2]}`,
      argument: callArgument(source, match.index! + match[0].length - 1),
    }));
  });

  it("has exactly these boundaries — a new one must choose its degradation contract", () => {
    // Not a vacuous grep: adding a fourth place that parses an element tree
    // fails here, which is the point. Deciding what an unknown element type
    // should do there is the author's call, and it has to be a decision.
    expect(boundaries.map((b) => `${b.file}: ${b.call}`).sort()).toEqual([
      "UI/Pages/ComposableScreen/Renderer.tsx: ComposableScreenStepTypeSchema.parse",
      "UI/Pages/Paywall/Renderer.tsx: ScreenElementsSchema.safeParse",
      "UI/Paywall/PaywallHost.tsx: ScreenElementsSchema.safeParse",
    ]);
  });

  it("strips at the onboarding screen boundary, where a parse error dead-ends the user", () => {
    const boundary = boundaries.find((b) => b.file.includes("ComposableScreen"));
    expect(boundary).toBeDefined();
    // The parsed value must not be the raw `step` prop, and the strip must be
    // what produced it (the call may be bound to a local first).
    expect(boundary!.argument.trim()).not.toBe("step");
    const source = readFileSync(join(UI_SRC, boundary!.file), "utf8");
    expect(source).toMatch(
      new RegExp(`(const|let)\\s+${boundary!.argument.trim()}\\s*=\\s*dropUnknownElementTypesInStep\\(`)
    );
  });

  it.each(boundaries.filter((b) => b.file.includes("Paywall")).map((b) => [b.file, b] as const))(
    "%s stays strict: refusing to open is already the safe degradation there",
    (_file, boundary) => {
      // A paywall that fails to parse never opens — `PaywallHost` resolves
      // `{status:"error", reason:"parse-error"}` and logs the exact path, so
      // nobody is trapped. Omitting elements instead would open a
      // `presentationStyle="fullScreen"`, `transparent={false}` Modal with
      // holes in it — and if the omitted element is the purchase or dismiss
      // control, iOS leaves no way out but force-quit. That is the trap
      // `resolvePaywallModalDecision` was written to close; stripping here
      // would reopen it. Strict is deliberate, not an oversight.
      expect(boundary.argument).not.toMatch(/dropUnknownElementTypes/);
    }
  );
});

describe("schema and renderer know the same element types", () => {
  const uiSchemaTypes = typesFrom(readFileSync(join(UI_SRC, "UI/Runtime/types.ts"), "utf8"));
  const headlessSchemaTypes = typesFrom(readFileSync(HEADLESS_SCREEN_TYPES, "utf8"));
  const dispatchedTypes = [
    ...stripComments(
      readFileSync(join(UI_SRC, "UI/Runtime/elements/renderElement.tsx"), "utf8")
    ).matchAll(/element\.type === "([A-Za-z]+)"/g),
  ]
    .map((m) => m[1])
    .sort();

  it("reads a plausible set of types from each source", () => {
    expect(uiSchemaTypes.length).toBeGreaterThan(20);
  });

  it("declares in the UI mirror exactly what the headless schema declares", () => {
    expect(uiSchemaTypes).toEqual(headlessSchemaTypes);
  });

  it("renders exactly what the UI schema declares — a schema without a renderer is not a feature", () => {
    expect(dispatchedTypes).toEqual(uiSchemaTypes);
  });

  it("keeps renderElement's terminal `return null` as the second line of defence", () => {
    // Elements reaching the renderer unparsed (a host passing raw elements) must
    // still degrade to nothing rendered rather than a crash.
    const source = readFileSync(join(UI_SRC, "UI/Runtime/elements/renderElement.tsx"), "utf8");
    expect(source).toMatch(/return null;\s*\n?\s*\}\)\(\);/);
  });
});
