import { describe, it, expect } from "vitest";
import {
  collectUnknownElementKeys,
  collectUnknownKeysInSteps,
  formatUnknownElementKeys,
} from "../screens/unknownKeys";
import { ComposableScreenStepTypeSchema } from "../steps/ComposableScreen/types";

describe("collectUnknownElementKeys", () => {
  it("finds a BaseBoxProp written one level too high and says where it belongs", () => {
    // The real-world case: `animation` next to `type`/`props` instead of inside
    // `props`. Parses fine, renders fine, animation never happens.
    const found = collectUnknownElementKeys([
      {
        id: "hero",
        type: "Image",
        props: { url: "https://x/y.png" },
        animation: { entering: { preset: "FadeInDown", duration: 300 } },
      },
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      path: "elements[0]",
      elementId: "hero",
      elementType: "Image",
      key: "animation",
      kind: "misplaced",
      suggestion: "props.animation",
    });
  });

  it("distinguishes a STALE DUPLICATE from a misplaced prop", () => {
    // The real corpus case: `props.animation` is already present and working
    // (200ms), and a stale top-level copy (300ms) sits alongside it doing
    // nothing. "did you mean props.animation?" would be actively misleading —
    // they didn't forget it, they have two and are probably editing the dead one.
    const found = collectUnknownElementKeys([
      {
        id: "loader-img-1",
        type: "Image",
        props: {
          url: "https://x/y.png",
          animation: { entering: { preset: "FadeIn", duration: 200, easing: "ease-in" } },
        },
        animation: { entering: { preset: "FadeIn", duration: 300, easing: "ease-in-out" } },
      },
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      key: "animation",
      kind: "shadowed",
      suggestion: "props.animation",
      conflicts: true,
    });
  });

  it("does not cry wolf when the duplicate is identical", () => {
    const anim = { entering: { preset: "FadeIn", duration: 200 } };
    const found = collectUnknownElementKeys([
      { id: "i", type: "Image", props: { url: "u", animation: anim }, animation: { ...anim } },
    ]);
    expect(found[0]).toMatchObject({ kind: "shadowed", conflicts: false });
  });

  it("treats a key absent from props as misplaced even when props exists", () => {
    const found = collectUnknownElementKeys([
      { id: "i", type: "Image", props: { url: "u" }, onPress: [] },
    ]);
    expect(found[0]).toMatchObject({ kind: "misplaced", suggestion: "props.onPress" });
  });

  it("confirms the misplaced key really is dropped by the schema (why this exists)", () => {
    const step = {
      id: "s",
      name: "n",
      type: "ComposableScreen",
      displayProgressHeader: true,
      payload: {
        elements: [
          {
            id: "hero",
            type: "Image",
            props: { url: "https://x/y.png" },
            animation: { entering: { preset: "FadeInDown", duration: 300 } },
          },
        ],
      },
    };

    const parsed = ComposableScreenStepTypeSchema.safeParse(step);
    // Parsing SUCCEEDS — that is the whole problem.
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.payload.elements[0].animation).toBeUndefined();
    // ...and the diagnostic is what surfaces it.
    expect(collectUnknownElementKeys(step.payload.elements)).toHaveLength(1);
  });

  it("reports a genuinely unknown key with no suggestion", () => {
    const found = collectUnknownElementKeys([
      { id: "t", type: "Text", props: { content: "hi" }, wobble: 3 },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe("wobble");
    expect(found[0].kind).toBe("unknown");
    expect(found[0].suggestion).toBeUndefined();
  });

  it("is silent on correct elements, including every valid top-level key", () => {
    const found = collectUnknownElementKeys([
      {
        id: "stack",
        name: "a name",
        type: "YStack",
        renderWhen: { variable: "v", operator: "eq", value: 1 },
        props: { gap: 8 },
        children: [{ id: "t", type: "Text", props: { content: "hi" } }],
      },
    ]);
    expect(found).toEqual([]);
  });

  it("descends into children and reports the nested path", () => {
    const found = collectUnknownElementKeys([
      {
        id: "outer",
        type: "YStack",
        props: {},
        children: [
          { id: "ok", type: "Text", props: { content: "fine" } },
          { id: "bad", type: "Text", props: { content: "x" }, onPress: [] },
        ],
      },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe("elements[0].children[1]");
    expect(found[0].suggestion).toBe("props.onPress");
  });

  it("skips unknown element types but still checks their children", () => {
    // An unknown `type` is a parse error the union already reports well; guessing
    // its key set would be noise. Its children are still ordinary elements.
    const found = collectUnknownElementKeys([
      {
        id: "mystery",
        type: "NotAnElement",
        props: {},
        bogus: 1,
        children: [{ id: "t", type: "Text", props: { content: "x" }, animation: {} }],
      },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].elementId).toBe("t");
  });

  it("never throws on malformed input", () => {
    expect(collectUnknownElementKeys(undefined)).toEqual([]);
    expect(collectUnknownElementKeys("nope")).toEqual([]);
    expect(collectUnknownElementKeys([null, 42, undefined])).toEqual([]);
    expect(collectUnknownElementKeys([{ type: "Text" }])).toEqual([]);
  });

  it("derives allowed keys from the schema, so container children are recognised", () => {
    // `children` is valid on YStack but not on Image — derived per variant, not
    // from one hardcoded list.
    expect(collectUnknownElementKeys([{ id: "y", type: "YStack", props: {}, children: [] }])).toEqual([]);
    const onImage = collectUnknownElementKeys([
      { id: "i", type: "Image", props: { url: "u" }, children: [] },
    ]);
    expect(onImage).toHaveLength(1);
    expect(onImage[0].key).toBe("children");
  });
});

describe("collectUnknownKeysInSteps", () => {
  it("scans every ComposableScreen step and labels findings by step id", () => {
    const found = collectUnknownKeysInSteps([
      { id: "intro", type: "MediaContent", payload: { title: "no elements here" } },
      {
        id: "reveal",
        type: "ComposableScreen",
        payload: {
          elements: [
            { id: "a", type: "Image", props: { url: "u" }, animation: {} },
            { id: "b", type: "Image", props: { url: "u" }, animation: {} },
          ],
        },
      },
    ]);
    expect(found).toHaveLength(2);
    expect(found[0].path).toBe("step[reveal].elements[0]");
    expect(found.every((f) => f.suggestion === "props.animation")).toBe(true);
  });

  it("returns nothing for step lists with no element trees", () => {
    expect(collectUnknownKeysInSteps([{ id: "x", type: "Ratings", payload: {} }])).toEqual([]);
    expect(collectUnknownKeysInSteps(undefined)).toEqual([]);
  });
});

describe("formatUnknownElementKeys", () => {
  it("returns an empty string when there is nothing to report", () => {
    expect(formatUnknownElementKeys([])).toBe("");
  });

  it("says which copy wins for a stale duplicate, and never says 'did you mean'", () => {
    const msg = formatUnknownElementKeys(
      collectUnknownElementKeys([
        {
          id: "loader-img-1",
          type: "Image",
          props: { url: "u", animation: { entering: { duration: 200 } } },
          animation: { entering: { duration: 300 } },
        },
      ])
    );
    expect(msg).toContain("is ignored");
    expect(msg).toContain("different value");
    expect(msg).toContain("taking effect");
    expect(msg).not.toContain("did you mean");
  });

  it("names the fix for a misplaced prop", () => {
    const msg = formatUnknownElementKeys(
      collectUnknownElementKeys([
        { id: "hero", type: "Image", props: { url: "u" }, animation: {} },
      ])
    );
    expect(msg).toContain('did you mean props.animation?');
    expect(msg).toContain("hero");
    expect(msg).toContain("silently dropped");
  });
});

/**
 * Keys on an ACTION object, not on the element (#196, review round 1).
 *
 * `ButtonActionSchema` is a plain non-strict `z.object` union — deliberately, for
 * the same reason the element schemas are (`unknownKeys.ts`'s header:
 * `.strict()` would turn a published payload carrying a stray key into a dead
 * screen). The price is that a misspelled outcome hook is completely silent:
 * `{"type":"requestPermission","onGranted":["continue"],"onDeneid":["continue"]}`
 * validates clean, the key is stripped, and the denial branch is dead — on a
 * permission screen that is a CTA the refusing user cannot get past.
 *
 * So it is reported the same non-fatal way a misplaced `animation` is, through
 * the `__DEV__` check `OnboardingProvider` already runs on every fetched
 * payload. Key sets are derived from `ButtonActionSchema` itself, so they cover
 * `purchase.onSucces` and every action added later with no change here.
 */
describe("collectUnknownElementKeys — action keys", () => {
  const withActions = (actions: unknown) => [
    { id: "cta", type: "Button", props: { label: "Go", actions } },
  ];

  it("reports a misspelled requestPermission outcome hook", () => {
    const found = collectUnknownElementKeys(
      withActions([
        { type: "requestPermission", kind: "notifications", onGranted: ["continue"], onDeneid: ["continue"] },
      ])
    );
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe("onDeneid");
    expect(found[0].scope).toBe("action");
    expect(found[0].actionType).toBe("requestPermission");
    expect(found[0].path).toBe("elements[0].props.actions[0]");
    expect(found[0].elementId).toBe("cta");
  });

  it("reports a misspelled purchase hook — the derivation is not permission-specific", () => {
    const found = collectUnknownElementKeys(
      withActions([{ type: "purchase", product: "yearly", onSucces: ["continue"] }])
    );
    expect(found.map((f) => f.key)).toEqual(["onSucces"]);
  });

  it("says nothing about a correctly spelled action", () => {
    expect(
      collectUnknownElementKeys(
        withActions([
          "continue",
          { type: "requestPermission", kind: "camera", onGranted: ["continue"], onDenied: ["continue"], onUnavailable: ["continue"] },
          { type: "setVariable", name: "a", value: "b", valueMode: "expression", kind: "int", arrayOp: "toggle", label: "A" },
          { type: "purchase", product: "yearly", onSuccess: ["continue"], onCancel: [], onError: [], onPending: [] },
          { type: "restore", onSuccess: ["continue"], onNothingToRestore: [], onError: [] },
          { type: "dismiss" },
          { type: "presentPaywall", placement: "x" },
          { type: "custom", function: "f", variables: ["a"] },
        ])
      )
    ).toEqual([]);
  });

  it("walks into an outcome hook's own actions", () => {
    const found = collectUnknownElementKeys(
      withActions([
        {
          type: "requestPermission",
          kind: "notifications",
          onGranted: [{ type: "purchase", product: "yearly", onErrr: ["continue"] }],
          onDenied: ["continue"],
        },
      ])
    );
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe("onErrr");
    expect(found[0].path).toBe("elements[0].props.actions[0].onGranted[0]");
  });

  it("covers the generic onPress list too", () => {
    const found = collectUnknownElementKeys([
      { id: "card", type: "YStack", props: { onPress: [{ type: "dismiss", statuss: "x" }] }, children: [] },
    ]);
    expect(found.map((f) => f.key)).toEqual(["statuss"]);
    expect(found[0].path).toBe("elements[0].props.onPress[0]");
  });

  // An action type this build does not know is a parse failure, not a stray
  // key — guessing its key set would be noise, exactly as for an unknown
  // element type.
  it("skips an action type it does not know", () => {
    expect(
      collectUnknownElementKeys(withActions([{ type: "requestBiometrics", onGranted: ["continue"] }]))
    ).toEqual([]);
  });

  it("tolerates malformed action lists", () => {
    expect(collectUnknownElementKeys(withActions("continue"))).toEqual([]);
    expect(collectUnknownElementKeys(withActions([null, 42, "continue"]))).toEqual([]);
    expect(collectUnknownElementKeys(withActions([{}]))).toEqual([]);
  });

  it("formats an action finding as a dropped key on that action", () => {
    const msg = formatUnknownElementKeys(
      collectUnknownElementKeys(
        withActions([{ type: "requestPermission", kind: "notifications", onDeneid: ["continue"] }])
      )
    );
    expect(msg).toContain("onDeneid");
    expect(msg).toContain("requestPermission");
    expect(msg).toContain("elements[0].props.actions[0]");
  });
});
