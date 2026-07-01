import React from "react";
import { ScrollView } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { GradientBox } from "./GradientBox";
import { UIElement } from "../types";
import { RenderContext, dim, areElementPropsEqual } from "./shared";

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
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
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
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch", "baseline"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
});

type ScrollViewUIElement = Extract<UIElement, { type: "ScrollView" }>;

type Props = {
  element: ScrollViewUIElement;
  ctx: RenderContext;
};

const ScrollViewElementComponentBase = ({ element, ctx }: Props): React.ReactElement => {
  const p = element.props;
  const hasGradient = !!p.backgroundGradient;
  const horizontal = p.horizontal === true;
  // Gradient path: outer GradientBox carries the box layout (containerStyle),
  // inner ScrollView fills it — but only force `flex: 1` when the box is
  // explicitly sized, else a content-sized ScrollView grabs the parent's full
  // main-axis (screen-fill in a ZStack/flex container).
  const fillsParent = p.height != null || p.flex != null || p.flexGrow != null;

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

  // Horizontal: children must keep their intrinsic width and overflow so the row
  // can scroll — so NO flexGrow (which would pin the content to the viewport
  // width) and children render with parentType "XScroll" (row layout, no
  // flexShrink default). Vertical keeps flexGrow:1 so a short payload still fills
  // the scroll viewport. alignItems/justifyContent let authors control cross-axis
  // alignment + distribution along the scroll axis.
  const contentContainerStyle = {
    flexDirection: horizontal ? ("row" as const) : ("column" as const),
    flexGrow: horizontal ? undefined : 1,
    alignItems: p.alignItems,
    justifyContent: p.justifyContent,
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
      style={hasGradient ? { flex: fillsParent ? 1 : p.flex } : containerStyle}
      contentContainerStyle={contentContainerStyle}
    >
      {ctx.renderChildren(element.children, horizontal ? "XScroll" : "YStack")}
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

export const ScrollViewElementComponent = React.memo(ScrollViewElementComponentBase, areElementPropsEqual);
