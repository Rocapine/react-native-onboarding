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
// Also: `{type:"purchase"}` / `{type:"restore"}` (billing), `{type:"dismiss"}`
// (terminal — finishes the screen with a `{status:"dismissed"}` outcome), and
// `{type:"presentPaywall"}` (asks the host to present a paywall by placement —
// works from an onboarding step or a paywall alike).

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
   * When `"expression"`, `value` is parsed as an expression over `{{var}}`
   * references, numeric literals, quoted string literals, `+ - * /` (parens
   * supported) and a small function stdlib:
   *
   * - numeric — `min(a, b, ...)`, `max(a, b, ...)`, `abs(a)`,
   *   `round(a[, digits])`, `clamp(a, lo, hi)`
   * - dates — `addDays(date, n)`, `format(date, spec[, locale])`. `date` is an
   *   ISO string (what `DatePicker` stores) or the `"now"` sentinel `DatePicker`
   *   already accepts. `spec` is the `DatePicker` `format` prop's Intl
   *   vocabulary: a bare `dateStyle` name (`"medium"`) or `key:value` pairs
   *   (`"weekday:long, month:short, day:numeric"`). Not a token language —
   *   there is no `YYYY-MM-DD`.
   * - listing — `list(x[, conjunction])` ("A, B and C"), `join(x[, separator])`,
   *   `count(x)`, `plural(n, one, other)`. `x` is an untagged multi-select
   *   variable (the JSON `string[]` `CheckboxGroup` writes); member LABELS are
   *   used when present, matching interpolation's label-first precedence. A
   *   scalar answer counts as one member, also by its label. Two things are not
   *   lists and fail the call rather than counting as one: a variable holding a
   *   number (`count({{age}})` — `plural({{age}}, ...)` is what you wanted),
   *   and a value that parses as JSON and is NOT a `string[]` (`"[1,2,3]"`,
   *   `{"a":1}`).
   *
   * **This runs at press time only.** Actions have no mount/appear hook and
   * `Text mode: "expression"` interpolates rather than evaluating, so a
   * headline needing a computed value must have it written to a variable by an
   * earlier press (typically the previous screen's Continue) and then simply
   * interpolated.
   *
   * A quoted literal's CONTENTS interpolate, so `{{var}}` means the same thing
   * everywhere in the template: `list({{goals}}) + " for {{name}}"` reads
   * "… for Ada" rather than emitting the braces to the user.
   *
   * A template with no function call falls back to plain interpolation on parse
   * failure (so `"Hello {{name}}"` still works). A template that *attempts* a
   * call and fails stores the empty string and warns, rather than writing the
   * unevaluated source text into a variable a headline would display verbatim.
   *
   * An **absent** variable reads as numeric 0 wherever it is data — which is
   * what makes increment-before-seed arithmetic and `count()` on a skipped
   * screen work — but is refused wherever it is configuration: a `clamp` bound
   * or a `round` digit count, where a typo'd variable name would otherwise
   * produce a plausible constant (`clamp({{score}}, {{floor}}, {{ceiling}})`
   * reported 0 for a score of 42). The taint follows the value, so it also
   * refuses one that reached a bound through arithmetic or a function
   * (`addDays({{d}}, {{weeks}} * 7)`), but is dropped where the result could
   * have come from an untainted argument: `max({{trialDays}}, 7)` is an
   * explicit default and is honoured, as is `max({{seeded_zero}}, {{absent}})`.
   * A `{{ref}}` inside a quoted LITERAL is guarded the same way when it is
   * configuration: `list`'s conjunction, `join`'s separator, `format`'s spec
   * and its LOCALE, and BOTH `plural` forms. `join({{goals}}, "{{sep}}")` with
   * `sep` unset used to run the members together, and `"en{{sfx}}"` as a locale
   * resolved to the valid `"en"` and silently swapped a date's day and month.
   * `plural` checks its count and both forms — both forms because an absent
   * reference in a form is an authoring error whichever one the count selects,
   * and the count because otherwise an unseeded one picks a form silently and
   * `plural` launders it onward.
   *
   * Two known limits, both deliberate. **`count()` does not taint** — a real
   * zero is what `count({{skipped}})` should give on a screen the user never
   * filled in, and the shipped `plural(count({{goals}}), …)` pattern depends
   * on it — so wrapping a name in `count()` defeats the guard, and
   * `round({{pct}}, count({{digits}}))` answers rather than failing.
   * And **`asDate` accepts any `Date.parse`-able string**,
   * including a bare integer, which no taint can reach because the numbers
   * involved are seeded.
   * "Attempts a call" means a **stdlib name** sits in front of a `(` whose
   * contents could actually be arguments. A bare word BETWEEN the parens makes
   * them punctuation instead, and an unglued `(` after an UNKNOWN identifier
   * is not a call, so the English optional-plural idiom survives:
   * `"{{n}} day(s)"` reads "3 day(s)", `"{{n}} min(s) left"` reads
   * "3 min(s) left", `"Goals ({{n}})"` reads "Goals (2)". A STDLIB name is
   * called glued or not — `"max (2) options"` blanks — so prose starting with
   * one needs `valueMode: "literal"`. A stdlib name DOES outrank bare words outside its own parens,
   * so `list({{goals}}) and more` fails loudly — **there is no implicit
   * concatenation**, and prose beside a call must be joined with `+ "…"`. That
   * is the one rule an author has to know to avoid a blank headline.
   *
   * Two residues, both warned about at runtime: an unknown name glued to a `(`
   * with no bare word anywhere is taken as a misspelled call, so `"Save(50)"`
   * and `"Total({{n}})"` blank (write them with a space); and a template that
   * is nothing but a stdlib call with a bare-word argument — `count(goals)`,
   * the braces forgotten — keeps its text but warns, because it cannot be told
   * apart from `min(s)`.
   *
   * Defaults to `"literal"` — `value` stored verbatim.
   */
  valueMode?: "literal" | "expression";
  /** Tags the stored variable's underlying type. */
  kind?: "int" | "float" | "string";
  /**
   * Treat the target variable as a multi-select collection (the JSON-encoded
   * `string[]` used by `CheckboxGroup`) and apply `value` as a set operation
   * instead of overwriting:
   * - `"append"` — add `value` if absent (dedup; no-op if already present)
   * - `"remove"` — drop `value` if present
   * - `"toggle"` — add when absent, remove when present (matches CheckboxGroup tap)
   *
   * The variable's `value` is stored as `JSON.stringify(string[])` and its
   * `label` as the comma-joined member labels (`label ?? value` for each entry),
   * mirroring `CheckboxGroup`. `kind` is ignored in this mode (the stored value
   * is always a JSON string). Omit `arrayOp` for the default overwrite behavior.
   */
  arrayOp?: "append" | "remove" | "toggle";
};

export const SetVariableButtonActionSchema = z.object({
  type: z.literal("setVariable"),
  name: z.string().min(1, "name must not be empty"),
  value: z.string(),
  label: z.string().optional(),
  valueMode: z.enum(["literal", "expression"]).optional(),
  kind: z.enum(["int", "float", "string"]).optional(),
  arrayOp: z.enum(["append", "remove", "toggle"]).optional(),
});

export type PurchaseButtonAction = {
  type: "purchase";
  /** A product slot key, or an interpolable ref like "{{plan}}". */
  product: string;
  onSuccess?: ButtonAction[];
  onCancel?: ButtonAction[];
  onError?: ButtonAction[];
  /** Runs on `"pending"` — unconfirmed, not paid. A Stripe Payment Link always resolves this. */
  onPending?: ButtonAction[];
};

export type RestoreButtonAction = {
  type: "restore";
  onSuccess?: ButtonAction[];
  onNothingToRestore?: ButtonAction[];
  onError?: ButtonAction[];
};

/** Terminal — finishes the screen with a `{ status: "dismissed" }` outcome. */
export type DismissButtonAction = {
  type: "dismiss";
};

export const DismissButtonActionSchema = z.object({
  type: z.literal("dismiss"),
});

/**
 * Asks the host to present a paywall by placement. Available from an
 * onboarding step or a paywall alike — that is how an onboarding step opens a
 * paywall mid-flow. No-ops (with a warning) on a host that doesn't support it.
 */
export type PresentPaywallButtonAction = {
  type: "presentPaywall";
  /** Paywall placement key to present, e.g. "hard_paywall". */
  placement: string;
};

export const PresentPaywallButtonActionSchema = z.object({
  type: z.literal("presentPaywall"),
  placement: z.string().min(1, "placement must not be empty"),
});

export type ButtonAction =
  | "continue"
  | CustomButtonAction
  | SetVariableButtonAction
  | PurchaseButtonAction
  | RestoreButtonAction
  | DismissButtonAction
  | PresentPaywallButtonAction;

export const PurchaseButtonActionSchema: z.ZodType<PurchaseButtonAction> = z.lazy(() =>
  z.object({
    type: z.literal("purchase"),
    product: z.string().min(1, "product must not be empty"),
    onSuccess: z.array(ButtonActionSchema).optional(),
    onCancel: z.array(ButtonActionSchema).optional(),
    onError: z.array(ButtonActionSchema).optional(),
    onPending: z.array(ButtonActionSchema).optional(),
  })
);

export const RestoreButtonActionSchema: z.ZodType<RestoreButtonAction> = z.lazy(() =>
  z.object({
    type: z.literal("restore"),
    onSuccess: z.array(ButtonActionSchema).optional(),
    onNothingToRestore: z.array(ButtonActionSchema).optional(),
    onError: z.array(ButtonActionSchema).optional(),
  })
);

export const ButtonActionSchema: z.ZodType<ButtonAction> = z.lazy(() =>
  z.union([
    z.literal("continue"),
    CustomButtonActionSchema,
    SetVariableButtonActionSchema,
    PurchaseButtonActionSchema,
    RestoreButtonActionSchema,
    DismissButtonActionSchema,
    PresentPaywallButtonActionSchema,
  ])
);

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

/**
 * Reserved `targetStepId` / `defaultTargetStepId` value that ends the onboarding.
 * When branching resolves to this sentinel, `resolveNextStepNumber` returns
 * `null` (completion) instead of a step number — so a branch or the default
 * target can end the flow from any step, with no trailing screen required.
 * It is not a real step id; no step should use it as its `id`.
 */
export const ONBOARDING_END_STEP_ID = "__END__";

// ── Base step schema ──────────────────────────────────────────────────────────

export const BaseStepTypeSchema = z.object({
  // A step id may not collide with the reserved end sentinel — otherwise the
  // step would be unreachable (branching to it ends the flow instead).
  id: z.string().refine((v) => v !== ONBOARDING_END_STEP_ID, {
    message: `"${ONBOARDING_END_STEP_ID}" is reserved as the onboarding end sentinel and cannot be used as a step id`,
  }),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  buttonSection: ButtonSectionSchema.optional(),
  figmaUrl: z.string().nullish(),
  nextStep: NextStepSchema,
});
