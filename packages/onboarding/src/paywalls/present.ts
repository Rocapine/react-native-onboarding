import type { Paywall, PaywallCatalog, PresentResult } from "./types";
import type { ProductRef, ProductStatus } from "../products/types";

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
 * `present(placement)`'s edge-case decision, extracted so both documented
 * edge cases are covered by an importable test rather than only inspection:
 *
 * - **Unknown placement** (absent from the catalog, or the catalog hasn't
 *   resolved yet — both look identical here: `catalog?.paywalls[placement]`
 *   is `undefined` either way) → resolves `"error"`, never throws. A missing
 *   placement must not crash a host app mid-flow.
 * - **`present()` called while another paywall is already showing** → also
 *   resolves `"error"` immediately, leaving the in-progress presentation
 *   untouched. This SDK shows one paywall at a time. Silently replacing the
 *   active paywall would orphan its pending `present()` promise (never
 *   resolved — that caller hangs forever); queueing the new request would
 *   need its own cancellation/timeout story that nothing here asks for.
 *   Resolving the new call immediately applies the same "resolve, don't
 *   throw" contract as the unknown-placement case, consistently.
 */
export const resolvePresentDecision = (
  catalog: PaywallCatalog | null,
  activePlacement: string | null,
  placement: string
): PresentDecision => {
  if (activePlacement !== null) {
    return { type: "immediate", result: { status: "error" } };
  }
  const paywall = catalog?.paywalls[placement];
  if (!paywall) {
    return { type: "immediate", result: { status: "error" } };
  }
  return { type: "start", paywall };
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
