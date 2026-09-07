import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Compiled deep import: this package's vitest runs in plain Node, and pulling
// the headless index would drag in `react-native` (Flow-typed, unparseable
// here). Same precedent as `Runtime/__tests__/repeatRowGating.test.ts`.
import { PICKER_TYPES } from "@rocapine/react-native-onboarding/dist/steps/Picker/pickerVariants";
// Pure-zod mirror, safe to import directly.
import { PickerTypeEnum } from "../types";

/**
 * The UI half of #210: a schema without a renderer is not a feature.
 *
 * `PickerTypeEnum` declared seven types and `Renderer.tsx` dispatched on four,
 * so `age`, `gender` and `coach` rendered the literal string
 * `Picker type "<x>" not yet implemented` on a device — the same class of silent
 * mismatch as `Loader variant:"texts_fading"` drawing bars. TypeScript cannot
 * catch it: the enum is re-declared in this package, and the dispatch is a chain
 * of `if` statements the compiler has no reason to consider exhaustive.
 *
 * These are SOURCE-level assertions for the dispatch and the diagnostic, because
 * there is no rendering harness in this package. The behaviour they guard —
 * which types resolve, which option lists exist, what value each hands back — is
 * covered against the real implementation in
 * `packages/onboarding/src/__tests__/pickerVariants.test.ts`.
 */

const PICKER_DIR = join(__dirname, "..");

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const rendererSource = stripComments(readFileSync(join(PICKER_DIR, "Renderer.tsx"), "utf8"));

describe("the UI mirror declares exactly what the headless schema declares", () => {
  it("lists the same picker types", () => {
    // Drift runs both ways and neither direction is type-checked: a type only in
    // the mirror renders but fails the headless parse of the payload; a type only
    // in the headless schema validates and then hits the placeholder.
    expect(PickerTypeEnum.options).toEqual([...PICKER_TYPES]);
  });

  it("no longer carries `coach`", () => {
    expect(PickerTypeEnum.options).not.toContain("coach");
  });
});

describe("the renderer draws every type the schema declares", () => {
  const dispatched = [
    ...new Set([...rendererSource.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1])),
  ].sort();

  it("dispatches on each declared picker type and nothing else", () => {
    // The assertion the original defect would have failed: `age` and `gender`
    // were in the enum with no branch. It also fails in the other direction — a
    // branch for a type the schema does not declare is dead code.
    expect(dispatched).toEqual([...PICKER_TYPES].sort());
  });

  it("routes through the shared resolver rather than re-deriving the list here", () => {
    // A second hand-written list in this file is exactly how the first drift
    // happened. `resolvePickerType` owns the known/unknown decision.
    expect(rendererSource).toContain("resolvePickerType(");
  });

  it("dispatches with an exhaustive switch, so tsc catches the next added type", () => {
    // The stronger half of this guard: `PickerType` is derived from
    // `PICKER_TYPES`, so a seventh type makes the switch non-exhaustive and the
    // `never` assignment stops compiling. The if-chain this replaced could never
    // fail that way — which is why the drift lived long enough to ship.
    expect(rendererSource).toMatch(/switch \(resolvedPickerType\)/);
    expect(rendererSource).toMatch(/:\s*never\b/);
  });
});

describe("the unsupported-type path is loud", () => {
  it("logs the shared diagnostic, naming the type and the supported set", () => {
    // Pruning `coach` from the enum changes nothing at runtime: `pickerType` is
    // `z.union([PickerTypeEnum, z.string()])`, so `"gendre"` still validates and
    // still lands here. Without a log, the only signal is placeholder text a
    // tester has to notice.
    expect(rendererSource).toContain("formatUnsupportedPickerType(");
    expect(rendererSource).toMatch(/console\.(warn|error)\(/);
  });

  it("keeps the placeholder rather than throwing", () => {
    // `PickerStepTypeSchema.parse(step)` runs inside this renderer and
    // `withErrorBoundary` wraps it, so a throw here costs the whole screen for an
    // already-published payload. #209/#223 set the direction: degrade visibly,
    // do not blank.
    expect(rendererSource).toContain("not yet implemented");
  });
});

describe("the value contracts each variant hands back", () => {
  it("formats an age through the shared helper, not an inline template", () => {
    // "25-years", matching "70-kg" / "170-cm". An inline
    // `onContinue(`${age}-years`)` here would be untestable and free to drift
    // from the documented contract.
    expect(rendererSource).toContain("formatAgeValue(");
  });

  it("hands back the gender option's value, never its display label", () => {
    expect(rendererSource).toContain("GENDER_OPTIONS");
    expect(rendererSource).not.toMatch(/onContinue\([^)]*\.label/);
  });
});
