import { z } from "zod";

export const CustomPayloadSchema = z.record(z.string(), z.any()).nullish();

export const MediaSourceSchema = z.union([
  z.object({
    type: z.literal("video").or(z.literal("image")).or(z.literal("lottie")).or(z.literal("rive")),
    localPathId: z.string(),
  }),
  z.object({
    type: z.literal("video").or(z.literal("image")).or(z.literal("lottie")).or(z.literal("rive")),
    url: z.string(),
  }),
]);

export const SocialProofSchema = z.object({
  numberOfStar: z.number(),
  content: z.string(),
  authorName: z.string(),
});

export const InfoBoxSchema = z.object({
  title: z.string(),
  content: z.string(),
});
