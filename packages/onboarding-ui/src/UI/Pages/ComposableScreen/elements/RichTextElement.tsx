import React from "react";
import { z } from "zod";
import { evaluateCondition } from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim, interpolate, RichTextStyleContext, InheritedTextStyle } from "./shared";
import { GradientBox } from "./GradientBox";

// Mirror of the headless RichTextElement schema. Kept in lockstep with
// packages/onboarding/src/steps/ComposableScreen/elements/RichTextElement.ts —
// TS won't catch drift because this re-declares its own type.
export type RichTextElementProps = BaseBoxProps & {
  gap?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "baseline" | "stretch";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  flexWrap?: "wrap" | "nowrap";
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export const RichTextElementPropsSchema = BaseBoxPropsSchema.extend({
  gap: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "baseline", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

type RichTextUIElement = Extract<UIElement, { type: "RichText" }>;
type TextChild = Extract<UIElement, { type: "Text" }>;

type Props = {
  element: RichTextUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack" | "ZStack" | "RichText";
};

// A plain-text child (no box styling, no motion) is split into one flex item per
// word so the row wraps word-by-word like real text — the chip pattern from
// host apps (parseTitleWithChips). A child carrying box styling (backgroundColor
// / borderRadius / border / padding) or motion is a "chip" and stays atomic so
// its box renders as a single rounded unit.
const isFlowingText = (child: TextChild): boolean => {
  const p = child.props;
  return (
    typeof p.content === "string" &&
    p.backgroundColor == null &&
    p.backgroundGradient == null &&
    p.borderRadius == null &&
    p.borderWidth == null &&
    p.padding == null &&
    p.paddingHorizontal == null &&
    p.paddingVertical == null &&
    // margin / explicit size would be applied to *every* word if split, so a
    // child carrying any of them is treated as an atomic chip too.
    p.margin == null &&
    p.marginHorizontal == null &&
    p.marginVertical == null &&
    p.width == null &&
    p.height == null &&
    p.minWidth == null &&
    p.maxWidth == null &&
    p.minHeight == null &&
    p.maxHeight == null &&
    p.animation == null &&
    p.transform == null
  );
};

/**
 * Wrapping flex row of child `Text` elements. Plain-text children are split into
 * per-word flex items so text wraps word-by-word (like a paragraph); box-styled
 * children render as atomic "chips" (padded/rounded/rotated pills) that honor
 * their own box props, `renderWhen`, `expression`, and motion. The result is a
 * title where chips sit inline with naturally-wrapping words.
 *
 * The container's text-style props are published via `RichTextStyleContext` so
 * every child `Text` inherits them as defaults (child overrides win).
 */
export const RichTextElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  const p = element.props;

  const inheritedTextStyle: InheritedTextStyle = {
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
    fontFamily: p.fontFamily,
    fontStyle: p.fontStyle,
    color: p.color,
    textAlign: p.textAlign,
    letterSpacing: p.letterSpacing,
    lineHeight: p.lineHeight,
  };

  // Expand children into the actual flex items to render: split flowing text into
  // words, keep chips whole. renderWhen is evaluated once per source child here
  // (flowing-text words then render unconditionally); chips keep their renderWhen
  // and are gated by renderElement.
  const flatVars = Object.fromEntries(
    Object.entries(ctx.variables).map(([k, v]) => [k, v?.value])
  );
  const expanded: UIElement[] = [];
  for (const child of element.children) {
    if (child.renderWhen && !evaluateCondition(child.renderWhen, flatVars)) continue;

    if (isFlowingText(child)) {
      const raw = child.props.content as string;
      const text = child.props.mode === "expression" ? interpolate(raw, ctx.variables) : raw;
      const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
      tokens.forEach((tok, i) => {
        expanded.push({
          ...child,
          id: `${child.id}-w${i}`,
          renderWhen: undefined,
          // mode dropped (undefined): content is already interpolated above, and
          // undefined is truer to the schema than the non-enum "plain".
          props: { ...child.props, content: tok, mode: undefined },
        });
      });
    } else {
      // Chip: renderWhen already passed above; null it so renderElement doesn't
      // re-evaluate the same condition (symmetry with the word path).
      expanded.push({ ...child, renderWhen: undefined });
    }
  }

  return (
    <GradientBox
      gradient={p.backgroundGradient}
      style={{
        flexDirection: "row",
        flexWrap: p.flexWrap ?? "wrap",
        gap: p.gap,
        alignItems: p.alignItems ?? "center",
        justifyContent: p.justifyContent ?? "center",
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
        backgroundColor: p.backgroundGradient ? undefined : p.backgroundColor,
        borderWidth: p.borderWidth,
        borderRadius: p.borderRadius,
        borderColor: p.borderColor,
        overflow: p.overflow,
        opacity: p.opacity,
      }}
    >
      <RichTextStyleContext.Provider value={inheritedTextStyle}>
        {ctx.renderChildren(expanded, "RichText")}
      </RichTextStyleContext.Provider>
    </GradientBox>
  );
};
