import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { GradientBox } from "./GradientBox";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type SafeAreaEdge = "top" | "right" | "bottom" | "left";
export type SafeAreaEdgeMode = "off" | "additive" | "maximum";

export type SafeAreaViewElementProps = BaseBoxProps & {
  mode?: "padding" | "margin";
  edges?: SafeAreaEdge[] | Partial<Record<SafeAreaEdge, SafeAreaEdgeMode>>;
};

const EdgeSchema = z.enum(["top", "right", "bottom", "left"]);
const EdgeModeSchema = z.enum(["off", "additive", "maximum"]);

export const SafeAreaViewElementPropsSchema = BaseBoxPropsSchema.extend({
  mode: z.enum(["padding", "margin"]).optional(),
  edges: z
    .union([
      z.array(EdgeSchema),
      z.object({
        top: EdgeModeSchema.optional(),
        right: EdgeModeSchema.optional(),
        bottom: EdgeModeSchema.optional(),
        left: EdgeModeSchema.optional(),
      }),
    ])
    .optional(),
});

type SafeAreaViewUIElement = Extract<UIElement, { type: "SafeAreaView" }>;

type Props = {
  element: SafeAreaViewUIElement;
  ctx: RenderContext;
};

export const SafeAreaViewElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const p = element.props;
  const hasGradient = !!p.backgroundGradient;
  const frameStyle = {
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
    backgroundColor: hasGradient ? undefined : p.backgroundColor,
    borderWidth: p.borderWidth,
    borderRadius: p.borderRadius,
    borderColor: p.borderColor,
    overflow: hasGradient ? "hidden" as const : p.overflow,
    opacity: p.opacity,
  };

  const safeAreaStyle = {
    flex: hasGradient ? 1 : p.flex,
    padding: p.padding,
    paddingHorizontal: p.paddingHorizontal,
    paddingVertical: p.paddingVertical,
  };

  if (hasGradient) {
    return (
      <GradientBox gradient={p.backgroundGradient} style={frameStyle}>
        <SafeAreaView mode={p.mode} edges={p.edges as any} style={safeAreaStyle}>
          {ctx.renderChildren(element.children, "YStack")}
        </SafeAreaView>
      </GradientBox>
    );
  }

  return (
    <SafeAreaView
      mode={p.mode}
      edges={p.edges as any}
      style={{ ...frameStyle, ...safeAreaStyle }}
    >
      {ctx.renderChildren(element.children, "YStack")}
    </SafeAreaView>
  );
};
