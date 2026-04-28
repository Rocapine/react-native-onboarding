import React from "react";
import { z } from "zod";
import { Text } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, interpolate, dim } from "./shared";
import { GradientBox } from "./GradientBox";

export type TextElementProps = BaseBoxProps & {
  content: string;
  mode?: "plain" | "expression";
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export const TextElementPropsSchema = BaseBoxPropsSchema.extend({
  content: z.string(),
  mode: z.enum(["plain", "expression"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

type TextUIElement = Extract<UIElement, { type: "Text" }>;

type Props = {
  element: TextUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack";
};

export const TextElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  const { theme, variables } = ctx;
  const p = element.props;
  const content =
    p.mode === "expression"
      ? interpolate(p.content, variables)
      : p.content;

  const textNode = (
    <Text
      style={{
        flex: p.backgroundGradient ? 1 : p.flex,
        flexShrink: p.backgroundGradient ? undefined : (p.flexShrink ?? (parentType === "XStack" ? 1 : undefined)),
        flexGrow: p.backgroundGradient ? undefined : p.flexGrow,
        alignSelf: p.backgroundGradient ? undefined : p.alignSelf,
        width: p.backgroundGradient ? undefined : dim(p.width),
        height: p.backgroundGradient ? undefined : dim(p.height),
        minWidth: p.backgroundGradient ? undefined : p.minWidth,
        maxWidth: p.backgroundGradient ? undefined : p.maxWidth,
        minHeight: p.backgroundGradient ? undefined : p.minHeight,
        maxHeight: p.backgroundGradient ? undefined : p.maxHeight,
        fontSize: p.fontSize,
        fontWeight: p.fontWeight as any,
        fontFamily: p.fontFamily,
        color: p.color ?? theme.colors.text.primary,
        textAlign: p.textAlign,
        letterSpacing: p.letterSpacing,
        lineHeight: p.lineHeight,
        backgroundColor: p.backgroundGradient ? undefined : p.backgroundColor,
        padding: p.backgroundGradient ? undefined : p.padding,
        paddingHorizontal: p.backgroundGradient ? undefined : p.paddingHorizontal,
        paddingVertical: p.backgroundGradient ? undefined : p.paddingVertical,
        margin: p.backgroundGradient ? undefined : p.margin,
        marginHorizontal: p.backgroundGradient ? undefined : p.marginHorizontal,
        marginVertical: p.backgroundGradient ? undefined : p.marginVertical,
        borderWidth: p.backgroundGradient ? undefined : p.borderWidth,
        borderRadius: p.backgroundGradient ? undefined : p.borderRadius,
        borderColor: p.backgroundGradient ? undefined : p.borderColor,
        opacity: p.backgroundGradient ? undefined : p.opacity,
      }}
    >
      {content}
    </Text>
  );

  if (p.backgroundGradient) {
    return (
      <GradientBox
        gradient={p.backgroundGradient}
        style={{
          flex: p.flex,
          flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
          flexGrow: p.flexGrow,
          alignSelf: p.alignSelf,
          width: dim(p.width),
          height: dim(p.height),
          minWidth: p.minWidth,
          maxWidth: p.maxWidth,
          minHeight: p.minHeight,
          maxHeight: p.maxHeight,
          padding: p.padding,
          paddingHorizontal: p.paddingHorizontal,
          paddingVertical: p.paddingVertical,
          margin: p.margin,
          marginHorizontal: p.marginHorizontal,
          marginVertical: p.marginVertical,
          borderWidth: p.borderWidth,
          borderRadius: p.borderRadius,
          borderColor: p.borderColor,
          opacity: p.opacity,
          overflow: "hidden",
        }}
      >
        {textNode}
      </GradientBox>
    );
  }

  return textNode;
};
