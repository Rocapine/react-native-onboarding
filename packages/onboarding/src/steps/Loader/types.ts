import { z } from "zod";
import { BaseStepTypeSchema, MediaSourceSchema } from "../common.types";

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

export const LoaderStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Loader"),
  payload: LoaderStepPayloadSchema,
});

export type LoaderStepType = z.infer<typeof LoaderStepTypeSchema>;
export type LoaderStep = z.infer<typeof LoaderStepSchema>;
