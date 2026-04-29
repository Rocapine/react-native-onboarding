import React from "react";
import { z } from "zod";
import { Text, TouchableOpacity } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";

export type CustomButtonAction = {
  type: "custom";
  function: string;
  variables?: string[];
};

export const CustomButtonActionSchema = z.object({
  type: z.literal("custom"),
  function: z.string().min(1, "function must not be empty"),
  variables: z.array(z.string()).optional(),
});

export type ButtonAction = "continue" | CustomButtonAction;

export const ButtonActionSchema = z.union([
  z.literal("continue"),
  CustomButtonActionSchema,
]);

export type ButtonElementProps = BaseBoxProps & {
  label: string;
  /**
   * Ordered list of actions to run on press. Sequential, await async handlers,
   * abort on error, `"continue"` is terminal.
   */
  actions?: ButtonAction[];
  /** @deprecated Use `actions` instead. */
  action?: "continue";
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
};

export const ButtonElementPropsSchema = BaseBoxPropsSchema.extend({
  label: z.string().min(1, "label must not be empty"),
  actions: z.array(ButtonActionSchema).optional(),
  action: z.enum(["continue"]).optional(),
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
});

type ButtonUIElement = Extract<UIElement, { type: "Button" }>;

type Props = {
  element: ButtonUIElement;
  ctx: RenderContext;
};

export const ButtonElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, onContinue, customActions, variables } = ctx;
  const handlePress = async () => {
    const { actions, action } = element.props;
    const effective: ButtonAction[] =
      actions ?? (action === "continue" ? ["continue"] : []);

    for (const act of effective) {
      if (act === "continue") {
        onContinue();
        return;
      }
      const handler = customActions[act.function];
      if (!handler) {
        console.warn(
          `[ComposableScreen] No customAction registered for "${act.function}"`
        );
        continue;
      }
      const requested = act.variables ?? [];
      const vars: Record<string, ComposableVariableEntry | undefined> = {};
      for (const name of requested) vars[name] = variables[name];
      try {
        await handler({ variables: vars });
      } catch (err) {
        console.error(
          `[ComposableScreen] customAction "${act.function}" threw:`,
          err
        );
        return;
      }
    }
  };
  const variant = element.props.variant ?? "filled";
  const isFilled = variant === "filled";
  const isOutlined = variant === "outlined";
  const bgColor = isFilled
    ? (element.props.backgroundColor ?? theme.colors.primary)
    : "transparent";
  const textColor = isFilled
    ? (element.props.color ?? theme.colors.text.opposite)
    : (element.props.color ?? theme.colors.primary);

  const hasGradient = isFilled && !!element.props.backgroundGradient;
  const borderRadius = element.props.borderRadius ?? 90;

  const labelNode = (
    <Text
      style={{
        color: textColor,
        fontSize: element.props.fontSize ?? theme.typography.textStyles.button.fontSize,
        fontWeight: (element.props.fontWeight as any) ?? theme.typography.textStyles.button.fontWeight,
        fontFamily: element.props.fontFamily,
        textAlign: element.props.textAlign ?? "center",
      }}
    >
      {element.props.label}
    </Text>
  );

  if (hasGradient) {
    return (
      <GradientBox
        gradient={element.props.backgroundGradient}
        style={{
          borderRadius,
          borderWidth: isOutlined ? (element.props.borderWidth ?? 1) : (element.props.borderWidth ?? 0),
          borderColor: isOutlined ? (element.props.borderColor ?? theme.colors.primary) : element.props.borderColor,
          width: dim(element.props.width),
          height: dim(element.props.height),
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          opacity: element.props.opacity,
          alignSelf: element.props.alignSelf ?? (element.props.width ? undefined : "stretch"),
          overflow: "hidden",
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePress}
          style={{
            flex: 1,
            padding: element.props.padding,
            paddingVertical: element.props.paddingVertical ?? 14,
            paddingHorizontal: element.props.paddingHorizontal ?? 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {labelNode}
        </TouchableOpacity>
      </GradientBox>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={{
        backgroundColor: bgColor,
        borderRadius,
        borderWidth: isOutlined ? (element.props.borderWidth ?? 1) : (element.props.borderWidth ?? 0),
        borderColor: isOutlined ? (element.props.borderColor ?? theme.colors.primary) : element.props.borderColor,
        padding: element.props.padding,
        paddingVertical: element.props.paddingVertical ?? 14,
        paddingHorizontal: element.props.paddingHorizontal ?? 24,
        width: dim(element.props.width),
        height: dim(element.props.height),
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        opacity: element.props.opacity,
        alignSelf: element.props.alignSelf ?? (element.props.width ? undefined : "stretch"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {labelNode}
    </TouchableOpacity>
  );
};
