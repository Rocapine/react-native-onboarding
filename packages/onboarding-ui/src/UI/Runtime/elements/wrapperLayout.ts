import type { UIElement } from "../types";
import type { BaseBoxProps } from "./BaseBoxProps";
import type { ParentType } from "./shared";

/**
 * Who owns which layout prop when `renderElement` nests an element inside a
 * wrapper (#231).
 *
 * An author writes ONE `flex: 1`. The renderer can emit up to four boxes for it
 * — AnimatedBox's outer view, AnimatedBox's inner (static-transform) view, the
 * `Pressable`, and the element's own root — and every one of them used to copy
 * the same `flex`. In React Native `flex: N` expands to
 * `{ flexGrow: N, flexShrink: 1, flexBasis: 0 }`, so a nested copy contributes
 * **zero** main size: the wrapper's own auto height became the sum of its
 * children's flex bases (0), the wrapper measured 0, and the element painted
 * over whatever followed it while its row reserved nothing.
 *
 * Web does not show it, and the reason is intrinsic sizing rather than the
 * automatic minimum size CSS would otherwise supply — react-native-web's own
 * View reset sets `min-width: 0; min-height: 0`, so that safety net is already
 * switched off there. What differs is how the two engines size a flex container
 * whose main size is `auto`: CSS resolves it from its items' max-content
 * contributions (which account for the item's CONTENT, not just its flex
 * basis), while Yoga resolves it from the items' flex BASE sizes — and a
 * `flex: N` item's base size is 0.
 *
 * The split, in one place for every wrapper present and future:
 *
 * - **Parent-facing props** (`flex`, `flexGrow`, `flexShrink`, `alignSelf`)
 *   describe how the box relates to its PARENT, so they belong on the OUTERMOST
 *   box only — that is the one the parent lays out.
 * - Every box **below** it gets the FILL CONTRACT instead: `flexGrow: 1` to
 *   fill a parent-facing box that got a definite main size (and only if the
 *   element asked for flex sizing at all), plus `flexShrink: 1` so the nested
 *   triple matches what `flex: N` means (grow, shrink 1, basis) — that
 *   correspondence is *why* the pair behaves like the single authored box.
 *
 *   On the `flexShrink`, an honest note, because a review disagreed and the
 *   measurement settles it: `flexBasis: 0` was clamping as well as collapsing,
 *   but the clamp turns out to be supplied anyway by the wrapper's definite
 *   main size — Yoga resolves the nested box's `basis: auto` AT_MOST the
 *   available space, so its hypothetical main size never exceeds the wrapper
 *   and there is no negative free space for a shrink to act on. Measured on
 *   device (iOS 26.1) over the guards screen's accessibility tree, with and
 *   without this `flexShrink`: **all 24 frames identical**, including a
 *   `justifyContent: "center"` box in a 90pt frame (90.0 both ways, not 137)
 *   and a wrapped `ScrollView` in a 130pt frame (130.0 both ways). So it is
 *   kept for semantic parity, and it is NOT known to change any pixel. Do not
 *   describe it as load-bearing without a case that measurably discriminates.
 * - The nested box's flex props are the contract, NOT the author's props. The
 *   authored values are applied exactly once, on the box the parent lays out;
 *   writing them on both boxes is the duplication this module removes.
 *
 * `width`/`height`/`padding`/`margin` deliberately stay on the element: a
 * content-sized wrapper grows to fit them, so they need no split.
 */

/** Layout for the box that faces the element's parent. */
export type ParentFacingLayout = {
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  alignSelf?: BaseBoxProps["alignSelf"];
};

/** Layout for a box nested inside the parent-facing one. */
export type NestedFillLayout = {
  flexGrow?: number;
  flexShrink?: number;
};

type FlexSizingProps = Pick<BaseBoxProps, "flex" | "flexGrow">;

/**
 * Did the author ask this element to be sized by its parent's flex line?
 *
 * NOT the same predicate as the renderers' `fillsParent`
 * (`p.height != null || p.flex != null || p.flexGrow != null`), which also
 * counts an explicit height — an explicitly-sized box needs no fill. What
 * matters for those renderers is that the demotion PRESERVES their predicate,
 * which is why it substitutes `flexGrow` for `flex` rather than dropping it
 * (`wrapperLayout.test.ts` pins that predicate directly).
 */
export const wantsFlexSizing = (p: FlexSizingProps): boolean =>
  p.flex != null || p.flexGrow != null;

export const parentFacingLayout = (
  p: BaseBoxProps,
  parentType?: ParentType
): ParentFacingLayout => ({
  flex: p.flex,
  flexGrow: p.flexGrow,
  // The `XStack` default lives here and ONLY here — a child of a row must be
  // allowed to shrink, and the box that is a child of that row is this one.
  flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
  alignSelf: p.alignSelf,
});

export const nestedFillLayout = (p: FlexSizingProps): NestedFillLayout =>
  fillLayout(wantsFlexSizing(p));

/**
 * The fill contract by itself, for a box whose outer is known to be sized —
 * the gradient forks and other renderer-internal wrappers, which have no
 * `BaseBoxProps` of their own to read. Use this instead of a literal
 * `flex: 1`: `flex` implies `flexBasis: 0`, which measures 0 whenever the
 * outer box's own main size is auto.
 *
 * `flexShrink: 0` in the not-filling case is RN's own default, so it changes
 * nothing on its own; it is written out because the renderers default
 * `flexShrink` to 1 under an `XStack` parent and a nested box must not
 * re-acquire a second shrink.
 */
export const fillLayout = (fills: boolean): NestedFillLayout => ({
  flexGrow: fills ? 1 : undefined,
  flexShrink: fills ? 1 : 0,
});

/**
 * Layout for the `onPress` wrapper. It faces the parent only when nothing else
 * wraps it; a motion wrapper is inserted outside it, and then the Pressable is
 * just another nested box.
 */
export const pressWrapperLayout = (
  p: BaseBoxProps,
  parentType: ParentType | undefined,
  hasMotionWrapper: boolean
): ParentFacingLayout | NestedFillLayout =>
  hasMotionWrapper ? nestedFillLayout(p) : parentFacingLayout(p, parentType);

// Cached on the element, which is referentially stable (it comes from the
// memoized parsed step). A fresh clone per render would defeat the `React.memo`
// on every element component — see `areElementPropsEqual` in `shared.ts`.
const nestedCache = new WeakMap<UIElement, UIElement>();

/**
 * The element as it must be rendered INSIDE a wrapper: the parent-facing props
 * are gone (the wrapper has them) and replaced by the nested fill.
 *
 * Call this before dispatching to the concrete renderer, so all ~25 renderers
 * keep reading `props.flex` / `props.flexShrink` unchanged and none of them has
 * to know whether it was wrapped.
 */
// Per-state style overrides are `BaseBoxPropsSchema.extend({…}).partial()` and
// are spread OVER the element's own props at render time (`ButtonElement`'s
// `eff`), so an authored `pressedStyle.flex` would put `flexBasis: 0` back on
// the nested box for as long as the finger is down.
//
// `flex` is the ONLY key demoted here, because it is the only one with a
// substitute: `fillLayout` stands in for it. `alignSelf` deliberately stays —
// the wrapper is built from the BASE props and has no press state, so demoting
// a per-state `alignSelf` would drop it entirely rather than move it
// (`{ alignSelf: "stretch", pressedStyle: { alignSelf: "center" } }` narrows on
// touch-down). It only ever landed on the inner box, so leaving it is a
// no-change, and silently losing a prop the author wrote is the worse failure.
const NESTED_OVERRIDE_KEYS = ["pressedStyle", "disabledStyle"] as const;

const demoteOverride = (
  override: unknown,
  fill: NestedFillLayout
): Record<string, unknown> | undefined => {
  if (!override || typeof override !== "object") return override as undefined;
  const o = override as BaseBoxProps;
  return {
    ...(override as Record<string, unknown>),
    flex: undefined,
    // An override that itself asks to fill keeps filling; one that says nothing
    // inherits the base props' contract.
    ...(wantsFlexSizing(o) ? fillLayout(true) : fill),
  };
};

export const withNestedLayout = <T extends UIElement>(element: T): T => {
  const cached = nestedCache.get(element);
  if (cached) return cached as T;
  const p = element.props as BaseBoxProps;
  const fill = nestedFillLayout(p);
  const overrides: Record<string, unknown> = {};
  for (const key of NESTED_OVERRIDE_KEYS) {
    const value = (element.props as Record<string, unknown>)[key];
    if (value != null) overrides[key] = demoteOverride(value, fill);
  }
  const nested = {
    ...element,
    props: {
      ...element.props,
      flex: undefined,
      alignSelf: undefined,
      ...fill,
      ...overrides,
    },
  } as unknown as T;
  nestedCache.set(element, nested);
  return nested;
};
