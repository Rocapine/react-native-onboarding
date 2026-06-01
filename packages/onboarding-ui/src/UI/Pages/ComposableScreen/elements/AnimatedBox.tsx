import React, { useEffect, useMemo } from "react";
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

type Props = {
  animation?: ElementAnimation;
  transform?: ElementTransform;
  // Layout props forwarded from the child so the extra wrapper stays
  // layout-transparent (a trapped `flex`/`alignSelf` would otherwise break
  // the child's relationship to its parent).
  flex?: number;
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
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
  flex,
  alignSelf,
  children,
}: Props): React.ReactElement => {
  const entering = buildEntering(animation?.entering);
  const exiting = buildExiting(animation?.exiting);
  const layout = buildLayout(animation?.layout);

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

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      layout={layout}
      style={[{ flex, alignSelf }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
};
