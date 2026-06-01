import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
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
import { EASING_MAP } from "./buildAnimation";

export type ProgressEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type ProgressIndicatorElementProps = BaseBoxProps & {
  variant?: "linear" | "circular";
  variableName?: string;
  value?: number;
  autoplay?: boolean;
  loop?: boolean;
  initialValue?: number;
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
  value: z.number().min(0).max(100).optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  initialValue: z.number().min(0).max(100).optional(),
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

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

type ProgressUIElement = Extract<UIElement, { type: "ProgressIndicator" }>;

type Props = {
  element: ProgressUIElement;
  ctx: RenderContext;
};

export const ProgressIndicatorElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  const { props } = element;

  const variant = props.variant ?? "linear";
  const initialValue = clamp(props.initialValue ?? 0);
  const duration = props.duration ?? 1000;
  const delay = props.delay ?? 0;
  const easing = EASING_MAP[props.easing ?? "ease-in-out"];
  const autoplay = props.autoplay ?? false;
  const loop = props.loop ?? false;

  const color = props.color ?? theme.colors.primary;
  const trackColor = props.trackColor ?? theme.colors.neutral.lower;
  const labelColor = props.labelColor ?? theme.colors.text.primary;

  // Bound variable value (input mode, non-autoplay) or static value.
  const boundRaw = props.variableName ? variables[props.variableName]?.value : undefined;
  const boundValue = boundRaw !== undefined ? clamp(Number(boundRaw) || 0) : undefined;
  const target = autoplay ? 100 : clamp(boundValue ?? props.value ?? initialValue);

  const progress = useSharedValue(initialValue);
  const [percentage, setPercentage] = useState(Math.round(initialValue));

  // Mirror the animated value into a label + (autoplay) the bound variable.
  // Reaction input is the *rounded* percent, so the JS callback fires only when
  // the integer changes (≤100 hops/sweep) rather than every frame — avoids a
  // per-frame context write storm (setVariable re-renders all variable consumers).
  const showLabel = props.showLabel ?? false;
  const variableName = props.variableName;
  const writeVariable = (v: number) => {
    if (autoplay && variableName) {
      setVariable(variableName, { value: String(v), kind: "int" });
    }
  };
  const writesVariable = autoplay && !!variableName;
  useAnimatedReaction(
    () => Math.round(progress.value),
    (rounded, prev) => {
      if (rounded === prev) return;
      if (showLabel) runOnJS(setPercentage)(rounded);
      if (writesVariable) runOnJS(writeVariable)(rounded);
    }
  );

  // Autoplay: animate initialValue -> 100, optionally looping, after `delay`.
  useEffect(() => {
    if (!autoplay) return;
    progress.value = initialValue;
    const anim = withTiming(100, { duration, easing });
    const looped = loop ? withRepeat(anim, -1, false) : anim;
    progress.value = delay > 0 ? withDelay(delay, looped) : looped;
    return () => cancelAnimation(progress);
  }, [autoplay, loop, duration, delay, easing, initialValue]);

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

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));
  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

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
            <Text
              style={{
                color: labelColor,
                fontSize: theme.typography.textStyles.heading2.fontSize,
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.textStyles.heading2.fontFamily,
              }}
            >
              {percentage}%
            </Text>
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
            { height: "100%", backgroundColor: color, borderRadius: props.borderRadius ?? barHeight / 2 },
            animatedFillStyle,
          ]}
        />
      </View>
      {props.showLabel ? (
        <Text
          style={{
            marginLeft: 12,
            color: labelColor,
            fontSize: theme.typography.textStyles.label.fontSize,
            fontWeight: theme.typography.fontWeight.semibold,
            fontFamily: theme.typography.textStyles.label.fontFamily,
            minWidth: 44,
            textAlign: "right",
          }}
        >
          {percentage}%
        </Text>
      ) : null}
    </View>
  );
};
