import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";

export const CarouselScreenSchema = z.object({
  mediaUrl: z.string(),
  title: z.string(),
  subtitle: z.string().nullish(),
});

export const CarouselPaginationSchema = z
  .object({
    show: z.boolean().optional().default(true),
    dotColor: z.string().optional(),
    activeDotColor: z.string().optional(),
    dotWidth: z.number().nonnegative().optional().default(8),
    dotHeight: z.number().nonnegative().optional().default(8),
    activeDotWidth: z.number().nonnegative().optional().default(24),
    activeDotHeight: z.number().nonnegative().optional().default(8),
    gap: z.number().nonnegative().optional().default(8),
    position: z.enum(["top", "bottom"]).optional().default("bottom"),
    marginTop: z.number().optional().default(20),
    marginBottom: z.number().optional().default(20),
  })
  .optional();

export const CarouselStepPayloadSchema = z.object({
  screens: z.array(CarouselScreenSchema),
  pagination: CarouselPaginationSchema,
});

export const CarouselStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Carousel"),
  payload: CarouselStepPayloadSchema,
});

export type CarouselStepType = z.infer<typeof CarouselStepTypeSchema>;
export type CarouselScreenType = z.infer<typeof CarouselScreenSchema>;
export type CarouselPaginationType = z.infer<typeof CarouselPaginationSchema>;
