import { z } from "zod";
import { ButtonSectionSchema, CustomPayloadSchema } from "../common.types";

export const CarouselScreenSchema = z.object({
  mediaUrl: z.string(),
  title: z.string(),
  subtitle: z.string().nullish(),
});

export const CarouselStepPayloadSchema = z.object({
  screens: z.array(CarouselScreenSchema),
});

export const CarouselStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Carousel"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: CarouselStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
});

export type CarouselStepType = z.infer<typeof CarouselStepTypeSchema>;
export type CarouselScreenType = z.infer<typeof CarouselScreenSchema>;
