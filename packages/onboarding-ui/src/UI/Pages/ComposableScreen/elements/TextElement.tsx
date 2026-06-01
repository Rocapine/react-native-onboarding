import React from "react";
import { z } from "zod";
import { Text } from "react-native";
import { useResolvedFontStyle } from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, interpolate, dim, resolveInheritedFontFamily } from "./shared";
import { GradientBox } from "./GradientBox";

export type TextSpan = {
  text: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  fontFamily?: string | "inherit";
  fontSize?: number;
  letterSpacing?: number;
  color?: string;
  textDecorationLine?:
    | "none"
    | "underline"
    | "line-through"
    | "underline line-through";
};

export const TextSpanSchema = z.object({
  text: z.string(),
  fontWeight: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  letterSpacing: z.number().optional(),
  color: z.string().optional(),
  textDecorationLine: z
    .enum(["none", "underline", "line-through", "underline line-through"])
    .optional(),
});

export type TextElementProps = BaseBoxProps & {
  content: string | TextSpan[];
  mode?: "plain" | "expression";
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export const TextElementPropsSchema = BaseBoxPropsSchema.extend({
  content: z.union([z.string(), z.array(TextSpanSchema)]),
  mode: z.enum(["plain", "expression"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

/**
 * Renders one inline span. Isolated as its own component so the
 * `useResolvedFontStyle` hook is called once per stable component instance —
 * calling the hook in a `.map` loop inside the parent would break rules of
 * hooks when the span count changes.
 */
const RichTextSpan = ({
  span,
  baseFontFamily,
}: {
  span: TextSpan;
  baseFontFamily: string | undefined;
}): React.ReactElement => {
  const fontFamily = resolveInheritedFontFamily(span.fontFamily, baseFontFamily);
  const resolved = useResolvedFontStyle(fontFamily, span.fontWeight);
  return (
    <Text
      style={{
        fontFamily: resolved.fontFamily,
        fontWeight: resolved.resolvedToVariant
          ? undefined
          : (span.fontWeight as any),
        fontStyle: span.fontStyle,
        fontSize: span.fontSize,
        letterSpacing: span.letterSpacing,
        color: span.color,
        textDecorationLine: span.textDecorationLine,
      }}
    >
      {span.text}
    </Text>
  );
};

type TextUIElement = Extract<UIElement, { type: "Text" }>;

type Props = {
  element: TextUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack" | "ZStack";
};

export const TextElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  const { theme, variables } = ctx;
  const p = element.props;
  const isExpression = p.mode === "expression";
  const content: string | TextSpan[] = Array.isArray(p.content)
    ? isExpression
      ? p.content.map((s) => ({ ...s, text: interpolate(s.text, variables) }))
      : p.content
    : isExpression
      ? interpolate(p.content, variables)
      : p.content;
  const inheritedFontFamily = resolveInheritedFontFamily(
    p.fontFamily,
    theme.typography.defaultFontFamily
  );
  const resolvedFont = useResolvedFontStyle(inheritedFontFamily, p.fontWeight);

  const textNode = (
    <Text
      style={{
        flex: p.flex,
        flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
        flexGrow: p.backgroundGradient ? undefined : p.flexGrow,
        alignSelf: p.backgroundGradient ? undefined : p.alignSelf,
        width: p.backgroundGradient ? undefined : dim(p.width),
        height: p.backgroundGradient ? undefined : dim(p.height),
        minWidth: p.backgroundGradient ? undefined : p.minWidth,
        maxWidth: p.backgroundGradient ? undefined : p.maxWidth,
        minHeight: p.backgroundGradient ? undefined : p.minHeight,
        maxHeight: p.backgroundGradient ? undefined : p.maxHeight,
        fontSize: p.fontSize,
        fontWeight: resolvedFont.resolvedToVariant ? undefined : (p.fontWeight as any),
        fontFamily: resolvedFont.fontFamily,
        fontStyle: p.fontStyle,
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
      {typeof content === "string"
        ? content
        : content.map((s, i) => (
            <RichTextSpan key={i} span={s} baseFontFamily={inheritedFontFamily} />
          ))}
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
