import type { Paywall, PaywallCatalog, PresentResult } from "./types";
import type { CatalogStatus } from "./present";

/** The feature `register` gates. May be async; `register` awaits it. */
export type RegisterFeature = () => void | Promise<void>;

/**
 * What `register(moment, feature)` should do, as a pure function of current
 * state — extracted for the same reason `resolvePresentDecision` and
 * `shouldAdvanceOnComplete` are: every branch on a monetisation path gets an
 * importable test rather than inspection.
 */
export type RegisterDecision =
  | { type: "run"; reason: "no-paywall" | "catalog-unavailable" }
  | { type: "present"; paywall: Paywall }
  | { type: "wait" };

/**
 * `wait` is a DECISION rather than something the caller infers from
 * `catalogStatus` itself, so "when may register block?" has exactly one answer in
 * one tested place. The caller awaits the catalog settling and calls this again;
 * the second call cannot return `wait`, because the wait resolves only on
 * `"ready"`/`"error"` and a timeout is treated as `catalog-unavailable` without
 * asking again.
 *
 * `"revalidating"` counts as usable. That is safe only because the AsyncStorage
 * cache key is scoped by audience params: before that, a revalidating catalog
 * might have been resolved under DIFFERENT params, so a missing moment could
 * mean "not yet" rather than "absent". Now a served catalog always matches the
 * current params.
 */
export const resolveRegisterDecision = (
  catalog: PaywallCatalog | null,
  catalogStatus: CatalogStatus,
  moment: string
): RegisterDecision => {
  if (!catalog) {
    // Nothing to decide against yet. "loading" is worth waiting for; anything
    // else with no catalog is terminal.
    return catalogStatus === "loading"
      ? { type: "wait" }
      : { type: "run", reason: "catalog-unavailable" };
  }
  const paywall = catalog.paywalls[moment];
  // A moment absent from a RESOLVED catalog is not a failure: it means the moment
  // is not monetised, or is not authored yet. The feature is free.
  if (!paywall) return { type: "run", reason: "no-paywall" };
  return { type: "present", paywall };
};

/**
 * Whether a completed presentation unlocks the feature. Only a purchase does.
 *
 * This one-liner is correct only because `resolvePresentedOutcome` already
 * upgraded the generic `{status:"dismissed"}` that the canonical authoring shape
 * — `{type:"purchase", onSuccess:[{type:"dismiss"}]}` — produces into
 * `"purchased"` when the store actually charged. Without that upgrade this would
 * refuse the feature to every user who bought.
 *
 * **A Stripe paywall never unlocks on the purchase alone.** `PresentResult` has
 * no `"pending"` status — that belongs to `PurchaseResult` — so a Payment Link
 * checkout surfaces here as whatever its action list reported, in practice
 * `"dismissed"` via its `onPending` branch. The entitlement arrives out-of-band
 * through RevenueCat, so grant access from that webhook rather than from
 * `register`. `runRegister` warns when it is about to present one.
 */
export const shouldRunFeature = (outcome: PresentResult): boolean =>
  outcome.status === "purchased";

/**
 * What `register` resolves to.
 *
 * Returned rather than fire-and-forget so a host can measure how often it ran
 * ungated: `reason: "catalog-unavailable"` is the rate at which failing open is
 * giving features away, and a host that cannot see that number cannot decide
 * whether the default is right for it.
 */
export type RegisterResult =
  | { ran: true; presented: false; reason: "no-paywall" | "catalog-unavailable" }
  | { ran: true; presented: true; reason: "purchased"; outcome: PresentResult }
  | { ran: false; presented: true; reason: "not-purchased"; outcome: PresentResult };

/**
 * Everything `register` reads from its environment, injected.
 *
 * The catalog and its status are read through GETTERS rather than passed by value
 * because `register` may await a wait in the middle: reading them once up front
 * would decide against a catalog that has since arrived, which is the entire
 * point of waiting.
 */
export type RegisterDeps = {
  getCatalog: () => PaywallCatalog | null;
  getCatalogStatus: () => CatalogStatus;
  /** Resolves when the catalog stops loading, or after `timeoutMs`. */
  waitForCatalogSettled: (timeoutMs: number) => Promise<void>;
  present: (moment: string) => Promise<PresentResult>;
  timeoutMs: number;
};

/**
 * `register(moment, feature)`'s whole orchestration.
 *
 * Lives here rather than inside `PaywallProvider` so every branch — both
 * fail-open paths, the wait-once rule, the Stripe warning, and the
 * withhold-on-dismiss case — is covered by a plain async test. This repo has no
 * vitest config, so tests run without a DOM; a provider-rendering test would mean
 * adding jsdom to assert control flow that has nothing to do with rendering.
 *
 * It delegates presentation to the injected `present`, which in the provider is
 * the real one — so the wedge recovery, the purchase-generation race guard and
 * outcome reconciliation all apply unchanged.
 */
export const runRegister = async (
  deps: RegisterDeps,
  moment: string,
  feature?: RegisterFeature
): Promise<RegisterResult> => {
  let decision = resolveRegisterDecision(deps.getCatalog(), deps.getCatalogStatus(), moment);

  if (decision.type === "wait") {
    // Called on a user tap, so it cannot simply fail because the catalog has not
    // landed. In practice a returning user's catalog is already on disk and this
    // resolves immediately.
    await deps.waitForCatalogSettled(deps.timeoutMs);
    decision = resolveRegisterDecision(deps.getCatalog(), deps.getCatalogStatus(), moment);
    // The wait timed out with the catalog still loading. Decide — never wait a
    // second time, or a permanently-loading catalog would park the caller
    // forever in `timeoutMs` increments.
    if (decision.type === "wait") decision = { type: "run", reason: "catalog-unavailable" };
  }

  if (decision.type === "run") {
    if (decision.reason === "catalog-unavailable") {
      // Failing OPEN. The alternative locks every gated feature behind a network
      // call: an offline launch would make the app's features silently dead with
      // no paywall to explain why, which is indistinguishable from a broken app.
      // The cost is real — some sessions get a paid feature free — so it is
      // logged, and the returned `reason` lets a host measure the rate.
      console.warn(
        `[paywalls] register("${moment}") could not reach a verdict (no paywall catalog) ` +
          "and ran the feature ungated. The catalog failed to load, or is still loading " +
          "after the register timeout."
      );
    }
    await feature?.();
    return { ran: true, presented: false, reason: decision.reason };
  }

  if (decision.paywall.billing === "stripe") {
    // See `shouldRunFeature`: a Payment Link checkout never produces a
    // "purchased" PresentResult, so the gated feature cannot unlock from it.
    console.warn(
      `[paywalls] register("${moment}") will present a Stripe-billed paywall. A Payment ` +
        'Link checkout never resolves as "purchased" — the entitlement arrives out-of-band ' +
        "through RevenueCat — so the gated feature will NOT run on a successful checkout. " +
        "Grant access from your RevenueCat entitlement webhook instead."
    );
  }

  const outcome = await deps.present(moment);
  if (shouldRunFeature(outcome)) {
    await feature?.();
    return { ran: true, presented: true, reason: "purchased", outcome };
  }
  // Covers dismissed, cancelled and every `present()` error — including
  // "already-presenting", which needs no branch of its own: the feature does not
  // run and the in-flight paywall is untouched.
  return { ran: false, presented: true, reason: "not-purchased", outcome };
};
