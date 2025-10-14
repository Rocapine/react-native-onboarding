import { z } from "zod";
import {
  CustomPayloadSchema,
  MediaSourceSchema,
  SocialProofSchema,
} from "../types";

export const MediaContentStepPayloadSchema = z.object({
  mediaSource: MediaSourceSchema,
  title: z.string(),
  description: z.string().nullish(),
  socialProof: SocialProofSchema.nullish(),
});

export const MediaContentStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("MediaContent"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: MediaContentStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  figmaUrl: z.string().nullish(),
});

export type MediaContentStepType = z.infer<typeof MediaContentStepTypeSchema>;
