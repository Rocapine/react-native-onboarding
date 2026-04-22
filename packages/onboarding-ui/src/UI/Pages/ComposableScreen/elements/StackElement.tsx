import React from "react";
import { z } from "zod";
import { View } from "react-native";
import { UIElement } from "../types";
import { RenderContext } from "./shared";

export type StackElementProps = {
  gap?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  flex?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  backgroundColor?: string;
  flexWrap?: "wrap" | "nowrap";
  flexShrink?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
  overflow?: "hidden" | "visible" | "scroll";
  opacity?: number;
};

export const StackElementPropsSchema = z.object({
  gap: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  flex: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  minWidth: z.number().optional(),
  maxWidth: z.number().optional(),
  minHeight: z.number().optional(),
  maxHeight: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  alignSelf: z.enum(["auto", "flex-start", "flex-end", "center", "stretch", "baseline"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  backgroundColor: z.string().optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  flexShrink: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  overflow: z.enum(["hidden", "visible", "scroll"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

type StackUIElement = Extract<UIElement, { type: "YStack" | "XStack" }>;

type Props = {
  element: StackUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack";
};

export const StackElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  return (
    <View
      style={{
        flexDirection: element.type === "XStack" ? "row" : "column",
        alignSelf: element.props.alignSelf,
        alignItems: element.props.alignItems,
        gap: element.props.gap,
        padding: element.props.padding,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        flex: element.props.flex,
        width: element.props.width,
        height: element.props.height,
        minWidth: element.props.minWidth,
        maxWidth: element.props.maxWidth,
        minHeight: element.props.minHeight,
        maxHeight: element.props.maxHeight,
        flexShrink: element.props.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
        flexWrap: element.props.flexWrap,
        justifyContent: element.props.justifyContent,
        backgroundColor: element.props.backgroundColor,
        borderWidth: element.props.borderWidth,
        borderRadius: element.props.borderRadius,
        borderColor: element.props.borderColor,
        overflow: element.props.overflow,
        opacity: element.props.opacity,
      }}
    >
      {ctx.renderChildren(element.children, element.type)}
    </View>
  );
};
