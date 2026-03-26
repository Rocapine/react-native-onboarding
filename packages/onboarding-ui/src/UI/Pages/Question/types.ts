import { z } from "zod";
import { ButtonSectionSchema, CustomPayloadSchema, InfoBoxSchema } from "../types";

export const AnswerSchema = z.object({
  label: z.string(),
  value: z.string(),
  icon: z.string().nullish(),
  description: z.string().nullish(),
});

export const QuestionStepPayloadSchema = z.object({
  answers: z.array(AnswerSchema),
  title: z.string(),
  subtitle: z.string().nullish(),
  multipleAnswer: z.boolean(),
  infoBox: InfoBoxSchema.nullish(),
});

export const QuestionStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Question"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: QuestionStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
});

export type QuestionStepType = z.infer<typeof QuestionStepTypeSchema>;
