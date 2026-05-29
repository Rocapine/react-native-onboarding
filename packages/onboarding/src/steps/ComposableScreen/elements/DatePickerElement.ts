import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

// The literal "now" resolves to the current date/time at render time.
// Use it for defaultValue/minimumDate/maximumDate when a static ISO string
// would go stale (e.g. a max date that should always be today).
const isDateStringOrNow = (s: string) => s === "now" || !isNaN(Date.parse(s));

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
  defaultValue: z.string().refine(isDateStringOrNow, { message: "Invalid date string" }).optional(),
  minimumDate: z.string().refine(isDateStringOrNow, { message: "Invalid date string" }).optional(),
  maximumDate: z.string().refine(isDateStringOrNow, { message: "Invalid date string" }).optional(),
  mode: z.enum(["date", "time", "datetime"]).optional().default("date"),
  display: z.enum(["default", "spinner", "calendar", "clock", "compact", "inline"]).optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  locale: z.string().optional(),
});
