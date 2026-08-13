import React, { useEffect, useRef } from "react";
import { View, TextInput } from "react-native";
import { z } from "zod";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withRepeat,
  withDelay,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { useVariables } from "./VariablesContext";
import { useAnimatedVariables } from "./AnimatedVariablesContext";
import { EASING_MAP } from "./buildAnimation";

export type ProgressEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type ProgressIndicatorElementProps = BaseBoxProps & {
  variant?: "linear" | "circular";
  variableName?: string;
  value?: number;
  autoplay?: boolean;
  loop?: boolean;
  initialValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  labelSuffix?: string;
  duration?: number;
  delay?: number;
  easing?: ProgressEasing;
  color?: string;
  trackColor?: string;
  thickness?: number;
  size?: number;
  showLabel?: boolean;
  labelColor?: string;
};

const ProgressEasingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]);

export const ProgressIndicatorElementPropsSchema = BaseBoxPropsSchema.extend({
  variant: z.enum(["linear", "circular"]).optional(),
  variableName: z.string().min(1).optional(),
  value: z.number().optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  initialValue: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().gt(0).optional(),
  labelSuffix: z.string().optional(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: ProgressEasingSchema.optional(),
  color: z.string().optional(),
  trackColor: z.string().optional(),
  thickness: z.number().min(0).optional(),
  size: z.number().min(0).optional(),
  showLabel: z.boolean().optional(),
  labelColor: z.string().optional(),
});

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// Native TextInput label driven from a worklet (like AnimatedText) so the
// `showLabel` value updates on the UI thread with NO React re-render — a
// `useState` label would re-render this component on every step hop and churn
// the reanimated mapper scheduler (destabilizing other on-screen animations).
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

type ProgressUIElement = Extract<UIElement, { type: "ProgressIndicator" }>;

type Props = {
  element: ProgressUIElement;
  ctx: RenderContext;
};

export const ProgressIndicatorElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, setVariable } = ctx;
  const { variables } = useVariables();
  const animatedVariables = useAnimatedVariables();
  const { props } = element;

  const variant = props.variant ?? "linear";
  const minValue = props.minValue ?? 0;
  const maxValue = props.maxValue ?? 100;
  const range = maxValue - minValue;
  const step = props.step && props.step > 0 ? props.step : 1;
  const labelSuffix = props.labelSuffix ?? "%";
  const initialValue = clamp(props.initialValue ?? minValue, minValue, maxValue);
  const duration = props.duration ?? 1000;
  const delay = props.delay ?? 0;
  const easing = EASING_MAP[props.easing ?? "ease-in-out"];
  const autoplay = props.autoplay ?? false;
  const loop = props.loop ?? false;

  const color = props.color ?? theme.colors.primary;
  const trackColor = props.trackColor ?? theme.colors.neutral.lower;
  const labelColor = props.labelColor ?? theme.colors.text.primary;

  // Bound variable value (input mode, non-autoplay) or static value. `progress`
  // is the value in [minValue, maxValue]; the fill fraction is derived from it.
  const boundRaw = props.variableName ? variables[props.variableName]?.value : undefined;
  const boundValue = boundRaw !== undefined ? clamp(Number(boundRaw) || 0, minValue, maxValue) : undefined;
  const target = autoplay ? maxValue : clamp(boundValue ?? props.value ?? initialValue, minValue, maxValue);

  // (autoplay) Seed from the persisted bound variable at mount, NOT always from
  // initialValue. The variable store lives in a provider that can sit ABOVE a
  // Suspense boundary, so if the screen subtree remounts (e.g. a parent query
  // re-suspends on a locale change) the variable survives but this local
  // sharedValue would otherwise reset to 0 — desyncing a completed bar's fill
  // from its already-at-max variable (and any `renderWhen: eq max` checkmark
  // that stays visible). Captured once per mount in a ref so the per-step
  // variable writes this bar makes don't feed back into the seed.
  const autoplaySeedRef = useRef(
    autoplay && boundValue !== undefined ? boundValue : initialValue
  );
  const progress = useSharedValue(autoplaySeedRef.current);

  // (autoplay) Write the bound variable ONLY at the sweep boundaries (start /
  // completion) — NOT on every step. Writing each step calls setVariable ~20×/s,
  // which re-renders every ComposableScreen variable consumer. On Fabric /
  // Reanimated 4 that re-render storm reverts the *already-settled* animated
  // fill of sibling bars that finished earlier: their value stays at max but the
  // bar paints empty, and only the last-finishing bar (after which no more
  // writes occur) stays filled — the staggered-loader bug. Boundaries are all a
  // bound variable needs for the common `renderWhen` loader pattern
  // (`lt max` label → `eq max` checkmark); the live numeric % is rendered
  // natively from the shared value (labelAnimatedProps), independent of writes.
  // Trade-off: a consumer interpolating the variable mid-sweep ({{var}}) sees it
  // jump min→max — use `showLabel` for a live readout instead.
  const showLabel = props.showLabel ?? false;
  const variableName = props.variableName;
  const writeVariable = (v: number) => {
    if (autoplay && variableName) {
      setVariable(variableName, { value: String(v), kind: Number.isInteger(v) ? "int" : "float" });
    }
  };
  const writesVariable = autoplay && !!variableName;

  // Publish the live sweep as a screen-scoped animated variable so `renderWhen`
  // consumers on this screen can evaluate threshold conditions against it on the
  // UI thread (see GatedElement) — WITHOUT the store writes that the boundary-only
  // guard above deliberately avoids. Only an autoplay producer registers; a
  // bound/static bar is a store consumer, not a live animator. Purely additive:
  // the boundary store writes above are unchanged.
  useEffect(() => {
    if (!writesVariable || !variableName) return;
    animatedVariables.register(variableName, progress);
    return () => animatedVariables.unregister(variableName);
  }, [writesVariable, variableName, animatedVariables, progress]);

  // The dependency array is REQUIRED. Without it reanimated tears down and
  // rebuilds this mapper on EVERY render, resetting `prev` to undefined and
  // defeating the `snapped === prev` guard so the JS callback over-fires.
  // Keying on the values the worklet branches on (minValue/maxValue/step) keeps
  // the mapper stable; the JS fn it calls (setVariable via writeVariable) is
  // already stable across renders.
  useAnimatedReaction(
    () => {
      // Inline snap (worklet — can't call the JS `snap` closure). Captures the
      // primitive minValue/maxValue/step (re-keyed via the deps array below).
      const snapped = minValue + Math.round((progress.value - minValue) / step) * step;
      return Math.max(minValue, Math.min(maxValue, snapped));
    },
    (snapped, prev) => {
      if (snapped === prev) return;
      // Boundaries only — see the writeVariable comment above. Intermediate
      // steps are intentionally dropped to avoid the per-step re-render storm.
      if (writesVariable && (snapped <= minValue || snapped >= maxValue)) {
        runOnJS(writeVariable)(snapped);
      }
    },
    [writesVariable, variableName, minValue, maxValue, step]
  );

  // Native label text, formatted on the UI thread (snapped value + suffix).
  // Mirrors AnimatedText: returns `defaultValue` too so a re-render reconcile
  // can't revert the uncontrolled TextInput to a stale mount-time value.
  const labelAnimatedProps = useAnimatedProps(() => {
    const snapped = Math.max(
      minValue,
      Math.min(maxValue, minValue + Math.round((progress.value - minValue) / step) * step)
    );
    const t = `${snapped}${labelSuffix}`;
    return { text: t, defaultValue: t } as object;
  }, [minValue, maxValue, step, labelSuffix]);

  // Autoplay: animate seed -> maxValue, optionally looping, after `delay`.
  // `seed` is the mount-time value (persisted variable on a remount, else
  // initialValue) — see autoplaySeedRef above. A bar already at maxValue (a
  // completed bar restored after a remount) stays full and does NOT replay its
  // sweep; a partially-filled bar resumes from where it was rather than from 0.
  useEffect(() => {
    if (!autoplay) return;
    const seed = autoplaySeedRef.current;
    progress.value = seed;
    if (seed >= maxValue) return () => cancelAnimation(progress);
    const anim = withTiming(maxValue, { duration, easing });
    const looped = loop ? withRepeat(anim, -1, false) : anim;
    progress.value = delay > 0 ? withDelay(delay, looped) : looped;
    return () => cancelAnimation(progress);
  }, [autoplay, loop, duration, delay, easing, maxValue]);

  // Bound / static (non-autoplay): animate toward the current target after `delay`.
  useEffect(() => {
    if (autoplay) return;
    const anim = withTiming(target, { duration, easing });
    progress.value = delay > 0 ? withDelay(delay, anim) : anim;
    return () => cancelAnimation(progress);
  }, [autoplay, target, duration, delay, easing]);

  // Circular geometry (computed unconditionally so hooks below stay unconditional).
  const size = props.size ?? 120;
  const strokeWidth = props.thickness ?? 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Explicit deps arrays (same reason as the useAnimatedReaction above). An
  // autoplay ProgressIndicator writes its variable every step → setVariable
  // re-renders the whole tree ~20×/s; without deps these mappers are torn down
  // and rebuilt on every one of those renders, needlessly churning the
  // UI-thread mapper scheduler. Keying on the primitives the worklet reads keeps
  // each mapper stable across renders.
  const animatedCircleProps = useAnimatedProps(() => {
    const frac = range > 0 ? (progress.value - minValue) / range : 0;
    return { strokeDashoffset: circumference * (1 - frac) };
  }, [range, minValue, circumference]);
  // Drive the linear fill with a `scaleX` transform anchored to the left edge —
  // NOT an animated percentage `width`. On Fabric / Reanimated 4 an animated
  // layout prop (percentage width) updates the sharedValue every frame but does
  // not reliably commit to layout, so the bar's *static* mount value paints but
  // the per-frame sweep does not — the value reaches 100 (the bound variable +
  // any `eq max` checkmark update fine) while the bar stays visually empty. A
  // transform is GPU-driven, commits every frame, and has no such limitation.
  const animatedFillStyle = useAnimatedStyle(() => {
    const frac = range > 0 ? (progress.value - minValue) / range : 0;
    const clamped = frac < 0 ? 0 : frac > 1 ? 1 : frac;
    return { transform: [{ scaleX: clamped }] };
  }, [range, minValue]);

  const containerStyle = {
    alignSelf: props.alignSelf,
    flex: props.flex,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    width: dim(props.width),
    height: dim(props.height),
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    opacity: props.opacity,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
  } as const;

  if (variant === "circular") {
    return (
      <View style={[containerStyle, { width: size, height: size, alignItems: "center", justifyContent: "center" }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedCircleProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        {props.showLabel ? (
          <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
            <AnimatedTextInput
              editable={false}
              pointerEvents="none"
              caretHidden
              contextMenuHidden
              underlineColorAndroid="transparent"
              accessibilityRole="text"
              animatedProps={labelAnimatedProps}
              style={{
                padding: 0,
                includeFontPadding: false,
                textAlign: "center",
                color: labelColor,
                fontSize: theme.typography.textStyles.heading2.fontSize,
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.textStyles.heading2.fontFamily,
              }}
            />
          </View>
        ) : null}
      </View>
    );
  }

  // Linear variant
  const barHeight = props.thickness ?? 8;

  return (
    <View style={[containerStyle, { width: dim(props.width) ?? "100%", flexDirection: "row", alignItems: "center" }]}>
      <View
        style={{
          flex: 1,
          height: barHeight,
          backgroundColor: trackColor,
          borderRadius: props.borderRadius ?? barHeight / 2,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              width: "100%",
              height: "100%",
              backgroundColor: color,
              borderRadius: props.borderRadius ?? barHeight / 2,
              transformOrigin: "left",
            },
            animatedFillStyle,
          ]}
        />
      </View>
      {props.showLabel ? (
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          caretHidden
          contextMenuHidden
          underlineColorAndroid="transparent"
          accessibilityRole="text"
          animatedProps={labelAnimatedProps}
          style={{
            padding: 0,
            includeFontPadding: false,
            marginLeft: 12,
            color: labelColor,
            fontSize: theme.typography.textStyles.label.fontSize,
            fontWeight: theme.typography.fontWeight.semibold,
            fontFamily: theme.typography.textStyles.label.fontFamily,
            minWidth: 44,
            textAlign: "right",
          }}
        />
      ) : null}
    </View>
  );
};
