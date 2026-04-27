import { z } from "zod";
import { BaseStepTypeSchema, InfoBoxSchema } from "../common.types";

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

export const QuestionStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Question"),
  payload: QuestionStepPayloadSchema,
  variableName: z.string().min(1).optional(),
});

export type QuestionStepType = z.infer<typeof QuestionStepTypeSchema>;
