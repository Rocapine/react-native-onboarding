import React, { useMemo } from "react";
import { z } from "zod";
import { Text, TouchableOpacity } from "react-native";
import {
  useResolvedFontStyle,
  evaluateCondition,
  type LeafCondition,
  type ConditionGroup,
  type ComposableVariableKind,
  LeafConditionSchema,
  ConditionGroupSchema,
} from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim, resolveInheritedFontFamily } from "./shared";
import { GradientBox } from "./GradientBox";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";
import { evaluateSetVariableExpression } from "./expression";

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

export type SetVariableButtonAction = {
  type: "setVariable";
  name: string;
  value: string;
  label?: string;
  /**
   * When `"expression"`, `value` is parsed as an arithmetic expression with
   * `{{var}}` references, numeric literals, and `+ - * /` (parens supported).
   * On parse failure, falls back to plain interpolation (string).
   * Defaults to `"literal"` — `value` stored verbatim.
   */
  valueMode?: "literal" | "expression";
  /**
   * Tags the stored variable's underlying type. In `"literal"` mode this is
   * used as-is. In `"expression"` mode the inferred result kind is used
   * unless `kind` is explicitly set (ignored — expression mode derives kind
   * from evaluation).
   */
  kind?: ComposableVariableKind;
};

export const SetVariableButtonActionSchema = z.object({
  type: z.literal("setVariable"),
  name: z.string().min(1, "name must not be empty"),
  value: z.string(),
  label: z.string().optional(),
  valueMode: z.enum(["literal", "expression"]).optional(),
  kind: z.enum(["int", "float", "string"]).optional(),
});

export type ButtonAction = "continue" | CustomButtonAction | SetVariableButtonAction;

export const ButtonActionSchema = z.union([
  z.literal("continue"),
  CustomButtonActionSchema,
  SetVariableButtonActionSchema,
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
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  disabledWhen?: LeafCondition | ConditionGroup;
  disabledBackgroundColor?: string;
  disabledColor?: string;
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
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  disabledWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
  disabledBackgroundColor: z.string().optional(),
  disabledColor: z.string().optional(),
});

type ButtonUIElement = Extract<UIElement, { type: "Button" }>;

type Props = {
  element: ButtonUIElement;
  ctx: RenderContext;
};

export const ButtonElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, onContinue, customActions, variables, setVariable } = ctx;
  const flatVariables = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(variables).map(([k, v]) => [k, v?.value])
      ),
    [variables]
  );
  const isDisabled = element.props.disabledWhen
    ? evaluateCondition(element.props.disabledWhen, flatVariables)
    : false;
  const handlePress = async () => {
    if (isDisabled) return;
    const { actions, action } = element.props;
    const effective: ButtonAction[] =
      actions ?? (action === "continue" ? ["continue"] : []);

    for (const act of effective) {
      if (act === "continue") {
        onContinue();
        return;
      }
      if (act.type === "setVariable") {
        let value: string;
        let kind: ComposableVariableKind | undefined;
        if (act.valueMode === "expression") {
          const computed = evaluateSetVariableExpression(act.value, variables);
          value = computed.value;
          kind = computed.kind;
        } else {
          value = act.value;
          kind = act.kind;
        }
        setVariable(act.name, { value, label: act.label, kind });
        continue;
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
  const disabledBg =
    element.props.disabledBackgroundColor ?? theme.colors.disable;
  const disabledText =
    element.props.disabledColor ?? theme.colors.text.disable;
  const bgColor = isDisabled
    ? isFilled
      ? disabledBg
      : "transparent"
    : isFilled
      ? (element.props.backgroundColor ?? theme.colors.primary)
      : "transparent";
  const textColor = isDisabled
    ? disabledText
    : isFilled
      ? (element.props.color ?? theme.colors.text.opposite)
      : (element.props.color ?? theme.colors.primary);
  const outlinedBorderColor = isDisabled
    ? disabledBg
    : (element.props.borderColor ?? theme.colors.primary);

  const hasGradient = isFilled && !isDisabled && !!element.props.backgroundGradient;
  const borderRadius = element.props.borderRadius ?? 90;
  const inheritedFontFamily = resolveInheritedFontFamily(
    element.props.fontFamily,
    theme.typography.defaultFontFamily
  );
  const resolvedFont = useResolvedFontStyle(
    inheritedFontFamily,
    element.props.fontWeight
  );

  const labelNode = (
    <Text
      style={{
        color: textColor,
        fontSize: element.props.fontSize ?? theme.typography.textStyles.button.fontSize,
        fontWeight: resolvedFont.resolvedToVariant
          ? undefined
          : ((resolvedFont.fontWeight as any) ?? theme.typography.textStyles.button.fontWeight),
        fontFamily: resolvedFont.fontFamily,
        fontStyle: element.props.fontStyle,
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
          borderColor: isOutlined ? outlinedBorderColor : element.props.borderColor,
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
          disabled={isDisabled}
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
      disabled={isDisabled}
      style={{
        backgroundColor: bgColor,
        borderRadius,
        borderWidth: isOutlined ? (element.props.borderWidth ?? 1) : (element.props.borderWidth ?? 0),
        borderColor: isOutlined ? outlinedBorderColor : element.props.borderColor,
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
