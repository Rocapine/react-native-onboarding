import { z } from "zod";
import { BaseStepTypeSchema, MediaSourceSchema, SocialProofSchema } from "../common.types";

export const MediaContentLayoutStyleSchema = z.enum(["default", "media_top", "media_bottom"]).default("default");

export const MediaContentStepPayloadSchema = z.object({
  mediaSource: MediaSourceSchema,
  title: z.string(),
  description: z.string().nullish(),
  socialProof: SocialProofSchema.nullish(),
  layoutStyle: MediaContentLayoutStyleSchema.optional(),
});

export const MediaContentStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("MediaContent"),
  payload: MediaContentStepPayloadSchema,
});

export type MediaContentStepType = z.infer<typeof MediaContentStepTypeSchema>;
