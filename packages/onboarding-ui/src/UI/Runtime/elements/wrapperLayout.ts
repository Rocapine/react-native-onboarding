import type { UIElement } from "../types";
import type { BaseBoxProps } from "./BaseBoxProps";

type ParentType = "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";

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
 * over whatever followed it while its row reserved nothing. Web does not show it
 * because CSS gives flex items an automatic content-based minimum size
 * (`min-height: auto`) and Yoga does not.
 *
 * The split, in one place for every wrapper present and future:
 *
 * - **Parent-facing props** (`flex`, `flexGrow`, `flexShrink`, `alignSelf`)
 *   describe how the box relates to its PARENT, so they belong on the OUTERMOST
 *   box only — that is the one the parent lays out.
 * - Every box **below** it gets `flexGrow: 1` instead, and only if the element
 *   asked for flex sizing at all. `flexGrow` keeps `flexBasis: auto`, so a
 *   nested box fills a parent-facing box that got a definite main size, and
 *   content-sizes one that did not. That is the same intent the doubled `flex`
 *   had (an inner view filling a flexed outer) without the zero basis.
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
};

type FlexSizingProps = Pick<BaseBoxProps, "flex" | "flexGrow">;

/**
 * Did the author ask this element to be sized by its parent's flex line? Also
 * the predicate several renderers gate an internal fill on (the gradient-fork
 * rule in `.claude/rules/composable-screen-runtime.md`), which is why the
 * demotion below substitutes `flexGrow` for `flex` rather than dropping it.
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

export const nestedFillLayout = (p: FlexSizingProps): NestedFillLayout => ({
  flexGrow: wantsFlexSizing(p) ? 1 : undefined,
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
export const withNestedLayout = <T extends UIElement>(element: T): T => {
  const cached = nestedCache.get(element);
  if (cached) return cached as T;
  const p = element.props as BaseBoxProps;
  const nested = {
    ...element,
    props: {
      ...element.props,
      flex: undefined,
      ...nestedFillLayout(p),
      // RN's own default, stated explicitly: the renderers that default
      // `flexShrink` to 1 under an `XStack` parent must not re-add a second
      // shrink here, since the wrapper is the box the row lays out.
      flexShrink: 0,
      alignSelf: undefined,
    },
  } as unknown as T;
  nestedCache.set(element, nested);
  return nested;
};
