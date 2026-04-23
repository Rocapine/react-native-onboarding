import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type DatePickerElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: string;
  minimumDate?: string;
  maximumDate?: string;
  mode?: "date" | "time" | "datetime";
  display?: "default" | "spinner" | "calendar" | "clock" | "compact" | "inline";
  textColor?: string;
  accentColor?: string;
  locale?: string;
};

export const DatePickerElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  defaultValue: z.string().optional(),
  minimumDate: z.string().optional(),
  maximumDate: z.string().optional(),
  mode: z.enum(["date", "time", "datetime"]).optional().default("date"),
  display: z.enum(["default", "spinner", "calendar", "clock", "compact", "inline"]).optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  locale: z.string().optional(),
});
