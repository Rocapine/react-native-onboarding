import React from "react";
import { z } from "zod";
import { View } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type StackElementProps = BaseBoxProps & {
  gap?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  flexWrap?: "wrap" | "nowrap";
};

export const StackElementPropsSchema = BaseBoxPropsSchema.extend({
  gap: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
});

type StackUIElement = Extract<UIElement, { type: "YStack" | "XStack" }>;

type Props = {
  element: StackUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack";
};

export const StackElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  const p = element.props;
  return (
    <View
      style={{
        flexDirection: element.type === "XStack" ? "row" : "column",
        gap: p.gap,
        flex: p.flex,
        flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
        flexGrow: p.flexGrow,
        flexWrap: p.flexWrap,
        alignSelf: p.alignSelf,
        alignItems: p.alignItems,
        justifyContent: p.justifyContent,
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
        backgroundColor: p.backgroundColor,
        borderWidth: p.borderWidth,
        borderRadius: p.borderRadius,
        borderColor: p.borderColor,
        overflow: p.overflow,
        opacity: p.opacity,
      }}
    >
      {ctx.renderChildren(element.children, element.type)}
    </View>
  );
};
