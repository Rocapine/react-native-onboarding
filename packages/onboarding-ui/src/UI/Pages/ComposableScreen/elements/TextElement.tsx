import React from "react";
import { z } from "zod";
import { Text } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, interpolate, dim } from "./shared";

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

  return (
    <Text
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
        fontSize: p.fontSize,
        fontWeight: p.fontWeight as any,
        fontFamily: p.fontFamily,
        color: p.color ?? theme.colors.text.primary,
        textAlign: p.textAlign,
        letterSpacing: p.letterSpacing,
        lineHeight: p.lineHeight,
        backgroundColor: p.backgroundColor,
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
      }}
    >
      {content}
    </Text>
  );
};
