import { describe, it, expect } from "vitest";
import { resolveRenderableStep } from "../screens/resolveRenderableStep";
import { ComposableScreenStepTypeSchema } from "../steps/ComposableScreen/types";

/**
 * The whole render-boundary decision for #209, in one pure function, so the
 * ComposableScreen renderer holds no logic that this package's tests cannot
 * reach (the UI package's vitest runs in plain Node and cannot import
 * `react-native`, so anything decided there is only assertable at source level).
 *
 * Two questions, answered together because the second only has meaning after
 * the first: what should be parsed, and can the user still leave the screen?
 */

const text = (id: string, content: string) => ({ id, type: "Text", props: { content } });
const cta = (id: string) => ({
  id,
  type: "Button",
  props: { label: "Continue", actions: ["continue"] },
});

const step = (elements: unknown[]) => ({
  id: "s",
  name: "Step one",
  type: "ComposableScreen",
  displayProgressHeader: false,
  payload: { elements },
});

describe("resolveRenderableStep", () => {
  it("hands back the same step reference when every element type is known", () => {
    const clean = step([text("t", "hi"), cta("go")]);
    const resolved = resolveRenderableStep(clean);
    expect(resolved.step).toBe(clean);
    expect(resolved.omitted).toEqual([]);
    expect(resolved.needsEscape).toBe(false);
  });

  it("asks for an escape when the strip takes the screen's only way forward", () => {
    // The reviewer's reproduction, and the shape the shipped example payload
    // itself uses: ONE root container holding everything, including the CTA. If
    // that container is a type this build does not know, the strip empties the
    // screen — `[]` parses cleanly, so nothing throws and nothing renders.
    const trapped = step([
      { id: "root", type: "HolographicCard", props: {}, children: [text("t", "hi"), cta("go")] },
    ]);
    const resolved = resolveRenderableStep(trapped);

    const parsed = ComposableScreenStepTypeSchema.parse(resolved.step);
    expect(parsed.payload.elements).toEqual([]);
    expect(resolved.needsEscape).toBe(true);
    expect(resolved.omitted.map((o) => o.elementType)).toEqual(["HolographicCard"]);
  });

  it("needs no escape when a CTA survives the strip", () => {
    const resolved = resolveRenderableStep(
      step([{ id: "x", type: "HolographicCard", props: {} }, cta("go")])
    );
    expect(resolved.needsEscape).toBe(false);
    expect(resolved.omitted).toHaveLength(1);
  });

  it("needs an escape when the surviving tree has content but nothing pressable", () => {
    const resolved = resolveRenderableStep(
      step([text("t", "hi"), { id: "x", type: "TimeOfDayPicker", props: {}, children: [cta("go")] }])
    );
    expect(resolved.needsEscape).toBe(true);
  });

  it("leaves an authored screen with no CTA alone — nothing was stripped, so nothing is ours to fix", () => {
    // A screen the author gave no way forward is an authoring bug, and the host
    // may well advance it some other way (a custom action that navigates, a
    // timer). Injecting a CTA there would change shipped screens that have
    // nothing to do with an unknown element type.
    const authored = step([text("t", "hi")]);
    const resolved = resolveRenderableStep(authored);
    expect(resolved.step).toBe(authored);
    expect(resolved.needsEscape).toBe(false);
  });

  it("passes a step with no element payload straight through", () => {
    const ratings = { id: "r", type: "Ratings", payload: { title: "x" } };
    const resolved = resolveRenderableStep(ratings);
    expect(resolved.step).toBe(ratings);
    expect(resolved.needsEscape).toBe(false);
  });

  it("strips nothing and asks for nothing when it cannot tell which types are known", () => {
    // An empty capability set means the derivation failed, which must read as
    // "learn nothing" — never as "reject everything", which would blank every
    // screen in every app and then cover each one with a fallback CTA.
    const trapped = step([
      { id: "root", type: "HolographicCard", props: {}, children: [cta("go")] },
    ]);
    const resolved = resolveRenderableStep(trapped, new Set<string>());
    expect(resolved.step).toBe(trapped);
    expect(resolved.omitted).toEqual([]);
    expect(resolved.needsEscape).toBe(false);
  });

  it("keys off the capability set it is given, not the schema it was built from", () => {
    // What renders is the onboarding-ui package's own re-declared union, whose
    // installed version can differ from this one's. The caller supplies the set;
    // here `Button` is deliberately absent from it and must be stripped.
    const resolved = resolveRenderableStep(step([text("t", "hi"), cta("go")]), new Set(["Text"]));
    const parsed = ComposableScreenStepTypeSchema.parse(resolved.step);
    expect(parsed.payload.elements.map((e) => e.id)).toEqual(["t"]);
    expect(resolved.needsEscape).toBe(true);
  });

  it("does not mutate the step it was given", () => {
    const trapped = step([{ id: "x", type: "HolographicCard", props: {} }, cta("go")]);
    const before = JSON.stringify(trapped);
    resolveRenderableStep(trapped);
    expect(JSON.stringify(trapped)).toBe(before);
  });
});
