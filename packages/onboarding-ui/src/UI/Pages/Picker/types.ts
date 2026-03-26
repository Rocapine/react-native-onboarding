import { z } from "zod";
import { ButtonSectionSchema, CustomPayloadSchema } from "../types";

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

export const PickerStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Picker"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: PickerStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
});

export type PickerStepType = z.infer<typeof PickerStepTypeSchema>;

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ft";
