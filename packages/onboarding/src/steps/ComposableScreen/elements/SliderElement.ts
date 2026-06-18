import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type SliderElementProps = BaseBoxProps & {
  /** Variable to bind the slider value to. Stored as a stringified float with kind:"float". */
  variableName?: string;
  /** Initial value (float). Defaults to `min` (or 0) when unset. */
  defaultValue?: number;
  /** Lower bound. Default 0. */
  min?: number;
  /** Upper bound. Default 1. */
  max?: number;
  /** Step granularity. 0 = continuous. Default 0. */
  step?: number;
  /** Color of the track to the left of the thumb. */
  minimumTrackTintColor?: string;
  /** Color of the track to the right of the thumb. */
  maximumTrackTintColor?: string;
  /** Color of the thumb handle. */
  thumbTintColor?: string;
  /** Disable interaction. */
  disabled?: boolean;
};

export const SliderElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  defaultValue: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().min(0).optional(),
  minimumTrackTintColor: z.string().optional(),
  maximumTrackTintColor: z.string().optional(),
  thumbTintColor: z.string().optional(),
  disabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.min !== undefined && data.max !== undefined && data.min > data.max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "min must be <= max", path: ["min"] });
  }
});
