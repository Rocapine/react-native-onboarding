import z from "zod";
import { BaseStepTypeSchema, SocialProofSchema } from "../common.types";

export const RatingsStepPayloadSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  socialProofs: z.array(SocialProofSchema),
  rateTheAppButtonLabel: z.string().optional().default("Rate the app"),
});

export const RatingsStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Ratings"),
  payload: RatingsStepPayloadSchema,
});

export type RatingsStepType = z.infer<typeof RatingsStepTypeSchema>;
