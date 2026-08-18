/**
 * Response types for `OnboardingStudioClient.getPaywalls()` (spec §6.1). The
 * endpoint returns every placement for the project/audience/locale in one
 * payload — a paywall must render the instant the user taps upgrade, and a
 * network round-trip at that moment is a conversion bug, so there is no
 * per-placement fetch in the common path (see `PaywallOptions.placement`).
 */

/** A single studio-authored paywall, keyed by `placement` in `PaywallCatalog.paywalls`. */
export type Paywall = {
  id: string;
  name: string;
  placement: string;
  /** UIElement[] — parsed by the UI adapter (Task 7's `ScreenElementsSchema`), not here. */
  elements: unknown[];
  products: Array<{
    key: string;
    ios?: string;
    android?: string;
    compareTo?: string;
  }>;
  configuration: Record<string, unknown> | null;
};

/** Full response body of `GET get-paywalls`. */
export type PaywallCatalog = {
  metadata: {
    audienceId: number | null;
    audienceName: string | null;
    locale: string | null;
    draft: boolean;
  };
  /** Keyed by placement, not by paywall id. */
  paywalls: Record<string, Paywall>;
  fonts: Record<string, unknown> | null;
};

/**
 * Options for `OnboardingStudioClient.getPaywalls()`.
 *
 * `placement` narrows the response to a single paywall — the exception, not
 * the default. Omit it to get every placement in one round-trip, which is
 * what lets a paywall render instantly at buy-tap time (see the module doc
 * above).
 */
export type PaywallOptions = {
  locale?: string;
  placement?: string;
};

/**
 * Response headers for `get-paywalls`. Deliberately **not** the onboarding
 * trio (`ONBS-Onboarding-Id` / `ONBS-Audience-Id` / `ONBS-Onboarding-Name`) —
 * the paywall endpoint has no single onboarding/audience-name concept and
 * instead reports which paywall ids came back.
 */
export interface GetPaywallsResponseHeaders {
  "ONBS-Audience-Id": string | null;
  "ONBS-Paywall-Ids": string | null;
}

/**
 * Resolved outcome of a `usePaywall().present(placement)` call (spec §7).
 * Closed union, not the open-ended `ScreenHost.CompleteOutcome` — a
 * presentation ends in exactly one of these four ways, and `present()`'s
 * caller (typically an `await`) should be able to switch over it exhaustively.
 *
 * `"error"` covers both: (a) `placement` is absent from the catalog (or the
 * catalog hasn't resolved yet), and (b) `present()` was called while another
 * paywall is already being presented. Both resolve rather than throw — a
 * missing placement or a mistimed call must not crash a host app mid-flow.
 * See `resolvePresentDecision` in `present.ts` for the exact decision logic.
 *
 * `"purchased"` / `"cancelled"` are NOT produced by any ButtonAction directly
 * — `dismiss` (the only in-content closing action) always reports
 * `{status:"dismissed"}`, on purpose, since it doesn't know anything about
 * purchase state. `PaywallProvider` instead tracks what the store actually
 * did during the active presentation (`purchaseOutcomeFromResult` in
 * `present.ts`) and `resolvePresentedOutcome` upgrades a bare `"dismissed"`
 * to whichever of these occurred, if any — so spec §4.6's canonical authoring
 * shape (`{type:"purchase", onSuccess:[{type:"dismiss"}]}`) resolves
 * `"purchased"` even though `dismiss` itself never says so.
 */
/**
 * How a presentation ENDED — not what the user is entitled to.
 *
 * `"purchased"` means a purchase succeeded while this paywall was showing, and
 * is the honest report in the common case. But it is deliberately not an
 * entitlement signal: a purchase followed by a render crash resolves `"error"`
 * (the boundary settles the promise so the user is not trapped), so a host that
 * keys entitlement off `status === "purchased"` would under-grant a user who
 * genuinely paid.
 *
 * Entitlement belongs to the store — read it from the `ProductProvider` /
 * billing SDK, and use this only to decide what the UI does next.
 */
export type PresentResult = {
  status: "purchased" | "dismissed" | "cancelled" | "error";
};
