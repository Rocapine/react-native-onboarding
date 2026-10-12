import type { PresentResult } from "@rocapine/react-native-onboarding";
import type { CompleteOutcome } from "../Runtime/ScreenHost";

// `usePaywallHost().complete` takes the CLOSED `PresentResult` union
// (required argument); `ScreenHost.complete` takes the OPEN `CompleteOutcome`
// (optional argument — a bare `"continue"` action calls it with none at all).
// This function ONLY does that narrowing — nothing more.
//
// The engine itself only ever produces `undefined` (bare `"continue"`) or
// `{status:"dismissed"}` (the `dismiss` action — see `runActions.ts`) —
// `dismiss` doesn't know anything about purchase state, so a purchase closed
// via spec §4.6's `{type:"purchase", onSuccess:[{type:"dismiss"}]}` narrows
// to `"dismissed"` right here too, unchanged. The "did a purchase actually
// happen" upgrade to `"purchased"`/`"cancelled"` is NOT this function's job:
// it happens one level up, in `PaywallProvider`'s `purchase()` wrapper
// (records the outcome on the presentation the purchase started on, so a
// stale in-flight purchase from a PREVIOUS presentation never reaches the
// current one) and its `complete()` (applies `resolvePresentedOutcome`) — both in `present.ts` /
// `PaywallProvider.tsx`, where the product runtime and the pending
// `present()` resolver already live. This function still checks the status
// against the closed set (rather than hardcoding `"dismissed"`) purely so a
// genuinely explicit status forwards unchanged instead of being clobbered.
const PRESENT_RESULT_STATUSES: ReadonlySet<PresentResult["status"]> = new Set([
  "purchased",
  "dismissed",
  "cancelled",
  "error",
]);

export function toPresentResult(outcome?: CompleteOutcome): PresentResult {
  const status = outcome?.status;
  if (status && (PRESENT_RESULT_STATUSES as ReadonlySet<string>).has(status)) {
    return { status: status as PresentResult["status"] };
  }
  return { status: "dismissed" };
}

/**
 * The `transaction` a custom screen passed to `complete()` (#287), read so it
 * can never cost the presentation: a throwing getter yields `undefined`, and so
 * does any status but `purchased` (with a warning, since the screen meant to
 * report something). Returned raw: the headless handle sanitizes it. Shared by
 * `PaywallHost` and the inline `Paywall` step.
 */
export function takeTransaction(outcome: unknown): unknown {
  let status: unknown;
  let transaction: unknown;
  try {
    if (typeof outcome !== "object" || outcome === null) return undefined;
    transaction = (outcome as { transaction?: unknown }).transaction;
    status = (outcome as { status?: unknown }).status;
  } catch (error) {
    console.warn("[paywalls] complete()'s transaction could not be read; it was dropped:", error);
    return undefined;
  }
  if (transaction === undefined) return undefined;
  if (status !== "purchased") {
    console.warn(`[paywalls] complete() was given a transaction with status "${String(status)}"; it was dropped.`);
    return undefined;
  }
  return transaction;
}

const presentationIds = new WeakMap<object, number>();
let lastPresentationId = 0;

/**
 * The React key of `PaywallHost`'s content for one presentation: the paywall
 * id plus a number for the `usePaywallHost().complete` it was rendered with,
 * which the provider binds to ONE presentation (a new identity per
 * presentation). `ScreenRenderer` reads `complete` through a ref at call
 * time, so content REUSED across two presentations would hand the old one's
 * still-running action chain the new one's `complete`. A same-moment
 * re-present batched into one render does exactly that under a key of the
 * paywall id alone. A headless older than the binding keeps one `complete`
 * for its life, so the key degrades to the paywall id, as before.
 */
export const presentationContentKey = (paywallId: string, complete: object): string => {
  let id = presentationIds.get(complete);
  if (id === undefined) {
    id = ++lastPresentationId;
    presentationIds.set(complete, id);
  }
  return `${paywallId}:${id}`;
};
