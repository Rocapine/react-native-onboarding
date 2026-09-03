import React, { useEffect, useMemo, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  cancelAnimation,
  interpolate,
} from "react-native-reanimated";
import type { ElementAnimation, ElementTransform } from "@rocapine/react-native-onboarding";
import { buildEntering, buildExiting, buildLayout, EASING_MAP } from "./buildAnimation";
import { useVariables } from "./VariablesContext";
import { useEnteringLatch } from "./EnteringLatchContext";
import { decideEnteringPlay } from "./enteringLatch";
import { nestedFillLayout, type ParentFacingLayout } from "./wrapperLayout";

type Props = {
  animation?: ElementAnimation;
  transform?: ElementTransform;
  /**
   * The element's parent-facing layout, moved here because this wrapper is the
   * box the parent lays out (a trapped `flex`/`alignSelf` would otherwise break
   * the child's relationship to its parent). Built by `parentFacingLayout` in
   * `renderElement` — the element itself renders with it demoted, so this is
   * the only box carrying it.
   */
  outerLayout?: ParentFacingLayout;
  /**
   * Render the wrapper fully transparent. Used by `OnceAnimatedBox` to hold an
   * element invisible until its deferred entrance is released.
   *
   * Safe to apply here because it is only ever set while there is NO entering
   * builder on this view: the hold state strips `entering`, and releasing the
   * hold changes the key, so a fresh view mounts carrying the builder and no
   * `hidden`. The two never coexist and cannot fight over opacity.
   */
  hidden?: boolean;
  children: React.ReactNode;
};

// Build the static transform array (RN expects `[{translateX}, {scale}, ...]`).
// Typed `any[]`: RN's transform element is a strict per-key union that a
// programmatically-built array can't satisfy structurally, and the array is
// composed with animated entries inside the worklet below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildStaticTransform = (t?: ElementTransform): any[] => {
  if (!t) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: any[] = [];
  if (t.translateX != null) arr.push({ translateX: t.translateX });
  if (t.translateY != null) arr.push({ translateY: t.translateY });
  if (t.scale != null) arr.push({ scale: t.scale });
  if (t.scaleX != null) arr.push({ scaleX: t.scaleX });
  if (t.scaleY != null) arr.push({ scaleY: t.scaleY });
  if (t.rotate != null) arr.push({ rotate: `${t.rotate}deg` });
  return arr;
};

/**
 * Wraps a rendered UIElement in an `Animated.View` that owns its
 * entering/exiting/layout transitions (reanimated builders) and a continuous
 * `effect` (imperative `withRepeat`), plus any static `transform`.
 *
 * Injected by `renderElement` only when `animation` or `transform` is present.
 * All reanimated hooks are called unconditionally (rules of hooks) — the
 * effect-vs-no-effect branch lives inside the effect/worklet body.
 */
export const AnimatedBox = ({
  animation,
  transform,
  outerLayout,
  hidden,
  children,
}: Props): React.ReactElement => {
  // Memoize the reanimated builders on their (stable) spec objects. Rebuilding
  // them inline every render hands Animated.View a fresh `entering` instance,
  // which re-fires the entry transition on every re-render — e.g. an autoplay
  // ProgressIndicator writing its variable each step re-renders the whole tree,
  // restarting every sibling's entry animation. The spec objects come from the
  // memoized parsed step, so these references are stable across re-renders.
  const entering = useMemo(() => buildEntering(animation?.entering), [animation?.entering]);
  const exiting = useMemo(() => buildExiting(animation?.exiting), [animation?.exiting]);
  const layout = useMemo(() => buildLayout(animation?.layout), [animation?.layout]);

  const effect = animation?.effect;
  const staticTransform = useMemo(() => buildStaticTransform(transform), [transform]);

  // Continuous-effect driver (0 -> 1). Created unconditionally.
  const driver = useSharedValue(0);

  useEffect(() => {
    if (!effect) {
      cancelAnimation(driver);
      driver.value = 0;
      return;
    }
    driver.value = 0;
    // rotate spins one direction; the rest breathe back and forth.
    const reverse = effect.preset !== "rotate";
    const half = withTiming(1, {
      duration: effect.duration ?? 1000,
      easing: EASING_MAP[effect.easing ?? "ease-in-out"],
    });
    const repeated = withRepeat(half, effect.loop === false ? 1 : -1, reverse);
    driver.value = effect.delay ? withDelay(effect.delay, repeated) : repeated;
    return () => cancelAnimation(driver);
  }, [effect, driver]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!effect) return { transform: staticTransform };
    switch (effect.preset) {
      case "pulse":
        return {
          transform: [
            ...staticTransform,
            { scale: interpolate(driver.value, [0, 1], [effect.minScale ?? 0.95, effect.maxScale ?? 1.05]) },
          ],
        };
      case "fade":
        return {
          transform: staticTransform,
          opacity: interpolate(driver.value, [0, 1], [effect.minOpacity ?? 0.4, 1]),
        };
      case "rotate":
        return {
          transform: [
            ...staticTransform,
            { rotate: `${interpolate(driver.value, [0, 1], [0, effect.degrees ?? 360])}deg` },
          ],
        };
      case "bounce":
        return {
          transform: [...staticTransform, { translateY: interpolate(driver.value, [0, 1], [0, -10]) }],
        };
      case "shimmer":
        return {
          transform: staticTransform,
          opacity: interpolate(driver.value, [0, 1], [0.5, 1]),
        };
      default:
        return { transform: staticTransform };
    }
  }, [effect, staticTransform]);

  // Reanimated's entering/exiting/layout builders take over the host view's
  // transform for the duration of the transition — so a static `transform` (or
  // continuous `effect`) placed on the SAME view is suppressed until the entry
  // animation finishes, then snaps in. When a builder is present, split the two
  // onto nested views: the outer (parent-facing) view keeps `outerLayout` +
  // the reanimated builder, the inner view carries the static transform/effect
  // so it applies from frame 0 and persists. They stack instead of fighting.
  const hasBuilder = !!(animation?.entering || animation?.exiting || animation?.layout);

  if (!hasBuilder) {
    return (
      <Animated.View style={[outerLayout, animatedStyle, hidden ? { opacity: 0 } : null]}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      layout={layout}
      style={outerLayout}
    >
      {/* Fills the flexed outer wrapper; content-sized when the outer is. This
          is `flexGrow`, never `flex` — `flex` implies `flexBasis: 0`, so the
          outer wrapper's own auto height would measure 0 (#231). */}
      <Animated.View style={[animatedStyle, nestedFillLayout(outerLayout ?? {})]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
};

/**
 * `animation.replayWhen`: re-fires the entering animation when a variable's value
 * changes, WITHOUT the element having to disappear and come back.
 *
 * Reanimated runs an `entering` builder on mount only, so the sole way to replay
 * one is to remount — which previously meant toggling `renderWhen`, coupling
 * "animate again" to "change visibility". This derives the wrapper's React key
 * from the watched value, so a write remounts the subtree and the entrance runs
 * again while the element stays on screen throughout.
 *
 * Split into its own component rather than calling `useVariables()` inside
 * `AnimatedBox`, for the same reason Text and Image are split: a context
 * subscription bypasses React.memo, so subscribing in the shared component would
 * re-render EVERY animated element on EVERY variable write. Only elements that
 * actually opt into `replayWhen` pay for it.
 */
export const ReplayingAnimatedBox = ({
  replayWhen,
  replayKeyPrefix,
  ...boxProps
}: Props & { replayWhen: string; replayKeyPrefix: string }): React.ReactElement => {
  const { variables } = useVariables();
  // `label` is irrelevant here — any change to the underlying value should
  // replay, and two different labels for one value are the same state.
  const token = variables[replayWhen]?.value ?? "";
  return <AnimatedBox key={`${replayKeyPrefix}::${token}`} {...boxProps} />;
};

/**
 * `animation.entering.once`: play the entrance exactly once per screen lifetime,
 * deferring an initial-mount play until the screen has settled.
 *
 * Two bugs live here, both caused by `renderWhen` visibility being mount/unmount
 * (a false gate returns `null`) while reanimated fires `entering` on mount:
 *
 *  • a gated element replays its entrance every time the gate flips back true —
 *    swipe away from a carousel slide and back and the decorations animate again;
 *  • an element visible at the screen's initial mount burns its entrance during
 *    the host's push transition, before remote images have even decoded.
 *
 * `playedAtMount` is sampled ONCE per mount into a ref and never re-read. That
 * is load-bearing: `markPlayed` runs while the animation is in flight, and if the
 * decision were re-derived on a later re-render it would flip to "already
 * played", change the key, remount the element and cut the animation off. The
 * latch is a plain Set for the same reason — nothing about it is reactive.
 */
export const OnceAnimatedBox = ({
  elementId,
  animation,
  ...boxProps
}: Props & { elementId: string }): React.ReactElement => {
  const { latch, settled } = useEnteringLatch();

  const playedAtMountRef = useRef<boolean | null>(null);
  if (playedAtMountRef.current === null) {
    playedAtMountRef.current = latch.hasPlayed(elementId);
  }

  const { playEntering, hidden, keySuffix } = decideEnteringPlay(
    playedAtMountRef.current,
    settled
  );

  useEffect(() => {
    if (playEntering) latch.markPlayed(elementId);
  }, [playEntering, latch, elementId]);

  // Strip `entering` when not playing. `exiting`/`layout`/`effect` are untouched
  // — `once` is a statement about the entrance only.
  //
  // `hidden` is what separates the two non-playing states. Both strip `entering`,
  // but "already played" must render VISIBLE and "still holding" must render
  // INVISIBLE. Without it a held element sat at full opacity — so the entrance
  // was never seen — and then blinked to 0 and re-faded when the hold released.
  const effective = playEntering
    ? animation
    : animation && { ...animation, entering: undefined };

  return (
    <AnimatedBox
      key={`${elementId}::${keySuffix}`}
      animation={effective}
      hidden={hidden}
      {...boxProps}
    />
  );
};
