import { z } from "zod";

// Self-contained UI mirror of the headless `ButtonAction` (packages/onboarding
// src/steps/common.types.ts). Kept here as a leaf module (imports only zod) so
// both BaseBoxProps.ts (schema) and shared.ts (runActions dispatch) can depend
// on it without an import cycle. Shared by `Button.actions` and the generic
// `onPress` on every UIElement.

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
  valueMode?: "literal" | "expression";
  kind?: "int" | "float" | "string";
  /**
   * Treat the target variable as the JSON-encoded `string[]` multi-select
   * collection used by `CheckboxGroup` and apply `value` as a set operation
   * (`"append"` / `"remove"` / `"toggle"`) instead of overwriting. `kind` is
   * ignored in this mode. Omit for the default overwrite behavior.
   */
  arrayOp?: "append" | "remove" | "toggle";
};

export const SetVariableButtonActionSchema = z.object({
  type: z.literal("setVariable"),
  name: z.string().min(1, "name must not be empty"),
  value: z.string(),
  label: z.string().optional(),
  valueMode: z.enum(["literal", "expression"]).optional(),
  kind: z.enum(["int", "float", "string"]).optional(),
  arrayOp: z.enum(["append", "remove", "toggle"]).optional(),
});

export type ButtonAction = "continue" | CustomButtonAction | SetVariableButtonAction;

export const ButtonActionSchema = z.union([
  z.literal("continue"),
  CustomButtonActionSchema,
  SetVariableButtonActionSchema,
]);
