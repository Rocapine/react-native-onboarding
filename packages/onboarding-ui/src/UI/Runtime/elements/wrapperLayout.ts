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
 * "Is this box sized from outside?" — the predicate a renderer gates an
 * internal fill on (the gradient-fork rule). Exported and imported by all five
 * of them AND by the test, because the alternative is six copies of one
 * expression and six chances to drift: a renderer that quietly drops
 * `|| p.flexGrow != null` from its own copy flips onto the content-sized branch
 * for every demoted element, and a test holding its own copy cannot see it.
 *
 * The demotion must PRESERVE this — it substitutes `flexGrow` for `flex`
 * rather than dropping it, so an explicitly-sized box stays explicitly sized.
 */
export const fillsParent = (
  p: Pick<BaseBoxProps, "height" | "flex" | "flexGrow">
): boolean => p.height != null || p.flex != null || p.flexGrow != null;

/**
 * Did the author ask this element to be sized by its parent's flex LINE?
 *
 * Deliberately narrower than `fillsParent`: it omits `height`, because an
 * explicitly-sized box needs no fill. Don't merge the two.
 */
export const wantsFlexSizing = (p: FlexSizingProps): boolean =>
  p.flex != null || p.flexGrow != null;

/**
 * The element types whose OWN renderer applies
 * `?? (parentType === "XStack" ? 1 : undefined)`: `StackElement`,
 * `TextElement`, `RichTextElement`, `TypewriterTextElement`. A wrapper stands
 * in for the element it wraps, so it takes that default for exactly these and
 * for nothing else — an `Image` in a row shrinks in neither the wrapped nor the
 * unwrapped case. An earlier revision of this module applied the default to
 * every wrapper, which silently gave motion-wrapped elements of every type a
 * shrink they had never had (`AnimatedBox` used to forward no `flexShrink` at
 * all), so two fixed-width images in a too-narrow row started shrinking
 * instead of overflowing.
 */
const ROW_SHRINK_TYPES: ReadonlySet<string> = new Set([
  "XStack",
  "YStack",
  "Text",
  "RichText",
  "TypewriterText",
]);

export const parentFacingLayout = (
  p: BaseBoxProps,
  parentType: ParentType | undefined,
  elementType: string
): ParentFacingLayout => ({
  flex: p.flex,
  flexGrow: p.flexGrow,
  // The `XStack` default, applied to the box that is actually the row's child,
  // and only for the types that would have applied it themselves (see
  // `ROW_SHRINK_TYPES`). NOT the only copy: the same expression still runs for
  // UNWRAPPED elements in `StackElement:39`, `TextElement:160` and `:204`,
  // `RichTextElement:159` and `TypewriterTextElement:303`.
  flexShrink:
    p.flexShrink ??
    (parentType === "XStack" && ROW_SHRINK_TYPES.has(elementType) ? 1 : undefined),
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
 * `flexShrink: 1` applies whether or not the box fills, and it is deliberate
 * rather than symmetry: the reference is the single authored box. Unwrapped, a
 * content-sized box in a row with a definite height is stretched to that height
 * and its content overflows; wrapped, only a shrink reproduces that, because
 * `0` lets the inner box keep its content height and overflow the wrapper.
 *
 * It also overrides the `?? (parentType === "XStack" ? 1 : undefined)` default
 * the element's own renderer would apply — which is the point, not a
 * side-effect. That default is about the ROW's main axis and this box's parent
 * is the wrapper (a column), so leaving the renderer to decide it would mean
 * the axis the value was chosen for and the axis it acts on are different.
 * An earlier revision wrote `0` here and justified it as "RN's own default, so
 * inert"; that was wrong — it suppressed a shrink that did act, vertically.
 */
// Frozen and shared: every call site inlines the result into a `style`, so a
// fresh object per call changes style identity on every render — and one of
// those call sites is `CarouselElement`, which re-renders per progress tick.
// There are only two possible results.
const FILL: NestedFillLayout = Object.freeze({ flexGrow: 1, flexShrink: 1 });
const NO_FILL: NestedFillLayout = Object.freeze({ flexGrow: undefined, flexShrink: 1 });

export const fillLayout = (fills: boolean): NestedFillLayout => (fills ? FILL : NO_FILL);

/**
 * Layout for the `onPress` wrapper. It faces the parent only when nothing else
 * wraps it; a motion wrapper is inserted outside it, and then the Pressable is
 * just another nested box.
 */
export const pressWrapperLayout = (
  p: BaseBoxProps,
  parentType: ParentType | undefined,
  elementType: string,
  hasMotionWrapper: boolean
): ParentFacingLayout | NestedFillLayout =>
  hasMotionWrapper
    ? nestedFillLayout(p)
    : parentFacingLayout(p, parentType, elementType);

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
// substitute: `fillLayout` stands in for it. Note the asymmetry that leaves: a
// per-state `flexGrow: 3` becomes the contract's `flexGrow: 1` on the inner box
// and never reaches the wrapper, so its factor is dropped — the wrapper is
// built from the base props and has no press state. That is not a regression
// (pre-PR a per-state flex landed on the element root and was equally inert on
// the parent's axis) and per-state SIZING is a shape nothing authors today, but
// it is the same "silently loses what the author wrote" objection that argues
// for keeping `alignSelf` below, and it is left open rather than pretended away.
// `alignSelf` deliberately stays —
// the wrapper is built from the BASE props and has no press state, so demoting
// a per-state `alignSelf` would drop it entirely rather than move it
// (`{ alignSelf: "stretch", pressedStyle: { alignSelf: "center" } }` narrows on
// touch-down). It only ever landed on the inner box, so leaving it is a
// no-change, and silently losing a prop the author wrote is the worse failure.
const NESTED_OVERRIDE_KEYS = ["pressedStyle", "disabledStyle"] as const;

const demoteOverride = (override: unknown): Record<string, unknown> | undefined => {
  if (!override || typeof override !== "object") return override as undefined;
  const o = override as BaseBoxProps;
  // Nothing to substitute for, so nothing is touched. Overwriting a per-state
  // `flexGrow`/`flexShrink` with the contract would drop the author's value the
  // same way demoting `alignSelf` did — the wrapper has no press state to move
  // it to.
  if (o.flex == null) return override as Record<string, unknown>;
  return {
    ...(override as Record<string, unknown>),
    flex: undefined,
    flexGrow: o.flexGrow ?? 1,
    flexShrink: o.flexShrink ?? 1,
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
    if (value != null) overrides[key] = demoteOverride(value);
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
