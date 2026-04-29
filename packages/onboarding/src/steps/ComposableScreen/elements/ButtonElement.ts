import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

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
