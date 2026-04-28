import React from "react";
import { z } from "zod";
import { Text, TouchableOpacity } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";

export type ButtonElementProps = BaseBoxProps & {
  label: string;
  action?: "continue";
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
};

export const ButtonElementPropsSchema = BaseBoxPropsSchema.extend({
  label: z.string().min(1, "label must not be empty"),
  action: z.enum(["continue"]).optional(),
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
});

type ButtonUIElement = Extract<UIElement, { type: "Button" }>;

type Props = {
  element: ButtonUIElement;
  ctx: RenderContext;
};

export const ButtonElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, onContinue } = ctx;
  const action = element.props.action;
  const handlePress = () => {
    if (action === undefined || action === "continue") {
      onContinue();
    }
    // other action values are no-ops
  };
  const variant = element.props.variant ?? "filled";
  const isFilled = variant === "filled";
  const isOutlined = variant === "outlined";
  const bgColor = isFilled
    ? (element.props.backgroundColor ?? theme.colors.primary)
    : "transparent";
  const textColor = isFilled
    ? (element.props.color ?? theme.colors.text.opposite)
    : (element.props.color ?? theme.colors.primary);

  const hasGradient = isFilled && !!element.props.backgroundGradient;
  const borderRadius = element.props.borderRadius ?? 90;

  const labelNode = (
    <Text
      style={{
        color: textColor,
        fontSize: element.props.fontSize ?? theme.typography.textStyles.button.fontSize,
        fontWeight: (element.props.fontWeight as any) ?? theme.typography.textStyles.button.fontWeight,
        fontFamily: element.props.fontFamily,
        textAlign: element.props.textAlign ?? "center",
      }}
    >
      {element.props.label}
    </Text>
  );

  if (hasGradient) {
    return (
      <GradientBox
        gradient={element.props.backgroundGradient}
        style={{
          borderRadius,
          borderWidth: isOutlined ? (element.props.borderWidth ?? 1) : (element.props.borderWidth ?? 0),
          borderColor: isOutlined ? (element.props.borderColor ?? theme.colors.primary) : element.props.borderColor,
          width: dim(element.props.width),
          height: dim(element.props.height),
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          opacity: element.props.opacity,
          alignSelf: element.props.alignSelf ?? (element.props.width ? undefined : "stretch"),
          overflow: "hidden",
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePress}
          style={{
            flex: 1,
            padding: element.props.padding,
            paddingVertical: element.props.paddingVertical ?? 14,
            paddingHorizontal: element.props.paddingHorizontal ?? 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {labelNode}
        </TouchableOpacity>
      </GradientBox>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={{
        backgroundColor: bgColor,
        borderRadius,
        borderWidth: isOutlined ? (element.props.borderWidth ?? 1) : (element.props.borderWidth ?? 0),
        borderColor: isOutlined ? (element.props.borderColor ?? theme.colors.primary) : element.props.borderColor,
        padding: element.props.padding,
        paddingVertical: element.props.paddingVertical ?? 14,
        paddingHorizontal: element.props.paddingHorizontal ?? 24,
        width: dim(element.props.width),
        height: dim(element.props.height),
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        opacity: element.props.opacity,
        alignSelf: element.props.alignSelf ?? (element.props.width ? undefined : "stretch"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {labelNode}
    </TouchableOpacity>
  );
};
