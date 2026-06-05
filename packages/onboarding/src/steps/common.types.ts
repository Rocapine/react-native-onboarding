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

// ── Haptics ───────────────────────────────────────────────────────────────────
// Tactile feedback style for clickable elements. Mirrors expo-haptics
// ImpactFeedbackStyle (Light/Medium/Heavy/Soft/Rigid); "none" disables feedback.
// Opt-in: absent prop or "none" → no haptic. Requires optional peer dep expo-haptics.
export const HapticStyleSchema = z.enum([
  "none",
  "light",
  "medium",
  "heavy",
  "soft",
  "rigid",
]);
export type HapticStyle = z.infer<typeof HapticStyleSchema>;

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
  // Unary presence operators — no `value` required. `empty` is type-aware
  // (empty string / empty array / null|undefined); `null` is strictly
  // null|undefined (a set-but-empty value is "not null" yet "is empty").
  "is_empty",
  "is_not_empty",
  "is_null",
  "is_not_null",
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

/**
 * Operators that test the variable alone and ignore `value`. A LeafCondition
 * using one of these may omit `value`; all other operators require it.
 */
export const UNARY_CONDITION_OPERATORS = [
  "is_empty",
  "is_not_empty",
  "is_null",
  "is_not_null",
] as const satisfies readonly ConditionOperator[];

const UNARY_OPERATOR_SET = new Set<ConditionOperator>(UNARY_CONDITION_OPERATORS);

export const isUnaryConditionOperator = (operator: ConditionOperator): boolean =>
  UNARY_OPERATOR_SET.has(operator);

export const ConditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);
export type ConditionValue = z.infer<typeof ConditionValueSchema>;

export const LeafConditionSchema = z
  .object({
    variable: z.string().min(1),
    operator: ConditionOperatorSchema,
    value: ConditionValueSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!isUnaryConditionOperator(data.operator) && data.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `operator "${data.operator}" requires a value`,
        path: ["value"],
      });
    }
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

// ── Progress mode ─────────────────────────────────────────────────────────────
// Per-step role in the progress-bar denominator. Optional and back-compatible:
// an ABSENT field behaves exactly like today (the step is counted and the bar
// shows per `displayProgressHeader`).
//   - "counted"      — counts toward total + advances position (today's default).
//   - "interstitial" — does NOT count toward total; the bar stays frozen at the
//                      surrounding counted position (welcome/transition screens).
//   - "excluded"     — does NOT count and the bar is hidden on this step
//                      (loaders, paywalls).
export const ProgressModeSchema = z.enum(["counted", "interstitial", "excluded"]);
export type ProgressMode = z.infer<typeof ProgressModeSchema>;

// ── Base step schema ──────────────────────────────────────────────────────────

export const BaseStepTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  /**
   * Optional per-step progress role. Absent ⇒ "counted" (today's behavior).
   * `interstitial`/`excluded` steps are dropped from the progress denominator
   * and from the active position, so the bar advances evenly across the
   * counted steps only. See `useOnboarding` / `OnboardingProvider`.
   */
  progressMode: ProgressModeSchema.optional(),
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
  nextStep: NextStepSchema,
});
