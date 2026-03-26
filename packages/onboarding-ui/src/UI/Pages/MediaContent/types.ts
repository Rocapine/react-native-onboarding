import { z } from "zod";
import {
  ButtonSectionSchema,
  CustomPayloadSchema,
  MediaSourceSchema,
  SocialProofSchema,
} from "../types";

export const MediaContentLayoutStyleSchema = z
  .enum(["default", "media_top", "media_bottom"])
  .default("default");

export const MediaContentStepPayloadSchema = z.object({
  mediaSource: MediaSourceSchema,
  title: z.string(),
  description: z.string().nullish(),
  socialProof: SocialProofSchema.nullish(),
  layoutStyle: MediaContentLayoutStyleSchema.optional(),
});

export const MediaContentStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("MediaContent"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: MediaContentStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
});

export type MediaContentStepType = z.infer<typeof MediaContentStepTypeSchema>;
