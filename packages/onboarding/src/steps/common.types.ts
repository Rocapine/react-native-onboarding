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

// ── Press actions ─────────────────────────────────────────────────────────────
// Shared by `Button.actions` and the generic `onPress` on every UIElement
// (BaseBoxProps). An action is `"continue"` (terminal — advances the onboarding),
// `{type:"custom"}` (invokes a host-registered customAction), or
// `{type:"setVariable"}` (writes an onboarding variable). Run sequentially.

export type CustomButtonAction = {
  type: "custom";
  function: string;
  variables?: string[];
};

export const CustomButtonActionSchema = z.object({
  type: z.literal("custom"),
  function: z.string().min(1, "function must not be empty"),
  variables: z.array(z.string()).optional(),
});

export type SetVariableButtonAction = {
  type: "setVariable";
  name: string;
  value: string;
  label?: string;
  /**
   * When `"expression"`, `value` is parsed as an arithmetic expression with
   * `{{var}}` references, numeric literals, and `+ - * /` (parens supported).
   * On parse failure, falls back to plain interpolation (string).
   * Defaults to `"literal"` — `value` stored verbatim.
   */
  valueMode?: "literal" | "expression";
  /** Tags the stored variable's underlying type. */
  kind?: "int" | "float" | "string";
};

export const SetVariableButtonActionSchema = z.object({
  type: z.literal("setVariable"),
  name: z.string().min(1, "name must not be empty"),
  value: z.string(),
  label: z.string().optional(),
  valueMode: z.enum(["literal", "expression"]).optional(),
  kind: z.enum(["int", "float", "string"]).optional(),
});

export type ButtonAction = "continue" | CustomButtonAction | SetVariableButtonAction;

export const ButtonActionSchema = z.union([
  z.literal("continue"),
  CustomButtonActionSchema,
  SetVariableButtonActionSchema,
]);

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
