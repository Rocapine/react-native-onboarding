import z from "zod";
import { ButtonSectionSchema, CustomPayloadSchema, SocialProofSchema } from "../common.types";

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
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
});

export type RatingsStepType = z.infer<typeof RatingsStepTypeSchema>;
