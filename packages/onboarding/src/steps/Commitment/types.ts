import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";

export const CommitmentItemSchema = z.object({
  text: z.string(),
});

export const CommitmentStepPayloadSchema = z.object({
  title: z.string(),
  subtitle: z.string().nullish(),
  description: z.string().nullish(),
  commitments: z.array(CommitmentItemSchema).nullish(),
  signatureCaption: z.string().default("Your signature is not recorded"),
  variant: z.enum(["signature", "simple"]).default("signature"),
});

export const CommitmentStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Commitment"),
  payload: CommitmentStepPayloadSchema,
});

export type CommitmentStepType = z.infer<typeof CommitmentStepTypeSchema>;
