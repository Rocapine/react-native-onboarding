import z from "zod";
import { CustomPayloadSchema, SocialProofSchema } from "../types";

export const RatingsStepPayloadSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  socialProofs: z.array(SocialProofSchema),
  rateTheAppButtonLabel: z.string().optional().default("Rate the app"),
});

export const RatingsStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Ratings"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: RatingsStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  figmaUrl: z.string().nullable(),
});

export type RatingsStepType = z.infer<typeof RatingsStepTypeSchema>;
