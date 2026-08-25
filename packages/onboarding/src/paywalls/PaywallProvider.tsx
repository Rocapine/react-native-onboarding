import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { getPaywallsQuery } from "./getPaywalls.query";
import { Paywall, PaywallCatalog, PresentResult } from "./types";
import {
  collectProductRefs,
  computeIsReady,
  purchaseOutcomeFromResult,
  computeCatalogStatus,
  type CatalogStatus,
  resolvePresentDecision,
  selectActiveProductRuntime,
  shouldBreakPresentationWedge,
  resolvePresentedOutcome,
  shouldRecordPurchaseOutcome,
  type PurchaseOutcomeDuringPresentation,
} from "./present";
import { useProducts } from "../products/useProducts";
import { ProductProvider, ProductStatus } from "../products/types";
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
  present: (moment: string) => Promise<PresentResult>;
  isReady: boolean;
  catalog: PaywallCatalog | null;
  /**
   * What the catalog is doing — the states `isReady` collapses into one
   * boolean. See `CatalogStatus`; `"revalidating"` in particular means the
   * catalog on hand may be superseded within moments, so a missing moment
   * does not yet mean an absent one.
   */
  catalogStatus: CatalogStatus;
  /**
   * What the store products are doing. The other half of `isReady`: a host that
   * sees `catalogStatus: "ready"` but `isReady: false` can tell it is waiting on
   * the store rather than on us.
   */
  productsStatus: ProductStatus;
  /** The paywall currently being presented, or null. Read by `usePaywallHost()` — not by `usePaywall()`. */
  activePaywall: Paywall | null;
  /**
   * Resolve the pending `present()` call and clear the active moment.
   * Call this from the presented paywall's `ScreenHost.complete` (Task 7's
   * `PaywallHost`) — never from an ordinary consumer.
   */
  complete: (result: PresentResult) => void;
  /**
   * Called by the paywall HOST once the paywall is actually on screen (the UI
   * host wires this to its Modal's `onShow`) — never by an ordinary consumer.
   *
   * Without it a presentation the platform silently refused is
   * indistinguishable from one the user is reading, and the refused case wedges
   * the surface permanently. See `shouldBreakPresentationWedge` in `present.ts`.
   */
  acknowledgePresentation: () => void;
  /** Forwarded into the presented paywall's `ScreenHost.customActions`. */
  customActions: CustomActions;
};

const EMPTY_PAYWALL_CONTEXT: PaywallContextValue = {
  // No provider above: there is no catalog at all, which is the same answer
  // `resolvePresentDecision` gives for an unresolved one.
  present: async () => ({ status: "error", reason: "unknown-moment" }),
  isReady: false,
  catalog: null,
  // No provider above: nothing is loading and nothing will arrive.
  catalogStatus: "loading",
  productsStatus: "idle",
  activePaywall: null,
  complete: () => {},
  acknowledgePresentation: () => {},
  customActions: EMPTY_CUSTOM_ACTIONS,
};

/**
 * How long a presentation may go unacknowledged by the host before it is
 * abandoned. Generous on purpose: a real Modal appears in well under a second,
 * so this only ever elapses when the platform refused outright — and erring
 * long keeps a slow-but-successful presentation from being torn down.
 */
const DEFAULT_PRESENT_ACK_TIMEOUT_MS = 5000;

export const PaywallContext = createContext<PaywallContextValue>(EMPTY_PAYWALL_CONTEXT);

/**
 * The seam a paywall HOST (Task 7's `PaywallHost`) reads from — analogous to
 * `ScreenHost` being the seam the rendering engine reads from. Kept out of
 * `usePaywall()`'s return so an ordinary caller never sees presentation
 * internals it has no reason to touch (which paywall is active, how to
 * resolve it).
 */
export const usePaywallHost = (): Pick<
  PaywallContextValue,
  "activePaywall" | "complete" | "acknowledgePresentation" | "customActions"
> => {
  const { activePaywall, complete, acknowledgePresentation, customActions } =
    useContext(PaywallContext);
  return { activePaywall, complete, acknowledgePresentation, customActions };
};

interface PaywallProviderProps {
  children: React.ReactNode;
  client: OnboardingStudioClient;
  locale?: string;
  customAudienceParams?: Record<string, any>;
  /**
   * Billing adapter for `billing: "store"` paywalls — also the default while
   * no paywall is active, and the fallback for `"stripe"` when
   * `stripeProductProvider` (see that prop) was not passed. Resolved once,
   * over the union of every `paywall.products[]` in the catalog
   * (deduplicated).
   *
   * This adapter's result is NOT unconditionally what gets published: which
   * of `productProvider`'s and `stripeProductProvider`'s resolution reaches
   * `ProductRuntimeContext` depends on the active paywall's `billing` (see
   * `selectActiveProductRuntime`). Whichever one is live, it is published via
   * `ProductRuntimeContext` — an `OnboardingProvider` mounted anywhere inside
   * this tree picks up that SAME runtime instead of resolving its own, so
   * there is one store round-trip and one `purchasing` flag for both.
   */
  productProvider?: ProductProvider;
  /**
   * Billing adapter for `billing: "stripe"` paywalls — normally
   * `stripeLinkProductProvider`. The catalog's product union is resolved
   * through BOTH this and `productProvider`, and the runtime published is the
   * one matching the presented paywall's `billing` (see
   * `selectActiveProductRuntime`). Omit it and every paywall uses
   * `productProvider`, exactly as before this prop existed.
   */
  stripeProductProvider?: ProductProvider;
  /** Handlers for `{ type: "custom" }` ButtonActions inside a paywall's elements. */
  customActions?: CustomActions;
  /**
   * How long to wait for the host to confirm a paywall actually appeared
   * before abandoning the presentation and resolving
   * `{status:"error", reason:"host-never-presented"}`. Defaults to 5000 ms.
   *
   * `null` disables the recovery entirely, which reinstates the failure it
   * exists to prevent: one refused presentation then disables paywalls for the
   * rest of the process. Only pass `null` if the host cannot acknowledge.
   */
  presentAckTimeoutMs?: number | null;
}

interface PaywallProviderInnerProps {
  children: React.ReactNode;
  client: OnboardingStudioClient;
  locale: string;
  customAudienceParams: Record<string, any>;
  productProvider?: ProductProvider;
  stripeProductProvider?: ProductProvider;
  customActions: CustomActions;
  presentAckTimeoutMs: number | null;
}

const PaywallProviderInner = ({
  children,
  client,
  locale,
  customAudienceParams,
  productProvider,
  stripeProductProvider,
  customActions,
  presentAckTimeoutMs,
}: PaywallProviderInnerProps) => {
  // `data` straight off `useQuery` is the single source of truth (Finding 1,
  // 2026-08-17 final review) — react-query's own cache already gets both a
  // provider remount and a locale/customAudienceParams round-trip right; a
  // mirrored `useState` populated from inside `queryFn` does not (it only
  // gets written on a cache MISS). See `getPaywalls.query.ts`'s module doc
  // for why the query still needs `paywallQueryClient` for the ONE case
  // `data` alone can't cover: a background revalidation pushing a fresh
  // payload while this query call already resolved with the cached one.
  const { data, error, isFetching } = useQuery<PaywallCatalog>(
    getPaywallsQuery(client, locale, customAudienceParams, paywallQueryClient)
  );
  const catalog = data ?? null;
  // `isFetching` (not `isLoading`) on purpose: it is also true for a BACKGROUND
  // revalidation behind an already-served cached catalog, which is precisely the
  // case a host needs to see — see `CatalogStatus`.
  const catalogStatus = computeCatalogStatus(catalog, error, isFetching);

  useEffect(() => {
    if (!error) return;
    // Deliberately NOT thrown. `OnboardingProvider` throws its query error so
    // a host `ErrorBoundary` around a single onboarding screen catches it —
    // but `PaywallProvider` wraps the WHOLE app (spec §7:
    // `<PaywallProvider><App/><PaywallHost/></PaywallProvider>`), so throwing
    // here would crash every screen over a paywall-catalog failure alone.
    // Instead: `catalog` simply stays null, `present()` on any moment
    // resolves "error" (see `resolvePresentDecision` — an unresolved catalog
    // looks identical to an unknown moment), and `isReady` stays false.
    console.warn("[paywalls] Failed to load paywall catalog:", error);
  }, [error]);

  // Hoisted above `productRefs`/the product runtimes below: `activeMoment`
  // (state) and `activePaywall` (derived from it) are read by the runtime
  // selection that follows. Bare `useState(null)` with no dependencies, so
  // hoisting past the effects and refs below it changes nothing about hook
  // order.
  const [activeMoment, setActiveMoment] = useState<string | null>(null);
  // Finding 6, 2026-08-17 final review, widened by N2 (round 2): a background
  // catalog revalidation (see `getPaywalls.query.ts`) can push a fresh catalog
  // that no longer contains the moment currently on screen (a studio
  // publish renamed or removed it mid-session) — OR the query KEY itself can
  // change while a paywall is showing (`locale`/`customAudienceParams`
  // changed as a prop), which makes react-query report `data: undefined`
  // while the new key is fetching (Finding 1's fix reads `catalog` straight
  // from that `data`). Both collapse `activePaywall` to null the same way, so
  // guarding on THAT — not on `catalog` being non-null — catches both: the
  // original guard (`!catalog` check) missed the query-key case entirely,
  // because a null `catalog` made it bail out before ever checking whether
  // the moment was still present.
  const activePaywall = activeMoment ? catalog?.paywalls[activeMoment] ?? null : null;

  // Union of every moment's products, deduplicated, resolved ONCE — never
  // re-keyed per presented paywall. See `present.ts`'s `collectProductRefs`
  // doc for why (spec §6.1's "render instantly on tap" requirement).
  const productRefs = useMemo(() => collectProductRefs(catalog), [catalog]);
  // Resolved TWICE — once per billing adapter — because the runtime is
  // published as one map keyed by product key, and a `store` paywall and a
  // `stripe` paywall declaring the same key would otherwise fight over
  // `product.<key>.price`. See `selectActiveProductRuntime`'s doc for why
  // this is cheap rather than wasteful, and why the statuses must not merge.
  const storeRuntime = useProducts(productRefs, productProvider, locale);
  // Free in practice: `stripeLinkProductProvider.getProducts` makes no network
  // call, and refs without a `stripe` block are dropped.
  const stripeRuntime = useProducts(productRefs, stripeProductProvider, locale);
  const productRuntime = selectActiveProductRuntime({
    storeRuntime,
    stripeRuntime,
    billing: activePaywall?.billing,
    hasStripeProvider: stripeProductProvider !== undefined,
  });

  // A studio author can set `billing: "stripe"` on a paywall before the host
  // ships the adapter. Loud, because the symptom otherwise is a paywall that
  // charges through the store while the dashboard says Stripe.
  useEffect(() => {
    if (activePaywall?.billing === "stripe" && !stripeProductProvider) {
      console.warn(
        `[paywalls] "${activePaywall.name}" is set to Stripe billing, but no ` +
          "`stripeProductProvider` was passed to PaywallProvider — falling back to the store " +
          "adapter. Pass `stripeLinkProductProvider({ clientReferenceId })` to honour it.",
      );
    }
  }, [activePaywall, stripeProductProvider]);

  // Tracks what a purchase attempt resolved to during the CURRENT
  // presentation — read by `complete()` to upgrade a generic "dismissed"
  // outcome (see `resolvePresentedOutcome`), reset when a new presentation
  // starts (`present()`'s "start" branch) so one presentation's purchase
  // can never leak into the next.
  const lastPurchaseOutcomeRef = useRef<PurchaseOutcomeDuringPresentation>(null);

  // Monotonic, incremented every time a presentation actually starts (never
  // on the "immediate" no-op branch). Resetting `lastPurchaseOutcomeRef` at
  // that same moment is NOT enough to stop a stale write: paywall A's
  // `purchase()` can still be in flight when the user dismisses A and
  // paywall B is presented (which resets the ref); if A's promise settles
  // AFTER that reset, an unconditional write would land "purchased" in what
  // is now B's tracker. `purchase()` below captures the generation it
  // started in and only writes if that generation is still current — see
  // `shouldRecordPurchaseOutcome`. DO NOT remove the guard because the write
  // "looks" unconditional; that is exactly the race it closes.
  const presentationGenerationRef = useRef(0);

  // Wraps `productRuntime.purchase` to record the outcome above (race-guarded
  // — see `presentationGenerationRef`); every other field (and — critically —
  // the object's change cadence, since `products.purchasing` flips must
  // still propagate) is untouched. `productRuntime.purchase` is itself
  // `useCallback(…, [])`-stable (`useProducts.ts`), so this wrapper never
  // changes identity either.
  const purchase = useCallback(
    async (key: string) => {
      const startedInGeneration = presentationGenerationRef.current;
      const result = await productRuntime.purchase(key);
      const outcome = purchaseOutcomeFromResult(result);
      if (outcome && shouldRecordPurchaseOutcome(startedInGeneration, presentationGenerationRef.current)) {
        lastPurchaseOutcomeRef.current = outcome;
      }
      return result;
    },
    [productRuntime.purchase]
  );
  const productRuntimeWithPurchaseTracking = useMemo(
    () => ({ ...productRuntime, purchase }),
    [productRuntime, purchase]
  );

  // `activeMoment`'s `useState` was hoisted above `productRefs` — see the
  // comment there. Only `hostAcknowledged` is declared here.
  // Whether the host has confirmed THIS presentation is on screen. State, not
  // a ref, because the timeout effect below must re-run (and cancel) the moment
  // it flips.
  const [hostAcknowledged, setHostAcknowledged] = useState(false);
  // Refs so `present`/`complete` stay referentially stable (empty deps) while
  // still reading current state — same pattern `useProducts.ts` uses for its
  // `purchase`/`restore` callbacks.
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  // `activeMomentRef` is made AUTHORITATIVE below — assigned inside
  // `present()`'s start branch and inside `complete()`, not just here. Finding
  // 4, 2026-08-17 final review: this line alone only resyncs the ref from
  // state AFTER React commits, so between a `present()` call and the next
  // commit the ref still holds the PREVIOUS value. Two `present()` calls
  // issued in the same tick (`Promise.all([present("a"), present("b")])`, or
  // two `presentPaywall` actions in one action list) both read the stale ref,
  // both take the "start" branch, and the second overwrites
  // `pendingResolveRef` — the first promise then never settles, exactly the
  // orphaning this whole ref/resolver scheme exists to prevent. Assigning
  // synchronously inside `present`/`complete` closes that window; this
  // render-body line stays only as a resync for the (rare) case something
  // external changes `activeMoment` state without going through either
  // callback.
  const activeMomentRef = useRef(activeMoment);
  activeMomentRef.current = activeMoment;
  const pendingResolveRef = useRef<((result: PresentResult) => void) | null>(null);

  // present() must not fetch anything — the catalog and products are already
  // resolved (or resolving) from mount. It only decides, synchronously,
  // whether to show the Modal.
  const present = useCallback((moment: string): Promise<PresentResult> => {
    const decision = resolvePresentDecision(catalogRef.current, activeMomentRef.current, moment);
    if (decision.type === "immediate") {
      return Promise.resolve(decision.result);
    }
    // Fresh presentation: no purchase has happened under it yet, and any
    // still-in-flight purchase from a PREVIOUS presentation must not be
    // allowed to write into this one — see `presentationGenerationRef`.
    lastPurchaseOutcomeRef.current = null;
    presentationGenerationRef.current += 1;
    // Authoritative NOW, synchronously — see the ref's doc above. A second
    // `present()` call before React commits reads this value, not the stale
    // pre-commit state, and correctly takes the "already showing" branch.
    activeMomentRef.current = moment;
    return new Promise<PresentResult>((resolve) => {
      pendingResolveRef.current = resolve;
      // A new presentation is unacknowledged until the host says otherwise —
      // reset before it starts, or the previous presentation's confirmation
      // would vouch for this one and disable the recovery.
      setHostAcknowledged(false);
      setActiveMoment(moment);
    });
  }, []);

  // Called by PaywallHost (Task 7) from the presented paywall's
  // `ScreenHost.complete`. Resolves whatever `present()` call is pending and
  // clears the active moment, hiding the Modal and allowing a new
  // `present()` to start. Safe to call with nothing pending (no-ops).
  //
  // `resolvePresentedOutcome` upgrades a bare "dismissed" to "purchased" (or
  // "cancelled") when the store actually did something during this
  // presentation — see its doc for why `dismiss`'s own `{status:"dismissed"}`
  // isn't treated as an unoverridable explicit answer.
  const complete = useCallback((result: PresentResult) => {
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    // Authoritative NOW, synchronously — same reasoning as `present()`'s
    // assignment above: a `present()` issued from the resolution continuation
    // (`const r = await present("a"); … present("downsell")` — a downsell
    // opening from the previous paywall's resolution is a canonical pattern,
    // spec §4.5) must see "nothing showing" immediately, not wait for the
    // next commit.
    activeMomentRef.current = null;
    setActiveMoment(null);
    setHostAcknowledged(false);
    resolve?.(resolvePresentedOutcome(result, lastPurchaseOutcomeRef.current));
  }, []);

  // Stable (empty deps) like `present`/`complete`: the host wires this straight
  // into a Modal prop, and an identity change per render would churn it.
  const acknowledgePresentation = useCallback(() => {
    setHostAcknowledged(true);
  }, []);

  // `activePaywall` was hoisted above `productRefs` — see the comment there
  // (Finding 6, 2026-08-17 final review) for why it is derived from
  // `activeMoment` rather than guarded on `catalog` alone.
  //
  // Either way, the Modal closes itself WITHOUT going through `complete()`,
  // so the pending `present()` promise would never settle and
  // `activeMoment` would stay set forever, silently failing every later
  // `present()` call with `"error"` for the rest of the app's life.
  // `complete()` always clears `activeMoment` together with resolving the
  // pending promise, so it cannot race with or double-resolve this branch.
  useEffect(() => {
    if (!activeMoment || activePaywall) return;
    complete({ status: "error", reason: "paywall-disappeared" });
  }, [activeMoment, activePaywall, complete]);

  // The OTHER way a presentation never completes, and the one the guard above
  // structurally cannot catch: `activePaywall` is perfectly non-null — the
  // catalog still holds the paywall — but it never reaches the screen because
  // the platform refused to present it (iOS will not present over an
  // already-presenting view controller: another Modal, a
  // `presentation: "modal"` route, a StoreKit alert). Nothing calls
  // `complete()`, so without this the pending promise never settles,
  // `activeMoment` stays set for the life of the process, and every later
  // `present()` — for any moment — resolves "already-presenting" with no
  // error and no log. Confirmed in production on a monetisation surface, which
  // is why this recovers rather than merely reports.
  //
  // Cancels itself as soon as the host acknowledges, so a paywall a user is
  // reading is never torn down; see `shouldBreakPresentationWedge`.
  useEffect(() => {
    if (presentAckTimeoutMs === null) return;
    if (!shouldBreakPresentationWedge(activeMoment, hostAcknowledged, true)) return;
    const timer = setTimeout(() => {
      console.warn(
        `[paywalls] "${activeMoment}" was never confirmed on screen within ` +
          `${presentAckTimeoutMs}ms and has been abandoned, so later present() calls keep working. ` +
          "The platform most likely refused to present it — on iOS, something else was already " +
          "presenting (another Modal, a `presentation: \"modal\"` route, or a StoreKit alert).",
      );
      complete({ status: "error", reason: "host-never-presented" });
    }, presentAckTimeoutMs);
    return () => clearTimeout(timer);
  }, [activeMoment, hostAcknowledged, presentAckTimeoutMs, complete]);

  const isReady = useMemo(
    () => computeIsReady(catalog, productRefs, productRuntime.status),
    [catalog, productRefs, productRuntime.status]
  );

  const contextValue = useMemo<PaywallContextValue>(
    () => ({
      present,
      isReady,
      catalog,
      catalogStatus,
      productsStatus: productRuntime.status,
      activePaywall,
      complete,
      acknowledgePresentation,
      customActions,
    }),
    [
      present,
      isReady,
      catalog,
      catalogStatus,
      productRuntime.status,
      activePaywall,
      complete,
      acknowledgePresentation,
      customActions,
    ]
  );

  return (
    <ProductRuntimeContext.Provider value={productRuntimeWithPurchaseTracking}>
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
  stripeProductProvider,
  customActions = EMPTY_CUSTOM_ACTIONS,
  presentAckTimeoutMs = DEFAULT_PRESENT_ACK_TIMEOUT_MS,
}: PaywallProviderProps) => {
  return (
    <QueryClientProvider client={paywallQueryClient}>
      <PaywallProviderInner
        client={client}
        locale={locale}
        customAudienceParams={customAudienceParams}
        productProvider={productProvider}
        stripeProductProvider={stripeProductProvider}
        customActions={customActions}
        presentAckTimeoutMs={presentAckTimeoutMs}
      >
        {children}
      </PaywallProviderInner>
    </QueryClientProvider>
  );
};
