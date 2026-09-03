import { describe, it, expect } from "vitest";
import {
  KNOWN_ELEMENT_TYPES,
  collectUnknownElementTypes,
  collectUnknownElementTypesInSteps,
  dropUnknownElementTypes,
  dropUnknownElementTypesInStep,
  formatUnknownElementTypes,
} from "../screens/unknownElementTypes";
import { ScreenElementsSchema } from "../screens/types";
import { ComposableScreenStepTypeSchema } from "../steps/ComposableScreen/types";

/**
 * Forward compatibility for element TYPES (#209).
 *
 * `UIElementSchema` is a discriminated union of the types this SDK build knows.
 * Before this, one element type published after an app shipped made the WHOLE
 * screen fail to parse — and the ComposableScreen renderer's `.parse` threw
 * inside its error boundary, whose fallback has no interactive control, so on a
 * step with `displayProgressHeader: false` the user had no way forward OR back.
 *
 * The contract asserted here: an unrecognized element type is OMITTED (matching
 * `renderElement`'s terminal `return null` and `buildAnimation`'s unknown-preset
 * no-op), the rest of the screen renders, and a genuine data error on a KNOWN
 * type still fails loudly.
 */

const text = (id: string, content: string) => ({ id, type: "Text", props: { content } });
const stack = (id: string, children: unknown[]) => ({ id, type: "YStack", props: {}, children });
const unknown = (id: string, type = "HolographicCard") => ({ id, type, props: { magic: true } });

const step = (elements: unknown[]) => ({
  id: "step-1",
  name: "Step one",
  type: "ComposableScreen",
  displayProgressHeader: false,
  payload: { elements },
});

describe("dropUnknownElementTypes", () => {
  it("keeps the rest of the screen when a top-level element type is unknown", () => {
    const parsed = ScreenElementsSchema.safeParse(
      dropUnknownElementTypes([text("a", "before"), unknown("x"), text("b", "after")])
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("keeps a container's known children when one child type is unknown", () => {
    const parsed = ScreenElementsSchema.safeParse(
      dropUnknownElementTypes([stack("root", [text("a", "hi"), unknown("x")])])
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const [root] = parsed.data;
    expect(root.type).toBe("YStack");
    expect("children" in root ? root.children.map((c) => c.id) : []).toEqual(["a"]);
  });

  it("drops the whole subtree of an unknown element, never hoisting its children", () => {
    // Matches the render half: `renderElement` returns null for an unrecognized
    // type, so its children never render either. Hoisting them would invent a
    // layout the author never wrote.
    const parsed = ScreenElementsSchema.safeParse(
      dropUnknownElementTypes([{ ...unknown("x"), children: [text("inner", "hidden")] }])
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual([]);
  });

  it("drops an unknown type nested in a RichText's Text-only children", () => {
    const parsed = ScreenElementsSchema.safeParse(
      dropUnknownElementTypes([
        { id: "rt", type: "RichText", props: {}, children: [text("w", "word"), unknown("x")] },
      ])
    );
    expect(parsed.success).toBe(true);
  });

  it("still fails loudly on a bad prop of a KNOWN element type", () => {
    // The forward-compat escape must not become a silence-everything escape:
    // `variant: "plain"` is a CMS data bug the author has to fix.
    const bad = { id: "b", type: "Button", props: { label: "Go", variant: "plain" } };
    const parsed = ScreenElementsSchema.safeParse(dropUnknownElementTypes([bad]));
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((i) => i.path.join(".").endsWith("props.variant"))).toBe(true);
  });

  it("still fails loudly on a KNOWN element type missing its `id`", () => {
    const parsed = ScreenElementsSchema.safeParse(
      dropUnknownElementTypes([{ type: "Text", props: { content: "x" } }])
    );
    expect(parsed.success).toBe(false);
  });

  it("leaves an element with no `type` for the parser to report", () => {
    // A missing/non-string discriminator is a malformed payload, not a newer
    // element — dropping it would hide the real error.
    const parsed = ScreenElementsSchema.safeParse(dropUnknownElementTypes([{ id: "a", props: {} }]));
    expect(parsed.success).toBe(false);
  });

  it("returns the input unchanged when it is not an array", () => {
    expect(dropUnknownElementTypes(undefined)).toBeUndefined();
    expect(dropUnknownElementTypes("nope")).toBe("nope");
  });

  it("does not mutate the payload it was given", () => {
    const elements = [stack("root", [text("a", "hi"), unknown("x")])];
    const before = JSON.stringify(elements);
    dropUnknownElementTypes(elements);
    expect(JSON.stringify(elements)).toBe(before);
  });

  it("keeps every element when the type registry cannot be built", () => {
    // The registry is derived from zod's internals, so a future zod release can
    // break it. It must degrade to "everything is known" (parse as today), never
    // to "nothing is known" — which would blank every screen in every app.
    const elements = [text("a", "hi"), unknown("x")];
    expect(dropUnknownElementTypes(elements, new Set<string>())).toBe(elements);
  });

  it("returns the same array reference when nothing is unknown", () => {
    // Structural sharing: the strip runs on every screen render, so a clean
    // payload must not be cloned (and must stay `useMemo`-stable).
    const elements = [stack("root", [text("a", "hi")])];
    expect(dropUnknownElementTypes(elements)).toBe(elements);
  });
});

describe("dropUnknownElementTypesInStep", () => {
  it("makes the ComposableScreen step parse instead of throwing", () => {
    // The exact call at ComposableScreen/Renderer.tsx: `.parse(step)`.
    expect(() => ComposableScreenStepTypeSchema.parse(step([unknown("x")]))).toThrow();
    const parsed = ComposableScreenStepTypeSchema.parse(
      dropUnknownElementTypesInStep(step([text("a", "hi"), unknown("x")]))
    );
    expect(parsed.payload.elements.map((e) => e.id)).toEqual(["a"]);
  });

  it("passes a step through untouched when it carries no element payload", () => {
    const ratings = { id: "r", type: "Ratings", payload: { title: "x" } };
    expect(dropUnknownElementTypesInStep(ratings)).toBe(ratings);
  });

  it("returns the same step reference when every element type is known", () => {
    const clean = step([text("a", "hi")]);
    expect(dropUnknownElementTypesInStep(clean)).toBe(clean);
  });
});

describe("collectUnknownElementTypes", () => {
  it("reports the path, id and type of each unknown element", () => {
    const found = collectUnknownElementTypes([
      text("a", "hi"),
      unknown("x", "HolographicCard"),
      stack("root", [unknown("y", "TimeOfDayPicker")]),
    ]);
    expect(found).toEqual([
      { path: "elements[1]", elementId: "x", elementType: "HolographicCard" },
      { path: "elements[2].children[0]", elementId: "y", elementType: "TimeOfDayPicker" },
    ]);
  });

  it("reports an unknown parent once, not its dropped descendants", () => {
    const found = collectUnknownElementTypes([
      { ...unknown("x"), children: [unknown("y", "AlsoUnknown")] },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].elementId).toBe("x");
  });

  it("says nothing about a tree of known types", () => {
    expect(collectUnknownElementTypes([stack("root", [text("a", "hi")])])).toEqual([]);
  });

  it("walks every step carrying an element payload", () => {
    const found = collectUnknownElementTypesInSteps([
      { id: "s1", type: "Ratings", payload: {} },
      step([unknown("x")]),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].path).toContain("step-1");
  });
});

describe("formatUnknownElementTypes", () => {
  it("says nothing when there is nothing to say", () => {
    expect(formatUnknownElementTypes([])).toBe("");
  });

  it("names the type, the path and the omit contract", () => {
    const report = formatUnknownElementTypes(
      collectUnknownElementTypes([unknown("x", "HolographicCard")])
    );
    expect(report).toContain("HolographicCard");
    expect(report).toContain("elements[0]");
    expect(report).toMatch(/omitted/i);
    expect(report).toMatch(/upgrade|newer|version/i);
  });
});

describe("KNOWN_ELEMENT_TYPES", () => {
  it("is derived from the schema, so it cannot drift as elements are added", () => {
    // Every variant of the discriminated union, and nothing else.
    expect(KNOWN_ELEMENT_TYPES).toContain("YStack");
    expect(KNOWN_ELEMENT_TYPES).toContain("Slider");
    expect(KNOWN_ELEMENT_TYPES).not.toContain("HolographicCard");
    for (const type of KNOWN_ELEMENT_TYPES) {
      expect(
        ScreenElementsSchema.safeParse([{ id: "a", type, props: {} }]).success ||
          !ScreenElementsSchema.safeParse([{ id: "a", type, props: {} }]).error.issues.some(
            (i) => i.path.join(".") === "0.type"
          )
      ).toBe(true);
    }
  });

  it("is sorted and free of duplicates, so it is usable as a capability list", () => {
    expect([...KNOWN_ELEMENT_TYPES]).toEqual([...new Set(KNOWN_ELEMENT_TYPES)].sort());
  });
});

describe("no backtracking is reintroduced", () => {
  it("strips a deep tree and still fails fast on a pathological payload", () => {
    // Canary for the discriminated union (screens/types.ts:296-348): a plain
    // union of these recursive variants exhausted a 512 MB heap on a real
    // 52-node paywall. The strip must stay a linear walk in front of it.
    const nest = (depth: number, leaf: unknown): unknown =>
      depth === 0 ? leaf : { name: "c", type: "YStack", props: {}, children: [nest(depth - 1, leaf)] };
    const started = Date.now();
    const parsed = ScreenElementsSchema.safeParse(dropUnknownElementTypes([nest(10, text("l", "x"))]));
    expect(parsed.success).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
