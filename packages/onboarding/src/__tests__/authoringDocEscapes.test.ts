import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { actionsCanComplete, hasCompletingAction } from "../screens/completingActions";

// The authoring surfaces are prose, so nothing type-checks the payloads they
// teach against the runtime that reads them — and a `custom` CTA is exactly
// where that costs something. Reads the docs off disk, the same technique as
// `unknownElementTypes.test.ts` and `actionSchemaMirror.test.ts` (review round
// 2 of !263, finding 4).

const ROOT = join(__dirname, "../../../..");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

/** The fenced code block that contains `marker`, parsed as JSON. */
const jsonBlockAround = (src: string, rel: string, marker: string): unknown => {
  const at = src.indexOf(marker);
  expect(at, `${rel} no longer mentions ${marker}`).toBeGreaterThan(-1);
  const fence = src.lastIndexOf("```", at);
  const body = src.indexOf("\n", fence) + 1;
  return JSON.parse(src.slice(body, src.indexOf("```", body)));
};

/** The inline `` `actions: [...]` `` span that contains `marker`, parsed as JSON. */
const inlineActionsAround = (src: string, rel: string, marker: string): unknown => {
  const at = src.indexOf(marker);
  expect(at, `${rel} no longer mentions ${marker}`).toBeGreaterThan(-1);
  const span = src.slice(src.lastIndexOf("`", at) + 1, src.indexOf("`", at));
  return JSON.parse(span.replace(/^actions:\s*/, ""));
};

/**
 * A `custom` action is a way off the screen only when BOTH of its paths reach
 * one — `onResolve ∪ rest` and `onError ∪ rest` (`completingActions.ts`). A doc
 * that teaches a shape failing that test is teaching a screen nobody can leave,
 * and — once anything else on it is stripped by the #209 boundary — one the
 * renderer bolts a second Continue button onto.
 */
describe("authoring docs — the `custom` CTAs they teach can be left", () => {
  it("credits the Tier 2 canonical button, which trails its custom with a continue", () => {
    const rel = "claude-plugin/skills/customize-onboarding-components/SKILL.md";
    const element = jsonBlockAround(read(rel), rel, "trackOnboardingComplete");
    // `[{custom}, "continue"]`: the trailing escape runs whether the handler
    // resolved or failed, so it satisfies both terms of the conjunction. This
    // half of the finding never reproduced — it was written against the earlier
    // `(onResolve ∪ rest) ∧ onError` reading, before `rest` flowed through both
    // terms — and is pinned here rather than "fixed".
    expect(hasCompletingAction([element])).toBe(true);
  });

  it("credits the `delayedContinue` loader fallback", () => {
    const rel = "claude-plugin/skills/create-step-json/references/composable-archetypes.md";
    const actions = inlineActionsAround(read(rel), rel, "delayedContinue");
    // This one was a bare `[{custom}]` — nothing after the action and neither
    // hook declared, so the press escapes on NO path: the host's timer resolves,
    // the handler's return value is discarded, and the screen never advances.
    expect(actionsCanComplete(actions)).toBe(true);
  });
});
