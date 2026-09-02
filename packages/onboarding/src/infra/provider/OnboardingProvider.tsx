import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { Onboarding, OnboardingMetadata } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { ComposableVariableEntry } from "../../steps/ComposableScreen/types";
import { FontLoaderGate } from "./FontLoader";
import { extractAssetUrls } from "../preload/extractAssetUrls";
import { preloadAssets } from "../preload/preloadAssets";
import { collectUnknownKeysInSteps, formatUnknownElementKeys } from "../../screens/unknownKeys";
import { OnboardingNavigationAdapter } from "../navigation/types";
import { useUserProperties } from "../../userProperties/useUserProperties";
import { resolveEffectiveParams } from "../../userProperties/effectiveParams";
import {
  OnboardingStudio,
  resolveProviderClient,
  MISSING_CLIENT_MESSAGE,
} from "../../OnboardingStudio";
import { expoRouterAdapter } from "../navigation/expoRouterAdapter";
import { useProducts } from "../../products/useProducts";
import { ProductProvider, ProductRef, ProductRuntime } from "../../products/types";
import { useProductRuntime } from "../../products/ProductRuntimeContext";
import { mergeProductRuntimes } from "../../products/mergeProductRuntimes";

// React Native's dev flag; guarded at every use so non-RN consumers are fine.
declare const __DEV__: boolean;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
})

// Module-scope so the context default is referentially stable — an inline
// object literal here would allocate a fresh value on every read of the
// default, defeating the same stability contract useProducts upholds.
const EMPTY_PRODUCT_RUNTIME: ProductRuntime = {
  products: {},
  status: "idle",
  purchasing: false,
  purchase: async () => ({ status: "error", error: new Error("No ProductProvider") }),
  restore: async () => ({ status: "error", error: new Error("No ProductProvider") }),
};

/**
 * Args for the local `useProducts` call.
 *
 * This function used to zero refs/provider out entirely whenever a
 * `PaywallProvider` (or other ancestor) already published a `ProductRuntime`
 * via `ProductRuntimeContext` — on the assumption that the paywall catalog's
 * product union is always a superset of whatever `productRefs` this
 * `OnboardingProvider` declares. Finding 5 (2026-08-17 final review) found
 * that assumption wrong: it is a claim about a host-supplied prop, not a
 * property of the code, and it silently stopped resolving any `productRefs`
 * key absent from the catalog union the moment a host added a
 * `PaywallProvider` above an existing `OnboardingProvider` — no error,
 * nothing that type-checks, just a variable that renders empty.
 *
 * `productRefs`/`productProvider` are therefore passed through UNCHANGED
 * regardless of whether a context runtime exists — `mergeProductRuntimes`
 * (in `OnboardingProvider` below) unions the resulting local runtime back
 * into the context one. Exported so the pass-through itself is covered by an
 * importable, real test, not only inspection: this is the exact seam Finding
 * 5's silent regression went through.
 */
export const resolveLocalProductArgs = (
  productRefs: ProductRef[] | undefined,
  productProvider: ProductProvider | undefined
): { refs: ProductRef[] | undefined; provider: ProductProvider | undefined } => ({
  refs: productRefs,
  provider: productProvider,
});

// Frozen at module scope, not `= {}` inline: a default PARAMETER re-allocates on
// every render, and `customActions` is a RenderContext dependency, so a host that
// omits the prop would get a fresh `ctx` on every variable write and re-render the
// whole tree. Same reason EMPTY_PRODUCT_RUNTIME above is hoisted.
const EMPTY_CUSTOM_ACTIONS: CustomActions = Object.freeze({});

export type CustomActionHandler = (args: {
  variables: Record<string, ComposableVariableEntry | undefined>;
  /**
   * Write to the live ComposableScreen variable context. Mirrors the declarative
   * `{ type: "setVariable" }` action: it updates both the render store (so
   * `renderWhen` / `{{interpolation}}` react) and the branching store (so a
   * following `"continue"` in the same action list branches on the new value via
   * `resolveNextStepNumber`). `entry` is `{ value, label?, kind? }`.
   */
  setVariable: (name: string, entry: ComposableVariableEntry) => void;
}) => void | Promise<void>;

export type CustomActions = Record<string, CustomActionHandler>;

/**
 * Context passed to `onComplete` when the onboarding ends. Carries the collected
 * variable store and the onboarding metadata. All end nodes are equivalent, so
 * no terminal-step identity is reported.
 */
export type OnboardingCompletionContext = {
  variables: Record<string, any>;
  metadata: OnboardingMetadata | undefined;
};

export type OnboardingCompleteHandler = (
  ctx: OnboardingCompletionContext
) => void | Promise<void>;

interface OnboardingProviderProps {
  children: React.ReactNode;
  /**
   * The studio client. Optional: omit it and the provider uses the client
   * `OnboardingStudio.init({ projectId })` built. Passing one explicitly still
   * wins, so an existing host is unaffected.
   *
   * With neither, this provider THROWS — an onboarding with no client has
   * nothing to render, and a host `ErrorBoundary` gets a message naming both
   * fixes.
   */
  client?: OnboardingStudioClient;
  locale?: string;
  /**
   * Static audience params — build-time facts such as an `onboardingId` or a
   * build channel. Merged UNDER the user-property store (`OnboardingStudio`),
   * which wins per key, and read ONCE, when the onboarding is served: a later
   * change to this prop does not re-resolve the presentation (see
   * `OnboardingDataGate`). Anything that changes at runtime belongs in the store.
   */
  customAudienceParams?: Record<string, any>;
  /**
   * Map of named handlers invokable from ComposableScreen Button `actions`
   * with `{ type: "custom", function: <name>, variables?: [...] }`. Handlers
   * receive the requested variables filtered from the live ComposableScreen
   * variable map, a `setVariable` setter to write back into the context, and
   * may return a Promise.
   */
  customActions?: CustomActions;
  /**
   * Rendered while the onboarding payload is fetched and any remote fonts
   * declared in the response (`onboarding.fonts`) are downloaded and registered.
   * Defaults to `null`.
   */
  fontsFallback?: React.ReactNode;
  /**
   * Navigation adapter used for back navigation (ProgressBar back button) and
   * the per-step focus effect. Defaults to an expo-router-backed adapter that
   * degrades to a no-op when expo-router is not installed. Inject your own to
   * support a different navigation library. Must be a stable reference.
   */
  navigation?: OnboardingNavigationAdapter;
  /**
   * Called when the onboarding completes — i.e. the host reaches a terminal
   * step and invokes `completeOnboarding()` (see the headless
   * `OnboardingProgressContext` / `useOnboardingStep`). Receives the collected
   * `variables` and the onboarding `metadata`. Use it to run post-onboarding
   * logic (mark onboarding done, navigate to paywall/home, etc.). Optional.
   */
  onComplete?: OnboardingCompleteHandler;
  /**
   * Billing adapter. Omit for an app with no paywall. Must be a stable reference.
   */
  productProvider?: ProductProvider;
  /**
   * Product slots to resolve at mount, e.g.
   * `[{ key: "yearly", ios: "com.app.yr", android: "com.app.yr:p1y", compareTo: "monthly" }]`.
   */
  productRefs?: ProductRef[];
}

/**
 * The audience params the onboarding being presented was resolved against —
 * the gate's pinned params (see `OnboardingDataGate`). `null` outside a served
 * onboarding.
 *
 * Read by `useOnboardingStep` / `useOnboardingStart`, whose `useSuspenseQuery`
 * must build the SAME query the gate fetched: same params, same key. Before
 * this existed they built it from the raw `customAudienceParams` prop, so a
 * non-empty user-property store meant two queries under two keys — and the
 * screens rendered the payload resolved WITHOUT the user's properties.
 *
 * Internal: hosts get the served payload through `useOnboarding()`.
 */
export const ServedAudienceParamsContext = createContext<Record<string, string> | null>(null);

/**
 * The audience params the current presentation was resolved against, falling
 * back to the raw `customAudienceParams` prop outside a served onboarding.
 * Internal — the read path for the step hooks.
 */
export const useServedAudienceParams = (): Record<string, any> => {
  const served = useContext(ServedAudienceParamsContext);
  const { customAudienceParams } = useContext(OnboardingProgressContext);
  return served ?? customAudienceParams;
};

// What the query is built with until the pin is taken. Never fetched: the query
// is disabled until the pin exists.
const UNPINNED_PARAMS: Record<string, string> = Object.freeze({});

interface OnboardingDataGateProps {
  client: OnboardingStudioClient;
  locale: string;
  customAudienceParams: Record<string, any>;
  setOnboarding: (onboarding: Onboarding<OnboardingStepType>) => void;
  fontsFallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Fetches the onboarding and holds the subtree until it is there.
 *
 * ## Audience resolution happens at serve time
 *
 * The audience params are resolved ONCE, the moment the user-property store is
 * ready and the onboarding is first served, and pinned for the lifetime of this
 * mount. A served payload is frozen for that presentation: a `setUserProperty`
 * during the flow — or a change to the `customAudienceParams` prop — does not
 * touch the query key, does not refetch, and does not swap the onboarding
 * under the user. Those changes apply to the NEXT serve: the next mount of the
 * provider, or the next launch.
 *
 * This gate used to follow the store reactively, and that was a production
 * hazard rather than a feature: a property written mid-flow changed the merged
 * params, the query key followed them, react-query answered `data: undefined`
 * for the never-seen key, and this gate rendered `null` — unmounting the ENTIRE
 * subtree (in hosts that wrap the whole app: the router reset and every screen
 * lost its state) while it refetched, then remounting. The only host-side
 * workaround was to seed every property before the provider mounted.
 *
 * `PaywallProvider` is deliberately different and deliberately unchanged: a
 * paywall is served at `register(moment)`, so it is right that its catalog
 * follows the store until then, and it never blanks while refetching.
 *
 * ## Refetching
 *
 * The host escape hatch is untouched: `OnboardingStudioClient.clearCache()` plus
 * `queryClient.invalidateQueries({ queryKey: ["onboardingQuestions"] })` still
 * forces a refetch — of the SAME query, so the subtree stays mounted while it
 * lands. It re-serves the pinned audience: a content refresh, not a
 * re-targeting. To re-target with the current properties, present again — a
 * remount of the provider (`key`) is a new serve and resolves afresh. There is
 * no in-place re-pin on purpose: with a different key it could only blank
 * (the defect above) or swap the served onboarding under the user (the rule
 * forbids it).
 *
 * `locale` is not part of the pin: it stays a live key element, as before.
 */
const OnboardingDataGate = ({
  client,
  locale,
  customAudienceParams,
  setOnboarding,
  fontsFallback,
  children,
}: OnboardingDataGateProps) => {
  // Same merge the paywall provider does, for the same reason: one store feeds
  // both waterfalls, so an onboarding audience and a paywall audience can no
  // longer disagree about the same user. See `resolveEffectiveParams`.
  //
  // Held until the store hydrates — otherwise the first fetch of a cold launch
  // is audience-matched against an empty property map. This gate renders
  // `fontsFallback`, the state this gate already shows while the payload
  // loads, so nothing new appears on screen.
  //
  // Then pinned. The ref is written during render, which is the lazy
  // initialisation React allows: it is set exactly once, from the first READY
  // snapshot — a property written during hydration is in it — and the same
  // render enables the query, so the fetch is not a frame late. Later
  // snapshots are read (the subscription cannot be conditional) and ignored.
  const { properties, status: propertiesStatus } = useUserProperties();
  const pinnedParamsRef = useRef<Record<string, string> | null>(null);
  if (pinnedParamsRef.current === null && propertiesStatus === "ready") {
    pinnedParamsRef.current = resolveEffectiveParams(customAudienceParams, properties);
  }
  const params = pinnedParamsRef.current;

  const { data, error } = useQuery<Onboarding<OnboardingStepType>>({
    ...getOnboardingQuery<OnboardingStepType>(
      client,
      locale,
      params ?? UNPINNED_PARAMS,
      setOnboarding
    ),
    enabled: params !== null,
  });

  // Background asset preload: once the payload is available, warm every remote
  // image/video/Lottie/Rive asset so later screens render without a load flash.
  // Fire-and-forget and non-blocking — does NOT gate the FontLoaderGate render.
  // Runs once per payload (the query reference is stable thanks to staleTime:
  // Infinity, whether `data` came from cache or the network).
  const preloadedRef = useRef<Onboarding<OnboardingStepType> | null>(null);
  useEffect(() => {
    if (!data || preloadedRef.current === data) return;
    preloadedRef.current = data;
    preloadAssets(extractAssetUrls(data));

    // Dev-only payload diagnostic: report keys sitting at an element's top level
    // that the schema silently drops (classically `animation` outside `props`,
    // which parses, renders, and simply never animates). Non-fatal by design —
    // rejecting these would turn a no-op into a broken screen. Dev-gated and run
    // once per payload, so it costs production nothing.
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      const report = formatUnknownElementKeys(collectUnknownKeysInSteps(data.steps));
      if (report) console.warn(report);
    }
  }, [data]);

  if (error) throw error;
  if (!data) return <>{fontsFallback ?? null}</>;

  return (
    <ServedAudienceParamsContext.Provider value={params}>
      <FontLoaderGate fonts={data.fonts} fallback={fontsFallback}>
        {children}
      </FontLoaderGate>
    </ServedAudienceParamsContext.Provider>
  );
};

export const OnboardingProvider = ({
  children,
  client: clientProp,
  locale = "en",
  customAudienceParams = {},
  customActions = EMPTY_CUSTOM_ACTIONS,
  fontsFallback,
  navigation = expoRouterAdapter,
  onComplete,
  productProvider,
  productRefs,
}: OnboardingProviderProps) => {
  // An explicit prop wins; otherwise use whatever `OnboardingStudio.init()`
  // built. THROWN rather than degraded, unlike `PaywallProvider`: this provider
  // wraps an onboarding, so a host `ErrorBoundary` catches it and the rest of the
  // app survives — and an onboarding with no client has nothing at all to render,
  // where a paywall-less app is merely un-monetised.
  //
  // Read during render, so `init()` must run BEFORE the first render — at module
  // scope, which is where the warning tells a host to put it.
  const client = resolveProviderClient(clientProp, OnboardingStudio.getClient());
  if (!client) throw new Error(MISSING_CLIENT_MESSAGE);

  const [activeStep, setActiveStep] = useState({
    number: 0,
    displayProgressHeader: false,
  });
  const [totalSteps, setTotalSteps] = useState(0);
  // Measured pixel height of the host-rendered ProgressBar/header (incl. the top
  // safe-area inset it spans). Published by `<ProgressBar>` via onLayout so step
  // content can offset below it without hardcoding a guessed height. 0 when hidden.
  const [headerHeight, setHeaderHeightState] = useState(0);
  const setHeaderHeight = useCallback((height: number) => {
    setHeaderHeightState((prev) => (prev === height ? prev : height));
  }, []);
  const [onboarding, setOnboarding] = useState<Onboarding<OnboardingStepType> | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const variablesRef = useRef<Record<string, any>>(variables);
  const setVariable = useCallback((name: string, value: any) => {
    variablesRef.current = { ...variablesRef.current, [name]: value };
    setVariables(variablesRef.current);
  }, []);
  const getVariables = useCallback(() => variablesRef.current, []);

  // Fires the host `onComplete` with a synchronous snapshot of the collected
  // variables (from the ref, so an answer written via `setVariable` immediately
  // before completing is included) plus the onboarding metadata. Host calls this
  // on the terminal branch instead of inferring completion from a null next step.
  const completeOnboarding = useCallback(() => {
    if (!onComplete) {
      // The terminal branch called completeOnboarding() but no handler is wired,
      // so nothing advances — the user is left on the last screen. Warn instead
      // of failing silently; navigation on completion is the host's job.
      console.warn(
        "[onboarding] completeOnboarding() was called but no `onComplete` handler is set on <OnboardingProvider>. The onboarding will not advance — pass `onComplete` to handle completion (e.g. navigate away)."
      );
      return;
    }
    onComplete({
      variables: variablesRef.current,
      metadata: onboarding?.metadata,
    });
  }, [onComplete, onboarding]);

  // A ProductRuntime may already be published above by a `PaywallProvider`
  // (Phase 5 Task 6) sharing one product catalog with this provider. Hooks
  // can't be called conditionally, so `useProducts` is always called, with
  // this provider's OWN `productRefs`/`productProvider` regardless of whether
  // a context runtime exists (`resolveLocalProductArgs`) — when a context
  // runtime is present, `mergeProductRuntimes` unions the two into the one
  // `ProductRuntime` published below (Finding 5, 2026-08-17 final review: the
  // two runtimes used to never merge, so a context runtime silently made
  // `productRefs` unresolvable). Do not "simplify" this into a conditional
  // hook call.
  const contextRuntime = useProductRuntime();
  const { refs: localProductRefs, provider: localProductProvider } = resolveLocalProductArgs(
    productRefs,
    productProvider
  );
  const localProductRuntime = useProducts(localProductRefs, localProductProvider, locale);
  const hasLocalRefs = (productRefs?.length ?? 0) > 0;
  const hasLocalProvider = !!localProductProvider;
  // Memoized — round 2 of the final review (N1) caught that calling
  // `mergeProductRuntimes` inline in the render body allocates a fresh object
  // (and a fresh `purchase` closure) on EVERY render whenever `hasLocalRefs`,
  // breaking `ScreenHost.products`'s "referentially stable across variable
  // writes" contract (`ScreenHost.ts`) the moment a host uses `productRefs`
  // alongside a `PaywallProvider` ancestor — every memoized element would
  // re-render on every keystroke, since `setVariables` always allocates a new
  // object. Keyed on the two runtimes plus the two booleans that change the
  // merge's shape, exactly the inputs the function reads.
  const productRuntime = useMemo(
    () =>
      contextRuntime
        ? mergeProductRuntimes(contextRuntime, localProductRuntime, hasLocalRefs, hasLocalProvider)
        : localProductRuntime,
    [contextRuntime, localProductRuntime, hasLocalRefs, hasLocalProvider]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <OnboardingProgressContext.Provider
        value={{
          activeStep,
          setActiveStep,
          totalSteps,
          setTotalSteps,
          headerHeight,
          setHeaderHeight,
          client,
          locale,
          customAudienceParams,
          onboarding,
          setOnboarding,
          variables,
          setVariable,
          getVariables,
          completeOnboarding,
          customActions,
          navigation,
          products: productRuntime,
        }}
      >
        <OnboardingDataGate
          client={client}
          locale={locale}
          customAudienceParams={customAudienceParams}
          setOnboarding={setOnboarding}
          fontsFallback={fontsFallback}
        >
          {children}
        </OnboardingDataGate>
      </OnboardingProgressContext.Provider>
    </QueryClientProvider>
  );
};

export const OnboardingProgressContext = createContext<{
  activeStep: { number: number; displayProgressHeader: boolean };
  setActiveStep: (step: { number: number; displayProgressHeader: boolean }) => void;
  totalSteps: number;
  setTotalSteps: (steps: number) => void;
  headerHeight: number;
  setHeaderHeight: (height: number) => void;
  client: OnboardingStudioClient;
  locale: string;
  customAudienceParams: Record<string, any>;
  onboarding: Onboarding<OnboardingStepType> | null;
  setOnboarding: (onboarding: Onboarding<OnboardingStepType>) => void;
  variables: Record<string, any>;
  setVariable: (name: string, value: any) => void;
  getVariables: () => Record<string, any>;
  completeOnboarding: () => void;
  customActions: CustomActions;
  navigation: OnboardingNavigationAdapter;
  products: ProductRuntime;
}>({
  activeStep: { number: 0, displayProgressHeader: false },
  setActiveStep: () => { },
  totalSteps: 0,
  setTotalSteps: () => { },
  headerHeight: 0,
  setHeaderHeight: () => { },
  client: new OnboardingStudioClient('', {}),
  locale: "en",
  customAudienceParams: {},
  onboarding: null,
  setOnboarding: () => { },
  variables: {},
  setVariable: () => { },
  getVariables: () => ({}),
  completeOnboarding: () => { },
  customActions: {},
  navigation: expoRouterAdapter,
  products: EMPTY_PRODUCT_RUNTIME,
});
