import { z } from "zod";
import { BaseBoxPropsSchema, type BaseBoxProps } from "./BaseBoxProps";

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
