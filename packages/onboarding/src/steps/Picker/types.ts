import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";

export const PickerTypeEnum = z.enum([
  "height",
  "weight",
  "age",
  "date",
  "gender",
  "coach",
  "name",
]);

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
