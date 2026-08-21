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
/**
 * Why a presentation resolved `"error"`. Present on every `"error"` result and
 * absent on every other status.
 *
 * This exists because `"error"` alone conflates conditions whose correct
 * recovery is OPPOSITE. `"unknown-placement"` means the catalog may simply not
 * have arrived yet, so retrying later is right. `"already-presenting"` means a
 * presentation is in progress, so retrying is wrong and something may be
 * stuck. A caller given only the status can act correctly on neither, and two
 * separate multi-hour production investigations were spent reconstructing by
 * elimination what the SDK already knew here.
 *
 * - `unknown-placement` — absent from the catalog, or the catalog has not
 *   resolved yet. The two are indistinguishable at this layer, and both are
 *   worth retrying once `usePaywall().isReady` is true.
 * - `already-presenting` — one paywall shows at a time. `activePlacement` on
 *   the result names the one that IS showing: the same placement means the
 *   caller double-called and wants its own in-flight guard, a different one
 *   means something else holds the surface.
 * - `parse-error` — `elements` failed the UI schema, so the Modal was never
 *   opened. A CMS **data** bug (a wrong enum value, say), not a code bug; the
 *   host cannot fix it and the authoring tool must. The UI host logs the
 *   validation issues alongside this.
 * - `render-error` — the element tree threw while rendering and the error
 *   boundary settled the promise rather than trapping the user behind an
 *   escape-less fullScreen Modal.
 * - `host-never-presented` — the host never confirmed the paywall appeared
 *   within the acknowledgement window, so the presentation was abandoned to
 *   keep the surface usable. In practice the platform refused to present
 *   (iOS will not present over an already-presenting view controller — another
 *   Modal, a `presentation: "modal"` route, a StoreKit alert).
 * - `paywall-disappeared` — the placement vanished from the catalog while it
 *   was on screen (a studio publish, or a query-key change mid-presentation).
 */
export type PresentErrorReason =
  | "unknown-placement"
  | "already-presenting"
  | "parse-error"
  | "render-error"
  | "host-never-presented"
  | "paywall-disappeared";

export type PresentResult = {
  status: "purchased" | "dismissed" | "cancelled" | "error";
  /** Why it failed. Set on `"error"` only — see `PresentErrorReason`. */
  reason?: PresentErrorReason;
  /**
   * The placement currently being presented. Set only alongside
   * `reason: "already-presenting"`, where knowing WHICH placement holds the
   * surface is what distinguishes a caller double-call from an unrelated stall.
   */
  activePlacement?: string;
};
