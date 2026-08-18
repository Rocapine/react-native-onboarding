import { useContext } from "react";
import { PaywallContext } from "./PaywallProvider";
import { PaywallCatalog, PresentResult } from "./types";

export type UsePaywallResult = {
  /**
   * Present a paywall by placement. Never fetches — the catalog and its
   * products are already resolved (or resolving) from `PaywallProvider`
   * mount, which is the whole point: a paywall must render the instant the
   * user taps upgrade.
   *
   * Resolves `{ status: "error" }` — never throws — when `placement` is
   * absent from the catalog, or when another paywall is already being
   * presented. See `resolvePresentDecision` in `present.ts`.
   */
  present: (placement: string) => Promise<PresentResult>;
  /**
   * `true` once BOTH the catalog and its products have resolved — the one
   * flag meaning "calling `present()` now will not show a spinner".
   */
  isReady: boolean;
  /** The full resolved catalog (every placement), or `null` before it loads. */
  catalog: PaywallCatalog | null;
};

/**
 * Read the paywall runtime published by an ancestor `PaywallProvider`.
 * Outside one, returns inert defaults (`present` resolves `"error"`,
 * `isReady: false`, `catalog: null`) rather than throwing — mirrors how
 * `useProductRuntime()` degrades to `null` with no ancestor.
 */
export const usePaywall = (): UsePaywallResult => {
  const { present, isReady, catalog } = useContext(PaywallContext);
  return { present, isReady, catalog };
};
