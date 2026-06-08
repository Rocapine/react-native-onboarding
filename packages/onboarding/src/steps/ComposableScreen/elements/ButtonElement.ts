import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import {
  type LeafCondition,
  type ConditionGroup,
  type HapticStyle,
  type ButtonAction,
  LeafConditionSchema,
  ConditionGroupSchema,
  HapticStyleSchema,
  ButtonActionSchema,
} from "../../common.types";

// `ButtonAction` and its variants moved to `common.types.ts` (now shared with the
// generic `onPress` on BaseBoxProps). Re-exported here for back-compat.
export {
  type CustomButtonAction,
  CustomButtonActionSchema,
  type SetVariableButtonAction,
  SetVariableButtonActionSchema,
} from "../../common.types";
export type { ButtonAction };
export { ButtonActionSchema };

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
