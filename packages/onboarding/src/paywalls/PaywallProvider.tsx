import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { getPaywallsQuery } from "./getPaywalls.query";
import { Paywall, PaywallCatalog, PresentResult } from "./types";
import { collectProductRefs, computeIsReady, resolvePresentDecision } from "./present";
import { useProducts } from "../products/useProducts";
import { ProductProvider } from "../products/types";
import { ProductRuntimeContext } from "../products/ProductRuntimeContext";
import type { CustomActions } from "../infra/provider/OnboardingProvider";

// Module-scope, private to this file — mirrors `OnboardingProvider.tsx:17-23`.
// `OnboardingProvider`'s QueryClient is not exported, so it cannot be reused
// here; a second, independent cache is intentional, not an oversight — the
// paywall catalog and the onboarding step payload are different resources
// with different lifetimes and different AsyncStorage namespaces
// (`rocapine-paywalls-*` vs `rocapine-onboarding-*`, see
// `infra/queries/cacheKey.ts`).
const paywallQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

// Frozen at module scope, not a default PARAMETER — a default parameter
// re-allocates on every render, and `customActions` sits in the published
// context value (read by `usePaywallHost()` to build the presented paywall's
// `ScreenHost`), so an unstable identity would defeat memoization the same
// way `EMPTY_CUSTOM_ACTIONS` in `OnboardingProvider.tsx` documents.
const EMPTY_CUSTOM_ACTIONS: CustomActions = Object.freeze({});

/**
 * Everything a paywall consumer or a paywall HOST needs. Deliberately one
 * context carrying both, mirroring how `OnboardingProgressContext` bundles
 * far more than any single hook reads — `usePaywall()` and `usePaywallHost()`
 * each slice out the fields they need, same pattern as the small hooks in
 * `infra/hooks/` slicing `OnboardingProgressContext`.
 */
export type PaywallContextValue = {
  present: (placement: string) => Promise<PresentResult>;
  isReady: boolean;
  catalog: PaywallCatalog | null;
  /** The paywall currently being presented, or null. Read by `usePaywallHost()` — not by `usePaywall()`. */
  activePaywall: Paywall | null;
  /**
   * Resolve the pending `present()` call and clear the active placement.
   * Call this from the presented paywall's `ScreenHost.complete` (Task 7's
   * `PaywallHost`) — never from an ordinary consumer.
   */
  complete: (result: PresentResult) => void;
  /** Forwarded into the presented paywall's `ScreenHost.customActions`. */
  customActions: CustomActions;
};

const EMPTY_PAYWALL_CONTEXT: PaywallContextValue = {
  present: async () => ({ status: "error" }),
  isReady: false,
  catalog: null,
  activePaywall: null,
  complete: () => {},
  customActions: EMPTY_CUSTOM_ACTIONS,
};

export const PaywallContext = createContext<PaywallContextValue>(EMPTY_PAYWALL_CONTEXT);

/**
 * The seam a paywall HOST (Task 7's `PaywallHost`) reads from — analogous to
 * `ScreenHost` being the seam the rendering engine reads from. Kept out of
 * `usePaywall()`'s return so an ordinary caller never sees presentation
 * internals it has no reason to touch (which paywall is active, how to
 * resolve it).
 */
export const usePaywallHost = (): Pick<PaywallContextValue, "activePaywall" | "complete" | "customActions"> => {
  const { activePaywall, complete, customActions } = useContext(PaywallContext);
  return { activePaywall, complete, customActions };
};

interface PaywallProviderProps {
  children: React.ReactNode;
  client: OnboardingStudioClient;
  locale?: string;
  customAudienceParams?: Record<string, any>;
  /**
   * Billing adapter. Products are resolved once, over the union of every
   * `paywall.products[]` in the catalog (deduplicated), and published via
   * `ProductRuntimeContext` — an `OnboardingProvider` mounted anywhere inside
   * this tree picks up the SAME runtime instead of resolving its own, so
   * there is one store round-trip and one `purchasing` flag for both.
   */
  productProvider?: ProductProvider;
  /** Handlers for `{ type: "custom" }` ButtonActions inside a paywall's elements. */
  customActions?: CustomActions;
}

interface PaywallProviderInnerProps {
  children: React.ReactNode;
  client: OnboardingStudioClient;
  locale: string;
  customAudienceParams: Record<string, any>;
  productProvider?: ProductProvider;
  customActions: CustomActions;
}

const PaywallProviderInner = ({
  children,
  client,
  locale,
  customAudienceParams,
  productProvider,
  customActions,
}: PaywallProviderInnerProps) => {
  const [catalog, setCatalog] = useState<PaywallCatalog | null>(null);
  const { error } = useQuery<PaywallCatalog>(
    getPaywallsQuery(client, locale, customAudienceParams, setCatalog)
  );

  useEffect(() => {
    if (!error) return;
    // Deliberately NOT thrown. `OnboardingProvider` throws its query error so
    // a host `ErrorBoundary` around a single onboarding screen catches it —
    // but `PaywallProvider` wraps the WHOLE app (spec §7:
    // `<PaywallProvider><App/><PaywallHost/></PaywallProvider>`), so throwing
    // here would crash every screen over a paywall-catalog failure alone.
    // Instead: `catalog` simply stays null, `present()` on any placement
    // resolves "error" (see `resolvePresentDecision` — an unresolved catalog
    // looks identical to an unknown placement), and `isReady` stays false.
    console.warn("[paywalls] Failed to load paywall catalog:", error);
  }, [error]);

  // Union of every placement's products, deduplicated, resolved ONCE — never
  // re-keyed per presented paywall. See `present.ts`'s `collectProductRefs`
  // doc for why (spec §6.1's "render instantly on tap" requirement).
  const productRefs = useMemo(() => collectProductRefs(catalog), [catalog]);
  const productRuntime = useProducts(productRefs, productProvider, locale);

  const [activePlacement, setActivePlacement] = useState<string | null>(null);
  // Refs so `present`/`complete` stay referentially stable (empty deps) while
  // still reading current state — same pattern `useProducts.ts` uses for its
  // `purchase`/`restore` callbacks.
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const activePlacementRef = useRef(activePlacement);
  activePlacementRef.current = activePlacement;
  const pendingResolveRef = useRef<((result: PresentResult) => void) | null>(null);

  // present() must not fetch anything — the catalog and products are already
  // resolved (or resolving) from mount. It only decides, synchronously,
  // whether to show the Modal.
  const present = useCallback((placement: string): Promise<PresentResult> => {
    const decision = resolvePresentDecision(catalogRef.current, activePlacementRef.current, placement);
    if (decision.type === "immediate") {
      return Promise.resolve(decision.result);
    }
    return new Promise<PresentResult>((resolve) => {
      pendingResolveRef.current = resolve;
      setActivePlacement(placement);
    });
  }, []);

  // Called by PaywallHost (Task 7) from the presented paywall's
  // `ScreenHost.complete`. Resolves whatever `present()` call is pending and
  // clears the active placement, hiding the Modal and allowing a new
  // `present()` to start. Safe to call with nothing pending (no-ops).
  const complete = useCallback((result: PresentResult) => {
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    setActivePlacement(null);
    resolve?.(result);
  }, []);

  const activePaywall = activePlacement ? catalog?.paywalls[activePlacement] ?? null : null;

  const isReady = useMemo(
    () => computeIsReady(catalog, productRefs, productRuntime.status),
    [catalog, productRefs, productRuntime.status]
  );

  const contextValue = useMemo<PaywallContextValue>(
    () => ({ present, isReady, catalog, activePaywall, complete, customActions }),
    [present, isReady, catalog, activePaywall, complete, customActions]
  );

  return (
    <ProductRuntimeContext.Provider value={productRuntime}>
      <PaywallContext.Provider value={contextValue}>{children}</PaywallContext.Provider>
    </ProductRuntimeContext.Provider>
  );
};

/**
 * App-level ancestor. Renders ABOVE `OnboardingProvider`, not inside it —
 * that is what lets both share one `ProductRuntimeContext` (React context
 * only flows to descendants; two true siblings could not share one runtime).
 *
 * ```tsx
 * <PaywallProvider client={client} productProvider={revenueCatProductProvider(Purchases)}>
 *   <App />
 *   <PaywallHost /> // Task 7: renders the active paywall in a fullScreen RN Modal
 * </PaywallProvider>
 * ```
 */
export const PaywallProvider = ({
  children,
  client,
  locale = "en",
  customAudienceParams = {},
  productProvider,
  customActions = EMPTY_CUSTOM_ACTIONS,
}: PaywallProviderProps) => {
  return (
    <QueryClientProvider client={paywallQueryClient}>
      <PaywallProviderInner
        client={client}
        locale={locale}
        customAudienceParams={customAudienceParams}
        productProvider={productProvider}
        customActions={customActions}
      >
        {children}
      </PaywallProviderInner>
    </QueryClientProvider>
  );
};
