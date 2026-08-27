/**
 * The hard gate on a `Paywall` onboarding step: may this outcome advance the
 * onboarding?
 *
 * Needs no purchase tracking, because an authored paywall ALREADY
 * distinguishes the outcomes in its action list:
 *
 *   `{type:"purchase", onSuccess:[{type:"continue"}]}`
 *       → `complete()` with no outcome → advance
 *   `{type:"dismiss"}`
 *       → `complete({status:"dismissed"})` → stay
 *
 * An ALLOWLIST, not a denylist. `ScreenHost.CompleteOutcome` is an open
 * `{ status: string }`, so an unrecognised status is reachable — and on a gate,
 * advancing for a reason nobody can name is the worse failure. A status added
 * to the SDK in future therefore defaults to "stay" until someone deliberately
 * admits it here.
 *
 * `"pending"` stays, deliberately: a Stripe Payment Link purchase resolves
 * pending, which means UNCONFIRMED. Advancing would grant access for a payment
 * that may never complete.
 */
export function shouldAdvanceOnComplete(outcome?: { status?: string }): boolean {
  const status = outcome?.status;
  if (status === undefined) return true;
  return status === "purchased";
}
