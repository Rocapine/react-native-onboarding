import React from "react";
import { z } from "zod";
import { Text, TouchableOpacity } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext } from "./shared";

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
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch";
};

export const ButtonElementPropsSchema = BaseBoxPropsSchema.extend({
  label: z.string(),
  action: z.enum(["continue"]).optional(),
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  alignSelf: z.enum(["auto", "flex-start", "center", "flex-end", "stretch"]).optional(),
});

type ButtonUIElement = Extract<UIElement, { type: "Button" }>;

type Props = {
  element: ButtonUIElement;
  ctx: RenderContext;
};

export const ButtonElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, onContinue } = ctx;
  const variant = element.props.variant ?? "filled";
  const isFilled = variant === "filled";
  const isOutlined = variant === "outlined";
  const bgColor = isFilled
    ? (element.props.backgroundColor ?? theme.colors.primary)
    : "transparent";
  const textColor = isFilled
    ? (element.props.color ?? theme.colors.text.opposite)
    : (element.props.color ?? theme.colors.primary);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onContinue}
      style={{
        backgroundColor: bgColor,
        borderRadius: element.props.borderRadius ?? 90,
        borderWidth: isOutlined ? (element.props.borderWidth ?? 1) : (element.props.borderWidth ?? 0),
        borderColor: isOutlined ? (element.props.borderColor ?? theme.colors.primary) : element.props.borderColor,
        padding: element.props.padding,
        paddingVertical: element.props.paddingVertical ?? 14,
        paddingHorizontal: element.props.paddingHorizontal ?? 24,
        width: element.props.width,
        height: element.props.height,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        opacity: element.props.opacity,
        alignSelf: element.props.alignSelf ?? "stretch",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
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
    </TouchableOpacity>
  );
};
