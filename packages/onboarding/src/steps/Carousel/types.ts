import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";

export const CarouselScreenSchema = z.object({
  mediaUrl: z.string(),
  title: z.string(),
  subtitle: z.string().nullish(),
});

export const CarouselStepPayloadSchema = z.object({
  screens: z.array(CarouselScreenSchema),
});

export const CarouselStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Carousel"),
  payload: CarouselStepPayloadSchema,
});

export type CarouselStepType = z.infer<typeof CarouselStepTypeSchema>;
export type CarouselScreenType = z.infer<typeof CarouselScreenSchema>;
