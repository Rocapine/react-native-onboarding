import { useContext } from "react";
import { PaywallContext } from "./PaywallProvider";
import { PaywallCatalog, PresentResult } from "./types";
import type { CatalogStatus } from "./present";
import type { ProductStatus } from "../products/types";

export type UsePaywallResult = {
  /**
   * Present a paywall by moment. Never fetches — the catalog and its
   * products are already resolved (or resolving) from `PaywallProvider`
   * mount, which is the whole point: a paywall must render the instant the
   * user taps upgrade.
   *
   * Resolves `{ status: "error" }` — never throws — when `moment` is
   * absent from the catalog, or when another paywall is already being
   * presented. See `resolvePresentDecision` in `present.ts`.
   */
  present: (moment: string) => Promise<PresentResult>;
  /**
   * `true` once BOTH the catalog and its products have resolved — the one
   * flag meaning "calling `present()` now will not show a spinner".
   */
  isReady: boolean;
  /** The full resolved catalog (every moment), or `null` before it loads. */
  catalog: PaywallCatalog | null;
  /**
   * What the catalog is doing, for hosts that need more than `isReady`'s one
   * bit. `"revalidating"` is the important one: the catalog on hand was served
   * from disk and a fresh fetch is in flight, so a moment missing from it may
   * simply not have arrived yet. Gate "fall back to another engine" on
   * `"ready"`, not merely on a non-null catalog.
   */
  catalogStatus: CatalogStatus;
  /**
   * What the store products are doing — the other half of `isReady`. Lets a
   * host tell "still waiting on the store" from "still waiting on us".
   */
  productsStatus: ProductStatus;
};

/**
 * Read the paywall runtime published by an ancestor `PaywallProvider`.
 * Outside one, returns inert defaults (`present` resolves `"error"`,
 * `isReady: false`, `catalog: null`) rather than throwing — mirrors how
 * `useProductRuntime()` degrades to `null` with no ancestor.
 */
export const usePaywall = (): UsePaywallResult => {
  const { present, isReady, catalog, catalogStatus, productsStatus } =
    useContext(PaywallContext);
  return { present, isReady, catalog, catalogStatus, productsStatus };
};
