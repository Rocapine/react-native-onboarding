import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";
import { PICKER_TYPES } from "./pickerVariants";

// Derived, never hand-listed: `PICKER_TYPES` is the set the renderer dispatches
// on, so the schema cannot declare a type nothing can draw (#210).
export const PickerTypeEnum = z.enum(PICKER_TYPES);

export const PickerStepPayloadSchema = z.object({
  title: z.string(),
  description: z.string().nullish(),
  pickerType: z.union([PickerTypeEnum, z.string()]),
});

export const PickerStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Picker"),
  payload: PickerStepPayloadSchema,
  variableName: z.string().min(1).optional(),
});

export type PickerStepType = z.infer<typeof PickerStepTypeSchema>;

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ft";
