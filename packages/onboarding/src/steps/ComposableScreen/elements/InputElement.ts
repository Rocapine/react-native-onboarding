import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type InputElementProps = BaseBoxProps & {
  variableName?: string;
  placeholder?: string;
  defaultValue?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad" | "url" | "number-pad" | "ascii-capable" | "numbers-and-punctuation" | "name-phone-pad" | "twitter" | "web-search" | "visible-password";
  returnKeyType?: "done" | "next" | "go" | "search" | "send" | "default" | "emergency-call" | "google" | "join" | "route" | "yahoo" | "none" | "previous";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  placeholderColor?: string;
};

export const InputElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  keyboardType: z.enum(["default", "email-address", "numeric", "phone-pad", "decimal-pad", "url", "number-pad", "ascii-capable", "numbers-and-punctuation", "name-phone-pad", "twitter", "web-search", "visible-password"]).optional(),
  returnKeyType: z.enum(["done", "next", "go", "search", "send", "default", "emergency-call", "google", "join", "route", "yahoo", "none", "previous"]).optional(),
  autoCapitalize: z.enum(["none", "sentences", "words", "characters"]).optional(),
  secureTextEntry: z.boolean().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  multiline: z.boolean().optional(),
  numberOfLines: z.number().int().nonnegative().optional(),
  editable: z.boolean().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  placeholderColor: z.string().optional(),
});
