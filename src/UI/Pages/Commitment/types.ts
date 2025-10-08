import { z } from "zod";
import { CustomPayloadSchema } from "../types";

export const CommitmentItemSchema = z.object({
  text: z.string(),
});

export const CommitmentStepPayloadSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  commitments: z.array(CommitmentItemSchema).optional(),
  signatureCaption: z.string().default("Your signature is not recorded"),
  variant: z.enum(["signature", "simple"]).default("signature"),
});

export const CommitmentStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Commitment"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: CommitmentStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  figmaUrl: z.string().nullable(),
});

export type CommitmentStepType = z.infer<typeof CommitmentStepTypeSchema>;
