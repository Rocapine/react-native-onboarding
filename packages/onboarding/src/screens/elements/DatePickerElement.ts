import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

// The literal "now" resolves to the current date/time at render time.
// Use it for defaultValue/minimumDate/maximumDate when a static ISO string
// would go stale (e.g. a max date that should always be today).
const isDateStringOrNow = (s: string) => s === "now" || !isNaN(Date.parse(s));

// Subset of Intl.DateTimeFormatOptions used to format the displayed/stored
// label (Android trigger text + variable `label`). Forwarded as-is to the
// toLocale*String call matching the picker `mode`. NOTE: Intl throws if
// `dateStyle`/`timeStyle` is combined with component fields (hour/day/etc.) —
// authors must not mix the two; the schema does not enforce it.
export type DateTimeFormatOptions = {
  weekday?: "long" | "short" | "narrow";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  hour12?: boolean;
  hourCycle?: "h11" | "h12" | "h23" | "h24";
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
};

export const DateTimeFormatOptionsSchema = z.object({
  weekday: z.enum(["long", "short", "narrow"]).optional(),
  year: z.enum(["numeric", "2-digit"]).optional(),
  month: z.enum(["numeric", "2-digit", "long", "short", "narrow"]).optional(),
  day: z.enum(["numeric", "2-digit"]).optional(),
  hour: z.enum(["numeric", "2-digit"]).optional(),
  minute: z.enum(["numeric", "2-digit"]).optional(),
  second: z.enum(["numeric", "2-digit"]).optional(),
  hour12: z.boolean().optional(),
  hourCycle: z.enum(["h11", "h12", "h23", "h24"]).optional(),
  dateStyle: z.enum(["full", "long", "medium", "short"]).optional(),
  timeStyle: z.enum(["full", "long", "medium", "short"]).optional(),
});

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
  format?: DateTimeFormatOptions;
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
  format: DateTimeFormatOptionsSchema.optional(),
});
