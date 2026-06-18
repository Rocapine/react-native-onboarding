import React from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { GradientBox } from "./GradientBox";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type KeyboardAvoidingBehavior = "padding" | "height" | "position";

export type KeyboardAvoidingViewElementProps = BaseBoxProps & {
  behavior?: KeyboardAvoidingBehavior;
  keyboardVerticalOffset?: number;
  enabled?: boolean;
};

export const KeyboardAvoidingViewElementPropsSchema = BaseBoxPropsSchema.extend({
  behavior: z.enum(["padding", "height", "position"]).optional(),
  keyboardVerticalOffset: z.number().optional(),
  enabled: z.boolean().optional(),
});

type KAVUIElement = Extract<UIElement, { type: "KeyboardAvoidingView" }>;

type Props = {
  element: KAVUIElement;
  ctx: RenderContext;
};

const defaultBehavior = (): KeyboardAvoidingBehavior => (Platform.OS === "ios" ? "padding" : "height");

export const KeyboardAvoidingViewElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const p = element.props;
  const hasGradient = !!p.backgroundGradient;

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

  // When gradient is present the outer GradientBox carries the box layout
  // (containerStyle) and the inner KAV fills it — but only force `flex: 1` when
  // the box is explicitly sized. A content-sized box must stay content-sized,
  // else `flex: 1` grabs the parent's full main-axis (screen-fill in a ZStack).
  const fillsParent = p.height != null || p.flex != null || p.flexGrow != null;
  const kav = (
    <KeyboardAvoidingView
      behavior={p.behavior ?? defaultBehavior()}
      keyboardVerticalOffset={p.keyboardVerticalOffset ?? 0}
      enabled={p.enabled ?? true}
      style={hasGradient ? { flex: fillsParent ? 1 : p.flex } : containerStyle}
    >
      {ctx.renderChildren(element.children, "YStack")}
    </KeyboardAvoidingView>
  );

  if (hasGradient) {
    return (
      <GradientBox gradient={p.backgroundGradient} style={containerStyle}>
        {kav}
      </GradientBox>
    );
  }

  return kav;
};
