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
 */
export type PresentResult = {
  status: "purchased" | "dismissed" | "cancelled" | "error";
};
