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
 *   2. the strip is keyed to THIS package's capability, not the headless
 *      package's. What throws and what draws is the mirror union declared here;
 *      the two packages are joined by a peer-dependency RANGE, so a host can
 *      legitimately resolve different versions of them, and keying the strip on
 *      the other package's schema is wrong in both directions — an element this
 *      build can render gets stripped, or one it cannot survives and throws;
 *   3. the screen boundary supplies its own escape when the strip leaves nothing
 *      that can advance the step;
 *   4. the schema's element types, the renderer's dispatch, and the headless
 *      schema's types are the SAME set in a single checkout. That is a
 *      release-time invariant (`check-versions.mjs` ships the two packages in
 *      lockstep) rather than something the strip now depends on — reading both
 *      files off disk here structurally cannot see an installed-version skew,
 *      which is precisely why (2) exists.
 */

const UI_SRC = join(__dirname, "../../..");
const HEADLESS_SRC = join(__dirname, "../../../../../onboarding/src");
const HEADLESS_SCREEN_TYPES = join(HEADLESS_SRC, "screens/types.ts");

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
    // what produced it — via `resolveRenderableStep`, which owns the whole
    // decision (what to parse, what to log, whether an escape is needed) in the
    // headless package, where it is unit-testable against real payloads.
    expect(boundary!.argument.trim()).not.toBe("step");
    const source = stripComments(readFileSync(join(UI_SRC, boundary!.file), "utf8"));
    expect(source).toContain("resolveRenderableStep(");
    expect(source).toMatch(new RegExp(`step:\\s*${boundary!.argument.trim()}\\b`));
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

describe("the strip is keyed to what this package can draw", () => {
  const rendererSource = stripComments(
    readFileSync(join(UI_SRC, "UI/Pages/ComposableScreen/Renderer.tsx"), "utf8")
  );

  it("passes this package's own capability set to the strip", () => {
    // Not the headless default. `dropUnknownElementTypes`'s no-argument form
    // resolves "known" from the headless schema, but what parses and renders is
    // the mirror union in UI/Runtime/types.ts — and `package.json` declares the
    // headless package a PEER dep by range, so a host can resolve headless
    // 1.74 against UI 1.80. Keyed the wrong way, an element this build can
    // render gets stripped (with a warning that falsely claims it is unknown),
    // or one it cannot render survives and throws the whole screen anyway.
    const call = rendererSource.indexOf("resolveRenderableStep(");
    expect(call).toBeGreaterThan(-1);
    const argument = callArgument(
      rendererSource,
      call + "resolveRenderableStep".length
    );
    expect(argument).toContain("getRenderableElementTypes()");
  });

  it("derives that set from this package's own element union", () => {
    const source = stripComments(
      readFileSync(join(UI_SRC, "UI/Runtime/renderableElementTypes.ts"), "utf8")
    );
    // The mirror union, imported from this package…
    expect(source).toMatch(/import\s*\{[^}]*UIElementSchema[^}]*\}\s*from\s*"\.\/types"/);
    // …and NOT the headless package's answer about its own schema.
    expect(source).not.toMatch(/KNOWN_ELEMENT_TYPES|getKnownElementTypes/);
  });
});

describe("the screen boundary keeps a way out after a strip", () => {
  const rendererSource = stripComments(
    readFileSync(join(UI_SRC, "UI/Pages/ComposableScreen/Renderer.tsx"), "utf8")
  );

  it("supplies OnboardingTemplate's own CTA when nothing left can advance the step", () => {
    // A ComposableScreen authors its CTA INSIDE the element tree, and this
    // renderer passes no `button` to `OnboardingTemplate` — so if the strip took
    // the element that happened to be the screen's root container, `[]` parses
    // cleanly and the user is left on a blank screen with no continue control
    // and (on a header-off step) no back chevron. The escape follows the two
    // boundaries that already answer this: an unknown STEP type renders a
    // Continue button, and a paywall that cannot parse calls `onContinue()` "so
    // the user is not trapped".
    expect(rendererSource).toMatch(/needsEscape/);
    expect(rendererSource).toMatch(/button=\{/);
  });

  it("takes that decision from resolveRenderableStep rather than re-deriving it here", () => {
    // Where it can be tested. `resolveRenderableStep` returns `needsEscape`
    // false whenever nothing was stripped — an authored screen with no CTA is an
    // authoring bug and must not acquire an SDK-injected button — and that rule
    // is only assertable in the headless package's tests.
    expect(rendererSource).not.toMatch(/hasCompletingAction/);
  });
});

describe("the two packages agree on which elements ignore a generic onPress", () => {
  const setLiteral = (source: string): string[] => {
    // The first `([ … ])` after the name: `new Set<UIElement["type"]>([…])`
    // puts a bracket in the type argument, so anchor on the call parenthesis.
    const match = source.match(/PRESS_HANDLED_TYPES[\s\S]*?\(\[([\s\S]*?)\]\)/);
    return [...(match?.[1] ?? "").matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]).sort();
  };

  it("lists the same types in renderElement and in the completing-action walk", () => {
    // `hasCompletingAction` must not count an `onPress: ["continue"]` that
    // `renderElement` never wires — that would read as "the user can leave" on a
    // screen whose only surviving control does nothing, and the escape would not
    // appear. The list cannot be imported across the package boundary, so it is
    // duplicated and held equal here.
    const ui = setLiteral(
      stripComments(readFileSync(join(UI_SRC, "UI/Runtime/elements/renderElement.tsx"), "utf8"))
    );
    const headless = setLiteral(
      stripComments(readFileSync(join(HEADLESS_SRC, "screens/completingActions.ts"), "utf8"))
    );
    expect(ui.length).toBeGreaterThan(5);
    expect(headless).toEqual(ui);
  });
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
