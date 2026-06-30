import React from "react";
import { z } from "zod";
import { Text } from "react-native";
import { useResolvedFontStyle } from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, areElementPropsEqual, interpolate, dim, resolveInheritedFontFamily, RichTextStyleContext } from "./shared";
import { useVariables } from "./VariablesContext";
import type { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";
import { GradientBox } from "./GradientBox";

export type TextSpan = {
  text: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  fontFamily?: string | "inherit";
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecorationLine?:
    | "none"
    | "underline"
    | "line-through"
    | "underline line-through";
  textDecorationColor?: string;
  textDecorationStyle?: "solid" | "double" | "dotted" | "dashed";
};

export const TextSpanSchema = z.object({
  text: z.string(),
  fontWeight: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  textDecorationLine: z
    .enum(["none", "underline", "line-through", "underline line-through"])
    .optional(),
  textDecorationColor: z.string().optional(),
  textDecorationStyle: z.enum(["solid", "double", "dotted", "dashed"]).optional(),
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
  const resolved = useResolvedFontStyle(fontFamily, span.fontWeight, span.fontStyle);
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
        lineHeight: span.lineHeight,
        color: span.color,
        backgroundColor: span.backgroundColor,
        opacity: span.opacity,
        textTransform: span.textTransform,
        textDecorationLine: span.textDecorationLine,
        textDecorationColor: span.textDecorationColor,
        textDecorationStyle: span.textDecorationStyle,
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
  parentType?: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";
};

// Shared implementation. `variables` is injected by the two memo wrappers below —
// plain Text gets an empty map (never reads it); expression Text gets the live
// map via useVariables so `{{var}}` interpolation re-renders on writes.
const TextElementBase = ({ element, ctx, parentType, variables }: Props & { variables: Record<string, ComposableVariableEntry> }): React.ReactElement => {
  const { theme } = ctx;
  const p = element.props;
  // Text-style defaults inherited from a parent `RichText` container (empty when
  // this Text isn't inside one). Element props always win over inherited values.
  const inherited = React.useContext(RichTextStyleContext);
  const fontSize = p.fontSize ?? inherited.fontSize;
  const fontWeight = p.fontWeight ?? inherited.fontWeight;
  const fontStyle = p.fontStyle ?? inherited.fontStyle;
  const color = p.color ?? inherited.color;
  const textAlign = p.textAlign ?? inherited.textAlign;
  const letterSpacing = p.letterSpacing ?? inherited.letterSpacing;
  const lineHeight = p.lineHeight ?? inherited.lineHeight;
  const isExpression = p.mode === "expression";
  const content: string | TextSpan[] = Array.isArray(p.content)
    ? isExpression
      ? p.content.map((s) => ({ ...s, text: interpolate(s.text, variables) }))
      : p.content
    : isExpression
      ? interpolate(p.content, variables)
      : p.content;
  const inheritedFontFamily = resolveInheritedFontFamily(
    p.fontFamily ?? inherited.fontFamily,
    theme.typography.defaultFontFamily
  );
  const resolvedFont = useResolvedFontStyle(inheritedFontFamily, fontWeight, fontStyle);

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
        fontSize,
        fontWeight: resolvedFont.resolvedToVariant ? undefined : (fontWeight as any),
        fontFamily: resolvedFont.fontFamily,
        fontStyle,
        color: color ?? theme.colors.text.primary,
        textAlign,
        letterSpacing,
        lineHeight,
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

const EMPTY_VARS: Record<string, ComposableVariableEntry> = {};

// Plain Text never reads variables → fully static; memo-skips on every write.
export const PlainTextElementComponent = React.memo(
  (props: Props): React.ReactElement => <TextElementBase {...props} variables={EMPTY_VARS} />,
  areElementPropsEqual
);
PlainTextElementComponent.displayName = "PlainTextElementComponent";

// Expression Text interpolates `{{var}}` → subscribes to variable writes.
export const ExpressionTextElementComponent = React.memo(
  (props: Props): React.ReactElement => {
    const { variables } = useVariables();
    return <TextElementBase {...props} variables={variables} />;
  },
  areElementPropsEqual
);
ExpressionTextElementComponent.displayName = "ExpressionTextElementComponent";
