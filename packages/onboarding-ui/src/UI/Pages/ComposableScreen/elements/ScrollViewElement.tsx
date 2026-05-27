import React from "react";
import { ScrollView } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { GradientBox } from "./GradientBox";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type ScrollViewContentInset = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type ScrollViewElementProps = BaseBoxProps & {
  horizontal?: boolean;
  bounces?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  alwaysBounceVertical?: boolean;
  alwaysBounceHorizontal?: boolean;
  contentInset?: ScrollViewContentInset;
  contentContainerPadding?: number;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
};

const ContentInsetSchema = z.object({
  top: z.number().optional(),
  right: z.number().optional(),
  bottom: z.number().optional(),
  left: z.number().optional(),
});

export const ScrollViewElementPropsSchema = BaseBoxPropsSchema.extend({
  horizontal: z.boolean().optional(),
  bounces: z.boolean().optional(),
  showsVerticalScrollIndicator: z.boolean().optional(),
  showsHorizontalScrollIndicator: z.boolean().optional(),
  alwaysBounceVertical: z.boolean().optional(),
  alwaysBounceHorizontal: z.boolean().optional(),
  contentInset: ContentInsetSchema.optional(),
  contentContainerPadding: z.number().min(0).optional(),
  keyboardShouldPersistTaps: z.enum(["always", "never", "handled"]).optional(),
});

type ScrollViewUIElement = Extract<UIElement, { type: "ScrollView" }>;

type Props = {
  element: ScrollViewUIElement;
  ctx: RenderContext;
};

export const ScrollViewElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const p = element.props;
  const hasGradient = !!p.backgroundGradient;
  const horizontal = p.horizontal === true;

  const containerStyle = {
    flex: p.flex,
    flexShrink: p.flexShrink,
    flexGrow: p.flexGrow,
    alignSelf: p.alignSelf,
    width: dim(p.width),
    height: dim(p.height),
    minWidth: p.minWidth,
    maxWidth: p.maxWidth,
    minHeight: p.minHeight,
    maxHeight: p.maxHeight,
    margin: p.margin,
    marginHorizontal: p.marginHorizontal,
    marginVertical: p.marginVertical,
    padding: p.padding,
    paddingHorizontal: p.paddingHorizontal,
    paddingVertical: p.paddingVertical,
    backgroundColor: hasGradient ? undefined : p.backgroundColor,
    borderWidth: p.borderWidth,
    borderRadius: p.borderRadius,
    borderColor: p.borderColor,
    overflow: hasGradient ? ("hidden" as const) : p.overflow,
    opacity: p.opacity,
  };

  const contentContainerStyle = {
    flexGrow: 1,
    padding: p.contentContainerPadding,
  };

  const scroll = (
    <ScrollView
      horizontal={horizontal}
      bounces={p.bounces}
      showsVerticalScrollIndicator={p.showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={p.showsHorizontalScrollIndicator}
      alwaysBounceVertical={p.alwaysBounceVertical}
      alwaysBounceHorizontal={p.alwaysBounceHorizontal}
      contentInset={p.contentInset}
      keyboardShouldPersistTaps={p.keyboardShouldPersistTaps ?? "handled"}
      style={hasGradient ? { flex: 1 } : containerStyle}
      contentContainerStyle={contentContainerStyle}
    >
      {ctx.renderChildren(element.children, horizontal ? "XStack" : "YStack")}
    </ScrollView>
  );

  if (hasGradient) {
    return (
      <GradientBox gradient={p.backgroundGradient} style={containerStyle}>
        {scroll}
      </GradientBox>
    );
  }

  return scroll;
};
