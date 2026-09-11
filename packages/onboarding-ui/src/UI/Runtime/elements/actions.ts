import { z } from "zod";

// Self-contained UI mirror of the headless `ButtonAction` (packages/onboarding
// src/steps/common.types.ts). Kept here as a leaf module (imports only zod) so
// both BaseBoxProps.ts (schema) and shared.ts (runActions dispatch) can depend
// on it without an import cycle. Shared by `Button.actions` and the generic
// `onPress` on every UIElement.

/**
 * Bounded retry for a `custom` action (#191). The cap is REQUIRED and small —
 * see the headless `common.types.ts` doc comment for why there is no
 * "retry until it works" spelling.
 */
export type CustomActionRetry = {
  /** TOTAL attempts, counting the first. 1..10. */
  maxAttempts: number;
  /** Fixed pause between attempts, ms (0..10000). Defaults to 0. */
  delayMs?: number;
  /**
   * How long ONE attempt may take before it counts as failed, ms
   * (1000..300000). Absent means unbounded — see the headless doc comment for
   * why that is the right default and what the bounded case prevents (#264).
   */
  timeoutMs?: number;
};

export const CustomActionRetrySchema = z.object({
  maxAttempts: z
    .number()
    .int("maxAttempts must be a whole number of attempts")
    .min(1, "maxAttempts must be at least 1")
    .max(10, "maxAttempts must be at most 10"),
  delayMs: z.number().min(0).max(10000).optional(),
  timeoutMs: z
    .number()
    .min(1000, "timeoutMs must be at least 1000 (no real handler answers faster)")
    .max(300000, "timeoutMs must be at most 300000 (five minutes)")
    .optional(),
});

export type CustomButtonAction = {
  type: "custom";
  function: string;
  variables?: string[];
  /**
   * Runs once the host handler's promise RESOLVES. Non-terminal — the
   * enclosing list carries on. A gate's `"continue"` belongs here, not after
   * the `custom` action, where it would advance on failure too.
   */
  onResolve?: ButtonAction[];
  /**
   * Runs when the handler FAILS: a throw with every attempt spent, an attempt
   * past `retry.timeoutMs`, or an unregistered `function` name. Not terminal —
   * the enclosing list carries on, as it does for `purchase`/`restore`. See the
   * headless doc comment for why the abort went (#191 / #266).
   */
  onError?: ButtonAction[];
  /** Bounded retry of the handler. Absent means one attempt, no retry. */
  retry?: CustomActionRetry;
};

export const CustomButtonActionSchema: z.ZodType<CustomButtonAction> = z.lazy(() =>
  z.object({
    type: z.literal("custom"),
    function: z.string().min(1, "function must not be empty"),
    variables: z.array(z.string()).optional(),
    onResolve: z.array(ButtonActionSchema).optional(),
    onError: z.array(ButtonActionSchema).optional(),
    retry: CustomActionRetrySchema.optional(),
  })
);

export type SetVariableButtonAction = {
  type: "setVariable";
  name: string;
  value: string;
  label?: string;
  /**
   * When `"expression"`, `value` is evaluated by
   * `./expression.ts` (`evaluateSetVariableExpression`) rather than stored
   * verbatim: `{{var}}` refs, numeric and quoted-string literals, `+ - * /`
   * with parens, and the function stdlib (`min` `max` `abs` `round` `clamp`
   * `addDays` `format` `list` `join` `count` `plural`). See that file's doc
   * comment, and `common.types.ts` in the headless package, for the full
   * grammar and the press-time-only constraint. Defaults to `"literal"`.
   */
  valueMode?: "literal" | "expression";
  kind?: "int" | "float" | "string";
  /**
   * Treat the target variable as the JSON-encoded `string[]` multi-select
   * collection used by `CheckboxGroup` and apply `value` as a set operation
   * (`"append"` / `"remove"` / `"toggle"`) instead of overwriting. `kind` is
   * ignored in this mode. Omit for the default overwrite behavior.
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
  /**
   * Runs when the purchase resolves `"pending"` — unconfirmed, not successful.
   *
   * Not a rare branch on every path: a Stripe Payment Link purchase ALWAYS
   * resolves pending, because `purchase()` opens the link and the browser takes
   * over. Without this hook such a button could not dismiss the paywall or
   * navigate, so the user returned from Safari to an untouched screen.
   *
   * Do NOT grant access here — nothing is paid yet. Read entitlement state.
   */
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

/**
 * UI mirror of the headless `PERMISSION_KINDS` (`common.types.ts`). Re-declared
 * inline per the mirror rule — this module imports only zod on purpose.
 *
 * Every kind is reachable through an OPTIONAL Expo module the runtime
 * dynamic-`require`s at press time; see `./permissions.ts` for the module tried
 * per kind. HealthKit and Screen Time / Family Controls are deliberately absent
 * — they need app-owned entitlements a library cannot declare. Note that the
 * host `requestPermission` resolver does NOT let them in through the back door:
 * this enum is closed, so such a payload fails `invalid_union` before any
 * resolver is consulted. Adding them starts with adding the kind here and in
 * the headless original.
 */
export const PERMISSION_KINDS = [
  "notifications",
  "appTrackingTransparency",
  "locationWhenInUse",
  "camera",
  "microphone",
  "photoLibrary",
] as const;

export type PermissionKind = (typeof PERMISSION_KINDS)[number];

export const PermissionKindSchema = z.enum(PERMISSION_KINDS);

/**
 * Ask the OS for a permission and branch on the answer within the SAME press.
 *
 * `[{type:"custom"}, "continue"]` could already ask-then-advance, but a custom
 * handler's return value is discarded, so a grant and a refusal could only
 * diverge on a LATER screen through a variable the handler wrote. These hooks
 * are ordinary nested `ButtonAction[]`, recursed through `runActions` exactly
 * like `purchase.onSuccess`.
 *
 * `onUnavailable` is "this build cannot ask" — the optional Expo module is not
 * installed, or the platform has no such permission. Omitted, it does NOT fall
 * back to `onDenied` (nobody refused anything, and running that branch recorded
 * a decision the user never made). `runActions` instead completes the screen
 * with this ask's OWN completing action when it has one — `{dismiss}` before
 * `"continue"`, since neither answer was actually given — and otherwise leaves
 * the user where they are. Both paths log a `console.error`.
 */
export type RequestPermissionButtonAction = {
  type: "requestPermission";
  kind: PermissionKind;
  /** Runs when the OS reports the permission granted. */
  onGranted?: ButtonAction[];
  /** Runs when the OS reports it denied, restricted, or dismissed. */
  onDenied?: ButtonAction[];
  /**
   * Runs when this build cannot ask at all. Omitted, the runtime reuses this
   * ask's own completing action (`{dismiss}` before `"continue"`) rather than
   * running `onDenied`.
   */
  onUnavailable?: ButtonAction[];
};

export type ButtonAction =
  | "continue"
  | CustomButtonAction
  | SetVariableButtonAction
  | PurchaseButtonAction
  | RestoreButtonAction
  | DismissButtonAction
  | PresentPaywallButtonAction
  | RequestPermissionButtonAction;

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

export const RequestPermissionButtonActionSchema: z.ZodType<RequestPermissionButtonAction> =
  z.lazy(() =>
    z.object({
      type: z.literal("requestPermission"),
      kind: PermissionKindSchema,
      onGranted: z.array(ButtonActionSchema).optional(),
      onDenied: z.array(ButtonActionSchema).optional(),
      onUnavailable: z.array(ButtonActionSchema).optional(),
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
    RequestPermissionButtonActionSchema,
  ])
);
