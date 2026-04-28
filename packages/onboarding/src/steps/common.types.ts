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

export const ButtonSectionSchema = z.object({
  label: z.string().optional(),
  icon: z.string().nullish(),
});

// ── Branching / nextStep schemas ─────────────────────────────────────────────

export const ConditionOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "contains",
  "in",
  "not_in",
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const ConditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);
export type ConditionValue = z.infer<typeof ConditionValueSchema>;

export const LeafConditionSchema = z.object({
  variable: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: ConditionValueSchema,
});
export type LeafCondition = z.infer<typeof LeafConditionSchema>;

export type ConditionGroup = {
  logic: "and" | "or";
  conditions: Array<LeafCondition | ConditionGroup>;
};

export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(["and", "or"]),
    conditions: z
      .array(z.union([LeafConditionSchema, ConditionGroupSchema]))
      .min(1),
  })
);

export const BranchSchema = z.object({
  condition: z.union([LeafConditionSchema, ConditionGroupSchema]).nullable().default(null),
  targetStepId: z.string().min(1),
});
export type Branch = z.infer<typeof BranchSchema>;

export const NextStepSchema = z
  .object({
    defaultTargetStepId: z.string().min(1),
    branches: z.array(BranchSchema).default([]),
  })
  .nullable()
  .default(null);
export type NextStep = z.infer<typeof NextStepSchema>;

// ── Base step schema ──────────────────────────────────────────────────────────

export const BaseStepTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
  nextStep: NextStepSchema,
});
