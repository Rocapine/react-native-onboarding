import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UIElement } from "../types";
import type { BaseBoxProps } from "../elements/BaseBoxProps";
import {
  fillsParent,
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

  // `flexBasis: 0` was doing two jobs: it collapsed the box (the bug) AND it
  // clamped the box to a wrapper with a definite main size. Dropping it without
  // `flexShrink` lets a nested box grow to its own content and overflow the
  // wrapper — a wrapped ScrollView loses its bounded height and stops
  // scrolling. Grow to fill, shrink to stay clamped.
  it("keeps the clamp the zero basis was providing", () => {
    expect(nestedFillLayout(props({ flex: 2 }))).toEqual({ flexGrow: 1, flexShrink: 1 });
  });

  it("fills the parent-facing box when the element authored flexGrow", () => {
    expect(nestedFillLayout(props({ flexGrow: 1 }))).toEqual({ flexGrow: 1, flexShrink: 1 });
  });

  // `flexShrink: 0` is RN's own default, so it changes nothing on its own — it
  // is stated because the renderers default `flexShrink` to 1 under an `XStack`
  // parent, and a nested box must not re-acquire a second shrink.
  it("stays content-sized when the element asked for no flex sizing", () => {
    expect(nestedFillLayout(props({ padding: 8 }))).toEqual({
      flexGrow: undefined,
      flexShrink: 0,
    });
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
    expect(pressWrapperLayout(props({ flex: 1 }), "XStack", true)).toEqual({
      flexGrow: 1,
      flexShrink: 1,
    });
  });
});

describe("withNestedLayout", () => {
  it("moves flex off the element onto flexGrow", () => {
    const inner = withNestedLayout(card({ flex: 1 })).props as BaseBoxProps;
    expect(inner.flex).toBeUndefined();
    expect(inner.flexGrow).toBe(1);
  });

  it("clears the props that moved to the parent-facing box", () => {
    const inner = withNestedLayout(card({ flex: 1, flexShrink: 0, alignSelf: "center" }))
      .props as BaseBoxProps;
    // The nested box's flex props are the FILL CONTRACT, not the author's props:
    // the authored values are honoured once, on the box the parent lays out
    // (asserted in `parentFacingLayout` above). Writing them on both boxes is
    // the duplication this module exists to remove — and the clamp has to hold
    // whatever the author asked for on the outside.
    expect(inner.flexShrink).toBe(1);
    expect(inner.alignSelf).toBeUndefined();
  });

  it("demotes flex inside pressedStyle / disabledStyle too", () => {
    // `ButtonStyleOverrideSchema` is `BaseBoxPropsSchema.extend({…}).partial()`
    // and `ButtonElement` renders `{...props, ...stateOverride}`, so an authored
    // `pressedStyle.flex` puts `flexBasis: 0` back on the inner box for exactly
    // as long as the finger is down.
    const inner = withNestedLayout({
      id: "cta",
      type: "Button",
      props: {
        label: "Go",
        flex: 1,
        pressedStyle: { flex: 1, backgroundColor: "#000" },
        disabledStyle: { flex: 1 },
      },
    } as unknown as UIElement).props as BaseBoxProps & {
      pressedStyle?: BaseBoxProps & { backgroundColor?: string };
      disabledStyle?: BaseBoxProps;
    };
    expect(inner.pressedStyle?.flex).toBeUndefined();
    expect(inner.disabledStyle?.flex).toBeUndefined();
    // Only the layout props move — the override still does its actual job.
    expect(inner.pressedStyle?.backgroundColor).toBe("#000");
  });

  it("keeps a per-state alignSelf, which has nowhere else to go", () => {
    // `flex` can move to the wrapper because `fillLayout` substitutes for it on
    // the inner box. `alignSelf` cannot: the wrapper carries the BASE props and
    // has no press state, so demoting it would silently drop a prop the author
    // wrote — `{ alignSelf: "stretch", pressedStyle: { alignSelf: "center" } }`
    // narrowed on touch-down and would stop doing anything in either state.
    // It only ever landed on the inner box, so leaving it there is a no-change.
    const inner = withNestedLayout({
      id: "cta",
      type: "Button",
      props: {
        label: "Go",
        flex: 1,
        alignSelf: "stretch",
        pressedStyle: { alignSelf: "center" },
      },
    } as unknown as UIElement).props as BaseBoxProps & {
      pressedStyle?: BaseBoxProps;
    };
    expect(inner.pressedStyle?.alignSelf).toBe("center");
    // The base one still moves to the wrapper.
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

  // `fillsParent` is IMPORTED, not restated: the five renderers call the same
  // exported function, so this asserts the demotion against the expression they
  // actually gate on. A hand-copy here would only pin the demotion against its
  // own copy — a renderer dropping `|| p.flexGrow != null` from a private copy
  // was invisible to the previous version of this test, and the `wantsFlexSizing`
  // version before it had the same shape of hole.
  it("preserves the fillsParent predicate the renderers gate on", () => {
    for (const authored of [
      props({ flex: 1 }),
      props({ flexGrow: 1 }),
      props({ height: 200 }),
      props({ padding: 8 }),
    ]) {
      expect(fillsParent(withNestedLayout(card(authored)).props as BaseBoxProps)).toBe(
        fillsParent(authored)
      );
    }
  });

  it("still reports flex sizing after the demotion", () => {
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
    expect(chain.slice(1).every((box) => box.flexShrink === 1)).toBe(true);
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
    // Not "no `p.flex`" but "no flex style key at all": a wrapper added later
    // must get its style from the module, whichever prop it reaches for.
    expect(src).not.toMatch(/\bflex(Grow|Shrink|Basis)?:/);
  });

  it("AnimatedBox nests its transform view with a fill, never a flex", () => {
    // `not.toMatch(/flex:\s*(1|flex)\b/)` was the first version of this and it
    // caught two spellings out of six — `flex: outerLayout?.flex` (the exact
    // shape this PR's rename invites), `flex: p.flex`, `{ flex }` shorthand and
    // `flexBasis: 0` (the literal mechanism of #231) all walked through it.
    // Every flex prop now arrives via `outerLayout` or `nestedFillLayout()`, so
    // this file has no reason to write a flex key at all.
    const src = read("AnimatedBox.tsx");
    expect(src).toMatch(/nestedFillLayout\(/);
    expect(src).not.toMatch(/\bflex(Grow|Shrink|Basis)?:/);
  });

  it("AnimatedBox honours `hidden` in both branches", () => {
    // `hidden` holds a deferred `entering.once` element invisible. Applied only
    // in the no-builder branch, an element that ALSO sets `exiting`/`layout`
    // renders visible through its hold.
    // Both the builder and the no-builder branch must apply it — `hidden?:` in
    // the props declaration matched a looser regex, so match the style entry.
    const src = read("AnimatedBox.tsx");
    expect([...src.matchAll(/hidden\s*\?\s*\{\s*opacity:\s*0\s*\}/g)]).toHaveLength(2);
  });

  // The demotion cannot help a renderer that computes its own inner `flex` from
  // a `fillsParent`-style predicate: that predicate stays true (it must — see
  // above), so the renderer re-emits `flex: 1` on a nested box and the zero
  // basis comes back for the very elements this fixes. It also splits the
  // gradient fork from the non-gradient one, which the runtime rules forbid.
  it("no renderer fills a nested box with flex", () => {
    for (const file of [
      "ScrollViewElement.tsx",
      "SafeAreaViewElement.tsx",
      "KeyboardAvoidingViewElement.tsx",
      "ButtonElement.tsx",
      "CarouselElement.tsx",
    ]) {
      const src = read(file);
      // Positive, so this guards the shared helpers rather than a spelling: the
      // previous version keyed on the identifier `fillsParent`, so renaming the
      // local silently stopped it guarding anything.
      expect(src, `${file} must gate on the shared fillsParent`).toMatch(/fillsParent\(/);
      expect(src, `${file} must fill with the shared contract`).toMatch(/fillLayout\(/);
      // Negative on the MECHANISM, not the name: a conditional `flex` is how an
      // inner fill re-acquires `flexBasis: 0`. The outermost box's unconditional
      // `flex: p.flex` in containerStyle/frameStyle is legitimate and stays.
      expect(src, `${file} computes a conditional flex for a nested box`).not.toMatch(
        /flex:\s*[^,\n]*\?/
      );
      expect(src, `${file} hardcodes flex on a nested box`).not.toMatch(
        /style=\{\{\s*flex:\s*1\s*\}\}/
      );
    }
  });
});
