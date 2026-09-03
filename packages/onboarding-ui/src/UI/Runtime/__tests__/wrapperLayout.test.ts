import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UIElement } from "../types";
import type { BaseBoxProps } from "../elements/BaseBoxProps";
import {
  parentFacingLayout,
  nestedFillLayout,
  pressWrapperLayout,
  wantsFlexSizing,
  withNestedLayout,
} from "../elements/wrapperLayout";

/**
 * The duplicated-`flex` collapse (#231).
 *
 * `renderElement` inserts wrappers (`Pressable` for `onPress`, `AnimatedBox` for
 * `animation`/`transform`), so ONE authored `flex: 1` used to be emitted on two
 * or three nested boxes. In React Native `flex: N` implies `flexBasis: 0`, so the
 * inner box contributed zero main size, its content-sized parent measured 0, and
 * the element painted outside a row that reserved nothing for it.
 *
 * These are pure-module assertions on the style objects rather than measured
 * heights: this package has no rendering harness (vitest runs in plain Node and
 * `react-native` is Flow-typed, see `unknownElementTypes.test.ts`), so what is
 * testable here is which box gets which layout prop — which is exactly the rule
 * that was wrong. The measured-height evidence is the iOS captures on the PR.
 */

const props = (p: BaseBoxProps): BaseBoxProps => p;

const card = (p: BaseBoxProps): UIElement => ({
  id: "card",
  type: "YStack",
  props: { ...p, gap: 10 },
  children: [],
});

describe("parentFacingLayout", () => {
  it("carries the authored flex family", () => {
    expect(parentFacingLayout(props({ flex: 1, alignSelf: "center" }), "YStack")).toEqual({
      flex: 1,
      flexGrow: undefined,
      flexShrink: undefined,
      alignSelf: "center",
    });
  });

  it("applies the XStack flexShrink default", () => {
    expect(parentFacingLayout(props({ flex: 1 }), "XStack").flexShrink).toBe(1);
  });

  it("lets an authored flexShrink win over the XStack default", () => {
    expect(parentFacingLayout(props({ flexShrink: 0 }), "XStack").flexShrink).toBe(0);
  });

  it("leaves a content-sized element unsized", () => {
    expect(parentFacingLayout(props({ padding: 8 }), "YStack")).toEqual({
      flex: undefined,
      flexGrow: undefined,
      flexShrink: undefined,
      alignSelf: undefined,
    });
  });
});

describe("nestedFillLayout", () => {
  // The bug, stated as an invariant: a box nested inside the parent-facing one
  // must never carry `flex`, because that zeroes its flexBasis.
  it("never emits flex", () => {
    expect(nestedFillLayout(props({ flex: 1 })).flex).toBeUndefined();
  });

  it("fills the parent-facing box with flexGrow when the element authored flex", () => {
    expect(nestedFillLayout(props({ flex: 2 }))).toEqual({ flexGrow: 1 });
  });

  it("fills the parent-facing box when the element authored flexGrow", () => {
    expect(nestedFillLayout(props({ flexGrow: 1 }))).toEqual({ flexGrow: 1 });
  });

  it("stays content-sized when the element asked for no flex sizing", () => {
    expect(nestedFillLayout(props({ padding: 8 }))).toEqual({ flexGrow: undefined });
  });
});

describe("pressWrapperLayout", () => {
  it("is parent-facing when the Pressable is the outermost box", () => {
    expect(pressWrapperLayout(props({ flex: 1 }), "XStack", false)).toEqual({
      flex: 1,
      flexGrow: undefined,
      flexShrink: 1,
      alignSelf: undefined,
    });
  });

  it("only fills when a motion wrapper sits outside it", () => {
    expect(pressWrapperLayout(props({ flex: 1 }), "XStack", true)).toEqual({ flexGrow: 1 });
  });
});

describe("withNestedLayout", () => {
  it("moves flex off the element onto flexGrow", () => {
    const inner = withNestedLayout(card({ flex: 1 })).props as BaseBoxProps;
    expect(inner.flex).toBeUndefined();
    expect(inner.flexGrow).toBe(1);
  });

  it("clears the props that moved to the parent-facing box", () => {
    const inner = withNestedLayout(card({ flex: 1, flexShrink: 1, alignSelf: "center" }))
      .props as BaseBoxProps;
    // `flexShrink: 0` is RN's own default, and it is explicit so the renderers'
    // `?? (parentType === "XStack" ? 1 : undefined)` default cannot re-add a
    // second shrink on the inner box.
    expect(inner.flexShrink).toBe(0);
    expect(inner.alignSelf).toBeUndefined();
  });

  it("preserves everything that is not parent-facing layout", () => {
    const el = card({ flex: 1, padding: 12, backgroundColor: "#fff", aspectRatio: 1 });
    const inner = withNestedLayout(el);
    const p = inner.props as BaseBoxProps & { gap?: number };
    expect(p.padding).toBe(12);
    expect(p.backgroundColor).toBe("#fff");
    expect(p.aspectRatio).toBe(1);
    expect(p.gap).toBe(10);
    expect(inner.id).toBe("card");
    expect(inner.type).toBe("YStack");
    expect(inner.children).toBe(el.children);
  });

  // Several renderers gate an internal fill on `p.height ?? p.flex ?? p.flexGrow`
  // (the gradient-fork rule). Substituting flexGrow for flex keeps that true.
  it("keeps the element asking for flex sizing", () => {
    const el = card({ flex: 1 });
    expect(wantsFlexSizing(el.props)).toBe(true);
    expect(wantsFlexSizing(withNestedLayout(el).props)).toBe(true);
  });

  it("returns a referentially stable clone so React.memo still skips", () => {
    const el = card({ flex: 1 });
    expect(withNestedLayout(el)).toBe(withNestedLayout(el));
  });
});

describe("the whole wrapper chain", () => {
  it("emits the zero-basis flex on exactly one box, the outermost", () => {
    const p = props({ flex: 1, transform: { scale: 0.98 }, onPress: [{ type: "continue" }] });
    const chain = [
      parentFacingLayout(p, "XStack"), // AnimatedBox outer view
      nestedFillLayout(p), // AnimatedBox inner (static-transform) view
      pressWrapperLayout(p, "XStack", true), // Pressable
      withNestedLayout(card(p)).props as BaseBoxProps, // the element's own root
    ];
    expect(chain.filter((box) => box.flex != null)).toHaveLength(1);
    expect(chain[0].flex).toBe(1);
    expect(chain.slice(1).every((box) => box.flexGrow === 1)).toBe(true);
  });
});

/**
 * Wiring: the split must have exactly one owner. Source-level, for the same
 * reason `unknownElementTypes.test.ts` is — and because the defect was three
 * call sites that each decided for themselves. A fourth wrapper added later
 * fails this until it goes through the module.
 */
describe("wiring", () => {
  const ELEMENTS = join(__dirname, "../elements");
  const read = (file: string): string =>
    readFileSync(join(ELEMENTS, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

  it("renderElement builds no wrapper style of its own", () => {
    const src = read("renderElement.tsx");
    expect(src).toMatch(/pressWrapperLayout\(/);
    expect(src).toMatch(/withNestedLayout\(/);
    expect(src).not.toMatch(/flex:\s*p\.flex/);
    expect(src).not.toMatch(/flexShrink:\s*p\.flexShrink/);
  });

  it("AnimatedBox nests its transform view with a fill, never a flex", () => {
    const src = read("AnimatedBox.tsx");
    expect(src).toMatch(/nestedFillLayout\(/);
    expect(src).not.toMatch(/flex:\s*(1|flex)\b/);
  });
});
