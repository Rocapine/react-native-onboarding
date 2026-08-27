import type { StripeProductRef } from "../products/types";

/**
 * Response types for `OnboardingStudioClient.getPaywalls()` (spec §6.1). The
 * endpoint returns every moment for the project/audience/locale in one
 * payload — a paywall must render the instant the user taps upgrade, and a
 * network round-trip at that moment is a conversion bug, so there is no
 * per-moment fetch in the common path (see `PaywallOptions.moment`).
 */

/**
 * A single studio-authored paywall, keyed by `moment` in `PaywallCatalog.paywalls`.
 *
 * `audienceId`/`audienceName` are resolved PER MOMENT, not once for the whole
 * catalog: each moment (an onboarding-end upsell, a settings-screen upgrade,
 * …) runs its own independent audience waterfall, so two entries in the same
 * catalog can legitimately have matched different audiences. That is why
 * these fields live here and not on `PaywallCatalog.metadata`.
 */
export type Paywall = {
  id: string;
  name: string;
  moment: string;
  audienceId: number | null;
  audienceName: string | null;
  /** UIElement[] — parsed by the UI adapter (Task 7's `ScreenElementsSchema`), not here. */
  elements: unknown[];
  /**
   * Which billing path this paywall's buy actions take. `"store"` uses the
   * host's store adapter (`PaywallProvider`'s `productProvider`); `"stripe"`
   * uses `PaywallProvider`'s `stripeProductProvider` and opens a Payment Link.
   *
   * A property of the PAYWALL, not the moment or the project, so one moment
   * audience can weight a `store` variant against a `stripe` variant and ramp
   * the billing change as an A/B test.
   */
  billing: "store" | "stripe";
  products: Array<{
    key: string;
    ios?: string;
    android?: string;
    compareTo?: string;
    stripe?: StripeProductRef;
  }>;
  configuration: Record<string, unknown> | null;
  /**
   * Who draws this paywall. `"elements"` (the default) renders the authored
   * `elements` tree; `"custom"` hands it to a screen the HOST registered under
   * `customScreenId` (see `PaywallHost`'s `customScreens` prop in the UI
   * package), and `elements` is then ignored entirely.
   *
   * A property of the PAYWALL, not the moment — the same reasoning as
   * `billing` above: one moment audience can weight an element-tree variant
   * against a native-screen variant and ramp the change as an A/B test.
   *
   * OPTIONAL, and absent means `"elements"`. Not because the studio omits it
   * (it always sends a value) but because a device on a NEW SDK can be talking
   * to an OLDER `get-paywalls` that predates the field. Treating absent as
   * `"custom"`, or as an error, would break every existing paywall on that
   * pairing; treating it as `"elements"` is exactly the old behaviour.
   */
  renderMode?: "elements" | "custom";
  /**
   * Which host-registered screen renders this paywall. Meaningful only when
   * `renderMode` is `"custom"`.
   *
   * Nullable as well as optional: the studio accepts a custom paywall with no
   * screen id (it warns rather than refusing), so an empty value is a state
   * that genuinely arrives. `PaywallHost` reports it as
   * `{ status: "error", reason: "unknown-custom-screen" }` rather than opening
   * an empty full-screen Modal.
   */
  customScreenId?: string | null;
  /**
   * The product map handed to that screen: slot key to per-platform store
   * product id. This is the one thing a native paywall cannot get from
   * anywhere else — the moment waterfall picked THIS variant, and which
   * products it offers is an authoring decision, not something compiled into
   * the app.
   *
   * Deliberately NOT the same thing as `products` above. Those slots exist to
   * feed `{{product.<key>.price}}` interpolation into an element tree, and a
   * custom screen has no interpolation — so a custom paywall carries product
   * IDS and no prices, and the SDK resolves no store products for it at all
   * (`collectProductRefs` does not walk this map). A native paywall asks the
   * store for its own display prices, which is exactly what it does not need
   * the studio for.
   */
  customPayload?: PaywallCustomPayload;
};

/**
 * `Paywall.customPayload` — slot key to per-platform product id.
 *
 * Both platform fields are optional: a paywall shipped on one platform only is
 * legitimate, and so is a key whose ids have not been filled in yet (the
 * studio warns about that rather than refusing to save it).
 */
export type PaywallCustomPayload = Record<string, { ios?: string; android?: string }>;

/** Full response body of `GET get-paywalls`. */
export type PaywallCatalog = {
  metadata: {
    locale: string | null;
    draft: boolean;
  };
  /** Keyed by moment, not by paywall id. */
  paywalls: Record<string, Paywall>;
  fonts: Record<string, unknown> | null;
};

/**
 * Options for `OnboardingStudioClient.getPaywalls()`.
 *
 * `moment` narrows the response to a single paywall — the exception, not
 * the default. Omit it to get every moment in one round-trip, which is
 * what lets a paywall render instantly at buy-tap time (see the module doc
 * above).
 */
export type PaywallOptions = {
  locale?: string;
  moment?: string;
};

/**
 * Response headers for `get-paywalls`. Deliberately **not** the onboarding
 * trio (`ONBS-Onboarding-Id` / `ONBS-Audience-Id` / `ONBS-Onboarding-Name`) —
 * the paywall endpoint has no single onboarding/audience-name concept and
 * instead reports which paywall ids came back.
 *
 * `ONBS-Audience-Ids` is plural (comma-separated) and parallel in order to
 * `ONBS-Paywall-Ids`: each moment resolves its own audience waterfall (see
 * `Paywall.audienceId`), so there is no single catalog-level audience left
 * to report under a singular header.
 */
export interface GetPaywallsResponseHeaders {
  "ONBS-Audience-Ids": string | null;
  "ONBS-Paywall-Ids": string | null;
}

/**
 * Resolved outcome of a `usePaywall().present(moment)` call (spec §7).
 * Closed union, not the open-ended `ScreenHost.CompleteOutcome` — a
 * presentation ends in exactly one of these four ways, and `present()`'s
 * caller (typically an `await`) should be able to switch over it exhaustively.
 *
 * `"error"` covers both: (a) `moment` is absent from the catalog (or the
 * catalog hasn't resolved yet), and (b) `present()` was called while another
 * paywall is already being presented. Both resolve rather than throw — a
 * missing moment or a mistimed call must not crash a host app mid-flow.
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
 * recovery is OPPOSITE. `"unknown-moment"` means the catalog may simply not
 * have arrived yet, so retrying later is right. `"already-presenting"` means a
 * presentation is in progress, so retrying is wrong and something may be
 * stuck. A caller given only the status can act correctly on neither, and two
 * separate multi-hour production investigations were spent reconstructing by
 * elimination what the SDK already knew here.
 *
 * - `unknown-moment` — absent from the catalog, or the catalog has not
 *   resolved yet. The two are indistinguishable at this layer, and both are
 *   worth retrying once `usePaywall().isReady` is true.
 * - `already-presenting` — one paywall shows at a time. `activeMoment` on
 *   the result names the one that IS showing: the same moment means the
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
 * - `paywall-disappeared` — the moment vanished from the catalog while it
 *   was on screen (a studio publish, or a query-key change mid-presentation).
 * - `unknown-custom-screen` — the paywall is `renderMode: "custom"` and names
 *   a `customScreenId` this host did not register (or names none at all), so
 *   there was nothing to render and the Modal was never opened. Deliberately
 *   NOT folded into `parse-error`: that one is a CMS **data** bug the author
 *   must fix, this is a HOST **wiring** bug the app must fix — opposite
 *   remedies, and conflating them is the exact mistake this union's split
 *   already exists to avoid. `PaywallHost` logs both the missing id and the
 *   ids that ARE registered, which is usually the whole diagnosis.
 */
export type PresentErrorReason =
  | "unknown-moment"
  | "already-presenting"
  | "parse-error"
  | "render-error"
  | "host-never-presented"
  | "paywall-disappeared"
  | "unknown-custom-screen";

export type PresentResult = {
  status: "purchased" | "dismissed" | "cancelled" | "error";
  /** Why it failed. Set on `"error"` only — see `PresentErrorReason`. */
  reason?: PresentErrorReason;
  /**
   * The moment currently being presented. Set only alongside
   * `reason: "already-presenting"`, where knowing WHICH moment holds the
   * surface is what distinguishes a caller double-call from an unrelated stall.
   */
  activeMoment?: string;
};
