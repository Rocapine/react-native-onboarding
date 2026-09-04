import React from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { GradientBox } from "./GradientBox";
import { UIElement } from "../types";
import { RenderContext, dim, areElementPropsEqual } from "./shared";
import { fillLayout, fillsParent } from "./wrapperLayout";

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

const KeyboardAvoidingViewElementComponentBase = ({ element, ctx }: Props): React.ReactElement => {
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
  const fills = fillsParent(p);
  // RN's `behavior: "height"` — `defaultBehavior()` on Android — pins this node
  // by composing `{ height, flex: 0 }` OVER the style we pass it ("When height
  // changes, we need to disable flex", `KeyboardAvoidingView.js`). Yoga's
  // `resolveFlexGrow` prefers an explicit `flexGrow` to `flex`'s implied 0, so
  // a `flexGrow` on THIS node survives that compose and the view grows back
  // over the keyboard inset — the focused input stays under the keyboard.
  //
  // So under that behaviour the fill is expressed as `flex`, and a demoted
  // element's `flexGrow` is folded back into it. That reintroduces the #231
  // double-`flex` for a WRAPPED `flex`-ed KAV under an all-auto ancestor
  // chain — accepted knowingly: RN gives no way to have both, and a KAV
  // element inside the page ScrollView is already documented as inert
  // (`.claude/rules/composable-screen-runtime.md`), whereas broken keyboard
  // avoidance is the whole purpose of the element. `padding`/`position`
  // compose nothing, so they keep the normal contract.
  const behavior = p.behavior ?? defaultBehavior();
  const composesFlexZero = behavior === "height";
  const kavFill = composesFlexZero
    ? { flex: fills ? 1 : undefined }
    : fillLayout(fills);
  // Same reason, for the non-gradient path where this node carries the box
  // layout itself: fold a demoted `flexGrow` back into `flex`.
  const kavContainerStyle = composesFlexZero
    ? {
        ...containerStyle,
        flex: p.flex ?? (p.flexGrow != null ? 1 : undefined),
        flexGrow: undefined,
      }
    : containerStyle;
  const kav = (
    <KeyboardAvoidingView
      behavior={behavior}
      keyboardVerticalOffset={p.keyboardVerticalOffset ?? 0}
      enabled={p.enabled ?? true}
      // Fills the GradientBox via `fillLayout`, never `flex: 1` — see #231 and
      // the wrapper-layout rule; `flex` here would collapse inside a
      // content-sized outer and split the two branches' layout.
      style={hasGradient ? kavFill : kavContainerStyle}
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

export const KeyboardAvoidingViewElementComponent = React.memo(KeyboardAvoidingViewElementComponentBase, areElementPropsEqual);
