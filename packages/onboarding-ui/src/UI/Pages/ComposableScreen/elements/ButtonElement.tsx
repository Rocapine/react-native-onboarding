import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Animated, Pressable, Text } from "react-native";
import {
  useResolvedFontStyle,
  evaluateCondition,
  type LeafCondition,
  type ConditionGroup,
  LeafConditionSchema,
  ConditionGroupSchema,
} from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, buildShadowStyle, dim, resolveInheritedFontFamily } from "./shared";
import { GradientBox } from "./GradientBox";
import { triggerHaptic, type HapticStyle } from "./haptics";
import {
  type ButtonAction,
  ButtonActionSchema,
} from "./actions";
import { runActions } from "./runActions";

// `ButtonAction` and its variants live in `./actions` (shared with the generic
// `onPress` on BaseBoxProps). Re-exported for back-compat.
export {
  type CustomButtonAction,
  CustomButtonActionSchema,
  type SetVariableButtonAction,
  SetVariableButtonActionSchema,
} from "./actions";
export type { ButtonAction };
export { ButtonActionSchema };

type ButtonOverridableProps = BaseBoxProps & {
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
};

export type ButtonStyleOverride = Partial<ButtonOverridableProps>;

export type ButtonElementProps = BaseBoxProps & {
  label: string;
  actions?: ButtonAction[];
  /** @deprecated Use `actions` instead. */
  action?: "continue";
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  disabledWhen?: LeafCondition | ConditionGroup;
  /** @deprecated Use `disabledStyle.backgroundColor`. */
  disabledBackgroundColor?: string;
  /** @deprecated Use `disabledStyle.color`. */
  disabledColor?: string;
  pressedStyle?: ButtonStyleOverride;
  disabledStyle?: ButtonStyleOverride;
  transitionDurationMs?: number;
  haptic?: HapticStyle;
};

export const ButtonStyleOverrideSchema = BaseBoxPropsSchema.extend({
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
}).partial();

export const ButtonElementPropsSchema = BaseBoxPropsSchema.extend({
  label: z.string().min(1, "label must not be empty"),
  actions: z.array(ButtonActionSchema).optional(),
  action: z.enum(["continue"]).optional(),
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  disabledWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
  disabledBackgroundColor: z.string().optional(),
  disabledColor: z.string().optional(),
  pressedStyle: ButtonStyleOverrideSchema.optional(),
  disabledStyle: ButtonStyleOverrideSchema.optional(),
  transitionDurationMs: z.number().min(0).optional(),
  haptic: z.enum(["none", "light", "medium", "heavy", "soft", "rigid"]).optional(),
});

type ButtonUIElement = Extract<UIElement, { type: "Button" }>;

type Props = {
  element: ButtonUIElement;
  ctx: RenderContext;
};

export const ButtonElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const isDisabled = element.props.disabledWhen
    ? evaluateCondition(element.props.disabledWhen, ctx.flatVariables)
    : false;
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = async () => {
    if (isDisabled) return;
    triggerHaptic(element.props.haptic);
    const { actions, action } = element.props;
    const effective: ButtonAction[] =
      actions ?? (action === "continue" ? ["continue"] : []);
    await runActions(effective, ctx);
  };

  // State overrides are merged over base props. disabledStyle wins over the
  // deprecated `disabledBackgroundColor`/`disabledColor` fields; falls back to
  // those when only the legacy fields are set.
  const stateOverride: ButtonStyleOverride = isDisabled
    ? (element.props.disabledStyle ?? {})
    : isPressed
      ? (element.props.pressedStyle ?? {})
      : {};
  const eff = { ...element.props, ...stateOverride };

  const variant = eff.variant ?? "filled";
  const isFilled = variant === "filled";
  const isOutlined = variant === "outlined";

  const legacyDisabledBg =
    isDisabled && !element.props.disabledStyle
      ? (element.props.disabledBackgroundColor ?? theme.colors.disable)
      : undefined;
  const legacyDisabledText =
    isDisabled && !element.props.disabledStyle
      ? (element.props.disabledColor ?? theme.colors.text.disable)
      : undefined;

  const bgColor = isDisabled
    ? isFilled
      ? (eff.backgroundColor ?? legacyDisabledBg ?? theme.colors.disable)
      : "transparent"
    : isFilled
      ? (eff.backgroundColor ?? theme.colors.primary)
      : "transparent";
  const textColor = isDisabled
    ? (eff.color ?? legacyDisabledText ?? theme.colors.text.disable)
    : isFilled
      ? (eff.color ?? theme.colors.text.opposite)
      : (eff.color ?? theme.colors.primary);
  const outlinedBorderColor = isDisabled
    ? (eff.borderColor ?? legacyDisabledBg ?? theme.colors.disable)
    : (eff.borderColor ?? theme.colors.primary);

  const hasGradient = isFilled && !isDisabled && !!eff.backgroundGradient;
  // Gradient path nests GradientBox + Pressable inside the outer box. Those
  // inner views must only `flex: 1` to fill an explicitly-sized button (height
  // or flex set). Otherwise the button is content-sized (like the non-gradient
  // path) and a `flex: 1` inner view would grab the parent's full main-axis —
  // blowing the button up to fill the screen inside a ZStack/flex container.
  const gradientFillsParent =
    eff.height != null || eff.flex != null || eff.flexGrow != null;
  const borderRadius = eff.borderRadius ?? 90;
  const inheritedFontFamily = resolveInheritedFontFamily(
    eff.fontFamily,
    theme.typography.defaultFontFamily
  );
  const resolvedFont = useResolvedFontStyle(
    inheritedFontFamily,
    eff.fontWeight,
    eff.fontStyle
  );

  // Animate opacity between rest/pressed/disabled. Uses native driver — color
  // and shadow* changes apply instantly on state transition (acceptable for
  // tap-feedback timescales). transitionDurationMs gates animation length.
  const opacityAnim = useRef(new Animated.Value(eff.opacity ?? 1)).current;
  const duration = element.props.transitionDurationMs ?? 150;
  const restOpacity = element.props.opacity ?? 1;
  const pressedOpacity = element.props.pressedStyle?.opacity ?? 0.8;
  const disabledOpacity =
    element.props.disabledStyle?.opacity ?? element.props.opacity ?? 1;
  const targetOpacity = isDisabled
    ? disabledOpacity
    : isPressed
      ? pressedOpacity
      : restOpacity;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: targetOpacity,
      duration,
      useNativeDriver: true,
    }).start();
  }, [targetOpacity, duration, opacityAnim]);

  const shadowStyle = buildShadowStyle(eff);

  const labelNode = (
    <Text
      style={{
        color: textColor,
        fontSize: eff.fontSize ?? theme.typography.textStyles.button.fontSize,
        fontWeight: resolvedFont.resolvedToVariant
          ? undefined
          : ((resolvedFont.fontWeight as any) ?? theme.typography.textStyles.button.fontWeight),
        fontFamily: resolvedFont.fontFamily,
        fontStyle: eff.fontStyle,
        textAlign: eff.textAlign ?? "center",
      }}
    >
      {element.props.label}
    </Text>
  );

  const onPressIn = () => setIsPressed(true);
  const onPressOut = () => setIsPressed(false);

  if (hasGradient) {
    return (
      <Animated.View
        style={{
          ...shadowStyle,
          opacity: opacityAnim,
          flex: eff.flex,
          flexShrink: eff.flexShrink,
          flexGrow: eff.flexGrow,
          width: dim(eff.width),
          height: dim(eff.height),
          margin: eff.margin,
          marginHorizontal: eff.marginHorizontal,
          marginVertical: eff.marginVertical,
          alignSelf: eff.alignSelf ?? (eff.width ? undefined : "stretch"),
          borderRadius,
        }}
      >
        <GradientBox
          gradient={eff.backgroundGradient}
          style={{
            borderRadius,
            borderWidth: isOutlined ? (eff.borderWidth ?? 1) : (eff.borderWidth ?? 0),
            borderColor: isOutlined ? outlinedBorderColor : eff.borderColor,
            overflow: "hidden",
            flex: gradientFillsParent ? 1 : undefined,
          }}
        >
          <Pressable
            onPress={handlePress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isDisabled}
            style={{
              flex: gradientFillsParent ? 1 : undefined,
              padding: eff.padding,
              paddingVertical: eff.paddingVertical ?? (eff.padding != null ? undefined : 14),
              paddingHorizontal: eff.paddingHorizontal ?? (eff.padding != null ? undefined : 24),
              justifyContent: "center",
            }}
          >
            {labelNode}
          </Pressable>
        </GradientBox>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        ...shadowStyle,
        opacity: opacityAnim,
        backgroundColor: bgColor,
        borderRadius,
        borderWidth: isOutlined ? (eff.borderWidth ?? 1) : (eff.borderWidth ?? 0),
        borderColor: isOutlined ? outlinedBorderColor : eff.borderColor,
        flex: eff.flex,
        flexShrink: eff.flexShrink,
        flexGrow: eff.flexGrow,
        width: dim(eff.width),
        height: dim(eff.height),
        margin: eff.margin,
        marginHorizontal: eff.marginHorizontal,
        marginVertical: eff.marginVertical,
        alignSelf: eff.alignSelf ?? (eff.width ? undefined : "stretch"),
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={{
          padding: eff.padding,
          paddingVertical: eff.paddingVertical ?? (eff.padding != null ? undefined : 14),
          paddingHorizontal: eff.paddingHorizontal ?? (eff.padding != null ? undefined : 24),
          justifyContent: "center",
          borderRadius,
        }}
      >
        {labelNode}
      </Pressable>
    </Animated.View>
  );
};
