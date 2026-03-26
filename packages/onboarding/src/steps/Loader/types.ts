import { z } from "zod";
import { ButtonSectionSchema, CustomPayloadSchema, MediaSourceSchema } from "../common.types";

export const LoaderStepSchema = z.object({
  label: z.string(),
  completed: z.string(),
});

export const LoaderStepPayloadSchema = z.object({
  title: z.string(),
  steps: z.array(LoaderStepSchema),
  didYouKnowImages: z.array(MediaSourceSchema).nullish(),
  duration: z.number().optional().default(2000),
  variant: z
    .enum(["bars", "circle", "texts_fading"])
    .optional()
    .default("bars"),
});

export const LoaderStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Loader"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: LoaderStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
});

export type LoaderStepType = z.infer<typeof LoaderStepTypeSchema>;
export type LoaderStep = z.infer<typeof LoaderStepSchema>;
