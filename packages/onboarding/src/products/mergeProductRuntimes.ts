import type { ProductRuntime, ProductStatus } from "./types";

const mergeStatus = (a: ProductStatus, b: ProductStatus): ProductStatus => {
  if (a === "error" || b === "error") return "error";
  if (a === "ready" && b === "ready") return "ready";
  if (a === "loading" || b === "loading") return "loading";
  return "idle";
};

/**
 * Publishes ONE `ProductRuntime` out of the shared context runtime (a
 * `PaywallProvider` ancestor's catalog union) and this `OnboardingProvider`'s
 * own local resolution of its `productRefs` prop.
 *
 * Finding 5, 2026-08-17 final review: `OnboardingProvider` used to zero the
 * local ref set out entirely whenever a context runtime existed, on the
 * assumption that the paywall catalog's product union is always a superset of
 * whatever `productRefs` the host declares — an assumption about a
 * host-supplied prop, not a property of the code. That silently broke a
 * documented Phase 3 prop the moment a host added a `PaywallProvider` above
 * an existing `OnboardingProvider`: `productRefs` keys absent from the
 * catalog union resolved to nothing, with no error and nothing that
 * type-checks. `productRefs` is therefore ALWAYS resolved locally now,
 * regardless of whether a context runtime exists (see
 * `resolveLocalProductArgs`) — this function unions the result back into the
 * one `ProductRuntime` the rest of the app reads.
 *
 * Returns `contextRuntime` UNCHANGED when there is nothing local to add
 * (`hasLocalRefs` false — the common case: no host-declared `productRefs`),
 * so the well-established "one shared runtime, no local round trip" identity
 * and behavior is untouched for every app that doesn't use this prop.
 *
 * `purchase` routes by key: a key resolved by the LOCAL runtime purchases
 * through the local provider (it is the only one that resolved it); anything
 * else — including an unknown key — goes through the context runtime, which
 * already reports "No resolved product for key" for that case (`useProducts.
 * purchase`), so no separate handling is needed here. `restore` delegates to
 * the context runtime only: restoring is a whole store-account operation, not
 * scoped to individual refs, so one call through the shared adapter is
 * correct even with a local ref set also present — the same billing adapter
 * type is the expected real-world setup for both `productProvider` props.
 */
export const mergeProductRuntimes = (
  contextRuntime: ProductRuntime,
  localRuntime: ProductRuntime,
  hasLocalRefs: boolean
): ProductRuntime => {
  if (!hasLocalRefs) return contextRuntime;
  return {
    products: { ...contextRuntime.products, ...localRuntime.products },
    status: mergeStatus(contextRuntime.status, localRuntime.status),
    error: contextRuntime.error ?? localRuntime.error,
    purchasing: contextRuntime.purchasing || localRuntime.purchasing,
    purchase: (key: string) =>
      key in localRuntime.products ? localRuntime.purchase(key) : contextRuntime.purchase(key),
    restore: contextRuntime.restore,
  };
};
