import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { Onboarding, OnboardingMetadata } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { ComposableVariableEntry } from "../../steps/ComposableScreen/types";
import { FontLoaderGate } from "./FontLoader";
import { extractAssetUrls } from "../preload/extractAssetUrls";
import { preloadAssets } from "../preload/preloadAssets";
import { OnboardingNavigationAdapter } from "../navigation/types";
import { expoRouterAdapter } from "../navigation/expoRouterAdapter";
import { useProducts } from "../../products/useProducts";
import { ProductProvider, ProductRef, ProductRuntime } from "../../products/types";
import { useProductRuntime } from "../../products/ProductRuntimeContext";
import { mergeProductRuntimes } from "../../products/mergeProductRuntimes";

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
  client: OnboardingStudioClient;
  locale?: string;
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

interface OnboardingDataGateProps {
  client: OnboardingStudioClient;
  locale: string;
  customAudienceParams: Record<string, any>;
  setOnboarding: (onboarding: Onboarding<OnboardingStepType>) => void;
  fontsFallback?: React.ReactNode;
  children: React.ReactNode;
}

const OnboardingDataGate = ({
  client,
  locale,
  customAudienceParams,
  setOnboarding,
  fontsFallback,
  children,
}: OnboardingDataGateProps) => {
  const { data, error } = useQuery<Onboarding<OnboardingStepType>>(
    getOnboardingQuery<OnboardingStepType>(client, locale, customAudienceParams, setOnboarding)
  );

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
  }, [data]);

  if (error) throw error;
  if (!data) return <>{fontsFallback ?? null}</>;

  return (
    <FontLoaderGate fonts={data.fonts} fallback={fontsFallback}>
      {children}
    </FontLoaderGate>
  );
};

export const OnboardingProvider = ({
  children,
  client,
  locale = "en",
  customAudienceParams = {},
  customActions = EMPTY_CUSTOM_ACTIONS,
  fontsFallback,
  navigation = expoRouterAdapter,
  onComplete,
  productProvider,
  productRefs,
}: OnboardingProviderProps) => {
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
