import type { Paywall, PaywallCatalog, PresentResult } from "./types";
import type { ProductRef, ProductStatus, PurchaseResult } from "../products/types";

/**
 * Union of every `paywall.products[]` across the WHOLE catalog, deduplicated
 * by content — the same identity notion `useProducts`' `refsKey` uses
 * (`products/useProducts.ts:41-45`: keyed on ref CONTENT, not array
 * identity), so this array is exactly as cheap to pass as a hand-written one:
 * `useProducts` resolves it once and does not refetch on every render.
 *
 * Resolving the whole catalog's union ONCE at load — rather than re-keying
 * `useProducts` per presented paywall — is the deliberate design decision:
 * a paywall must render the instant the user taps upgrade (spec §6.1), and a
 * store round-trip at that moment is exactly the latency this avoids. Cost
 * accepted: an app resolves products for paywalls it may never show.
 */
export const collectProductRefs = (catalog: PaywallCatalog | null): ProductRef[] => {
  if (!catalog) return [];
  const seen = new Set<string>();
  const refs: ProductRef[] = [];
  for (const paywall of Object.values(catalog.paywalls)) {
    for (const ref of paywall.products) {
      const identity = `${ref.key}|${ref.ios ?? ""}|${ref.android ?? ""}|${ref.compareTo ?? ""}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      refs.push(ref);
    }
  }
  return refs;
};

/** What `present()` should do, decided as a pure function of current state. */
export type PresentDecision =
  | { type: "start"; paywall: Paywall }
  | { type: "immediate"; result: PresentResult };

/**
 * `present(moment)`'s edge-case decision, extracted so both documented
 * edge cases are covered by an importable test rather than only inspection:
 *
 * - **Unknown moment** (absent from the catalog, or the catalog hasn't
 *   resolved yet — both look identical here: `catalog?.paywalls[moment]`
 *   is `undefined` either way) → resolves `"error"`, never throws. A missing
 *   moment must not crash a host app mid-flow.
 * - **`present()` called while another paywall is already showing** → also
 *   resolves `"error"` immediately, leaving the in-progress presentation
 *   untouched. This SDK shows one paywall at a time. Silently replacing the
 *   active paywall would orphan its pending `present()` promise (never
 *   resolved — that caller hangs forever); queueing the new request would
 *   need its own cancellation/timeout story that nothing here asks for.
 *   Resolving the new call immediately applies the same "resolve, don't
 *   throw" contract as the unknown-moment case, consistently.
 */
export const resolvePresentDecision = (
  catalog: PaywallCatalog | null,
  activeMoment: string | null,
  moment: string
): PresentDecision => {
  if (activeMoment !== null) {
    // `activeMoment` is echoed back deliberately — see PresentErrorReason.
    return {
      type: "immediate",
      result: { status: "error", reason: "already-presenting", activeMoment },
    };
  }
  const paywall = catalog?.paywalls[moment];
  if (!paywall) {
    return { type: "immediate", result: { status: "error", reason: "unknown-moment" } };
  }
  return { type: "start", paywall };
};

/**
 * Whether an in-progress presentation should be abandoned because the host
 * never confirmed it appeared.
 *
 * The failure this recovers from, observed in production: iOS refuses to
 * present a view controller over one that is already presenting — another
 * `Modal`, a `presentation: "modal"` route, a StoreKit alert. `present()` has
 * already set `activePlacement` by then, but the host's Modal never actually
 * appears, so nothing ever calls `complete()`. The pending promise never
 * settles and `activePlacement` stays set for the life of the process, which
 * makes EVERY later `present()` resolve `"already-presenting"` — for any
 * placement, silently, on a monetisation surface.
 *
 * The sibling self-heal in `PaywallProvider` cannot cover it: that one requires
 * `activePaywall` to be null, and here it is non-null (the catalog still holds
 * the paywall perfectly well — only the platform refused to show it).
 *
 * Why an ACKNOWLEDGEMENT and not a bare timeout: a paywall a user is reading
 * legitimately stays active for minutes, so elapsed time alone cannot
 * distinguish "still on screen" from "never appeared". The host confirms
 * presentation (the UI host wires this to its Modal's `onShow`), and only an
 * unacknowledged presentation is ever torn down.
 */
export const shouldBreakPresentationWedge = (
  activePlacement: string | null,
  hostAcknowledged: boolean,
  timedOut: boolean
): boolean => activePlacement !== null && !hostAcknowledged && timedOut;

/**
 * What the catalog is doing right now — the states `isReady` collapses.
 *
 * `isReady` is a single boolean over at least three distinct situations (no
 * catalog yet, a catalog whose products are still resolving, and a failed query
 * — which also presents as `catalog === null`). A host deciding "wait for the
 * catalog" versus "fall back to another paywall engine" cannot tell those apart
 * from one boolean, and every host that needs the distinction ends up building
 * its own multi-input gate.
 *
 * `"revalidating"` is the state that motivated this, and it is not cosmetic.
 * In production the catalog is served CACHE-FIRST from AsyncStorage under a key
 * that is NOT scoped by `customAudienceParams` (`getPaywalls.query.ts` — the
 * react-query key is param-scoped, the disk key is a bare constant). So a host
 * sending volatile params gets an instantly-available catalog that was resolved
 * under DIFFERENT params, with a fresh fetch in flight behind it. That catalog
 * is present and non-null, so it reads as ready — and a host gating on
 * `catalog.paywalls[moment]` can conclude the moment does not exist and
 * route away, milliseconds before the correct catalog arrives.
 *
 * Observed consequence, reported from a production pilot: for an audience gated
 * on a threshold (`hoursSinceOnboardingPaywall >= 44`), the launch where a user
 * first becomes eligible is served the PRE-threshold catalog, so the arm under
 * test loses exactly the launch that matters. `"revalidating"` is how a host
 * distinguishes "this catalog is final" from "this catalog may be superseded in
 * a moment", and therefore whether a missing moment means absent or not-yet.
 *
 * A present catalog outranks an error deliberately: if a background
 * revalidation fails, react-query keeps the cached `data` AND sets `error`, and
 * a usable catalog should not be reported as a failure.
 */
export type CatalogStatus = "loading" | "ready" | "revalidating" | "error";

export const computeCatalogStatus = (
  catalog: PaywallCatalog | null,
  error: unknown,
  isFetching: boolean
): CatalogStatus => {
  if (catalog !== null) return isFetching ? "revalidating" : "ready";
  if (error) return "error";
  return "loading";
};

/**
 * `isReady` = catalog resolved AND products resolved — the one flag a caller
 * needs to know "presenting now will not show a spinner".
 *
 * The `productRefs.length === 0` branch handles a real edge case:
 * `useProducts` never leaves status `"idle"` when its ref set is empty
 * (`products/useProducts.ts:49-54` bails out before ever calling the
 * provider) — a catalog whose paywalls declare no products at all would
 * otherwise report `isReady: false` forever, with nothing to actually wait
 * for.
 */
export const computeIsReady = (
  catalog: PaywallCatalog | null,
  productRefs: ProductRef[],
  productsStatus: ProductStatus
): boolean => catalog !== null && (productRefs.length === 0 || productsStatus === "ready");

/**
 * What a purchase attempt resolved to during the current presentation, or
 * `null` if none did. Only the two `PurchaseResult` statuses that describe a
 * completed store interaction are tracked — `"pending"` (e.g. Ask-to-Buy) and
 * `"error"` are not: they don't describe what happened to the STORE PURCHASE
 * in a way that should override how the paywall itself reports closing (an
 * `"error"` here would collide with `PresentResult`'s existing `"error"`,
 * which means something structurally different — an unknown moment or a
 * mistimed `present()` call, not a failed purchase attempt).
 */
export type PurchaseOutcomeDuringPresentation = "purchased" | "cancelled" | null;

/** Narrows a `PurchaseResult` to the subset `PurchaseOutcomeDuringPresentation` tracks. */
export const purchaseOutcomeFromResult = (result: PurchaseResult): PurchaseOutcomeDuringPresentation =>
  result.status === "purchased" || result.status === "cancelled" ? result.status : null;

/**
 * Reconciles what the closing action REPORTED with what actually happened at
 * the store during this presentation. `dismiss` (spec §4.5) always reports
 * `{status:"dismissed"}` — it is the generic "this screen is done" signal and
 * knows nothing about purchases, which is exactly the gap spec §4.6's own
 * canonical authoring shape falls into: `{type:"purchase", onSuccess:
 * [{type:"dismiss"}]}` closes a successful purchase through the SAME generic
 * signal a user backing out would produce. So a bare `"dismissed"` is treated
 * as "the caller didn't have anything more specific to say" and gets upgraded
 * to whatever the store actually did (if anything). Any other reported
 * status is assumed to mean something deliberate and passes through
 * unchanged — this only fills in the generic default, never overrides a
 * caller that already said something more specific.
 */
export const resolvePresentedOutcome = (
  reported: PresentResult,
  purchaseOutcome: PurchaseOutcomeDuringPresentation
): PresentResult =>
  reported.status === "dismissed" && purchaseOutcome ? { status: purchaseOutcome } : reported;

/**
 * Guards the purchase-outcome WRITE against a race that resetting the ref at
 * `present()`'s start does not, by itself, prevent: paywall A is showing,
 * `purchase()` is in flight; the user dismisses A (nothing tracked yet, so A
 * correctly resolves `"dismissed"`); paywall B is presented, resetting the
 * tracked outcome; THEN A's stale promise finally settles and would write
 * `"purchased"` into what is now B's tracker — B later reports a purchase
 * the user never made on it. `purchase()` must capture the current
 * generation BEFORE awaiting the store and compare it against the current
 * generation again after — only an unchanged generation means the write is
 * still for the presentation that started it.
 *
 * A monotonic counter, not the moment string: the same moment can
 * legitimately be presented twice in a row, and a string comparison would
 * let a stale write from the FIRST of those two land in the second.
 */
export const shouldRecordPurchaseOutcome = (
  startedInGeneration: number,
  currentGeneration: number
): boolean => startedInGeneration === currentGeneration;
