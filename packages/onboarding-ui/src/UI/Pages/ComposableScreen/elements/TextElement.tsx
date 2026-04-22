import React from "react";
import { z } from "zod";
import { Text } from "react-native";
import { UIElement } from "../types";
import { RenderContext, interpolate } from "./shared";

export type TextElementProps = {
  content: string;
  mode?: "plain" | "expression";
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  backgroundColor?: string;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
  opacity?: number;
};

export const TextElementPropsSchema = z.object({
  content: z.string(),
  mode: z.enum(["plain", "expression"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  backgroundColor: z.string().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

type TextUIElement = Extract<UIElement, { type: "Text" }>;

type Props = {
  element: TextUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack";
};

export const TextElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  const { theme, variables } = ctx;
  const content =
    element.props.mode === "expression"
      ? interpolate(element.props.content, variables)
      : element.props.content;

  return (
    <Text
      style={{
        fontSize: element.props.fontSize,
        fontWeight: element.props.fontWeight as any,
        fontFamily: element.props.fontFamily,
        color: element.props.color ?? theme.colors.text.primary,
        textAlign: element.props.textAlign,
        letterSpacing: element.props.letterSpacing,
        lineHeight: element.props.lineHeight,
        backgroundColor: element.props.backgroundColor,
        padding: element.props.padding,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        borderWidth: element.props.borderWidth,
        borderRadius: element.props.borderRadius,
        borderColor: element.props.borderColor,
        opacity: element.props.opacity,
        flexShrink: parentType === "XStack" ? 1 : undefined,
      }}
    >
      {content}
    </Text>
  );
};
