import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import {
  type LeafCondition,
  type ConditionGroup,
  type HapticStyle,
  LeafConditionSchema,
  ConditionGroupSchema,
  HapticStyleSchema,
} from "../../common.types";

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
  /** Tags the stored variable's underlying type. */
  kind?: "int" | "float" | "string";
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

type ButtonOverridableProps = BaseBoxProps & {
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
};

/** Subset of ButtonElementProps that can be overridden per-state. */
export type ButtonStyleOverride = Partial<ButtonOverridableProps>;

export type ButtonElementProps = BaseBoxProps & {
  label: string;
  /**
   * Ordered list of actions to run on press. Sequential, await async handlers,
   * abort on error, `"continue"` is terminal.
   */
  actions?: ButtonAction[];
  /**
   * @deprecated Use `actions` instead. When `actions` is absent and `action === "continue"`,
   * runtime treats it as `actions: ["continue"]`.
   */
  action?: "continue";
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  /**
   * Font family name. Omit or set to `"inherit"` to inherit from
   * `theme.typography.defaultFontFamily`.
   */
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  /**
   * When the condition evaluates truthy against current onboarding variables,
   * the button blocks all press actions and renders in a disabled style. Uses
   * the same condition schema as `Branch.condition`.
   */
  disabledWhen?: LeafCondition | ConditionGroup;
  /** @deprecated Use `disabledStyle.backgroundColor`. Falls back when `disabledStyle` omitted. */
  disabledBackgroundColor?: string;
  /** @deprecated Use `disabledStyle.color`. Falls back when `disabledStyle` omitted. */
  disabledColor?: string;
  /** Style overrides merged on top of base props while pressed. */
  pressedStyle?: ButtonStyleOverride;
  /** Style overrides merged on top of base props while disabled. Wins over deprecated `disabled*` fields. */
  disabledStyle?: ButtonStyleOverride;
  /** Animation duration (ms) between rest/pressed/disabled. Default 150. */
  transitionDurationMs?: number;
  /**
   * Tactile feedback fired on press (before actions run). Maps to expo-haptics
   * ImpactFeedbackStyle. Opt-in — omit or set `"none"` for no feedback.
   * No-op if the optional `expo-haptics` peer dep isn't installed.
   */
  haptic?: HapticStyle;
};

export const ButtonStyleOverrideSchema = BaseBoxPropsSchema.extend({
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
}).partial();

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
  pressedStyle: ButtonStyleOverrideSchema.optional(),
  disabledStyle: ButtonStyleOverrideSchema.optional(),
  transitionDurationMs: z.number().min(0).optional(),
  haptic: HapticStyleSchema.optional(),
});
