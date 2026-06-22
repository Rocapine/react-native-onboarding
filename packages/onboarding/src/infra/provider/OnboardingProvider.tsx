import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { Onboarding } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { ComposableVariableEntry } from "../../steps/ComposableScreen/types";
import { FontLoaderGate } from "./FontLoader";
import { extractAssetUrls } from "../preload/extractAssetUrls";
import { preloadAssets } from "../preload/preloadAssets";
import { OnboardingNavigationAdapter } from "../navigation/types";
import { expoRouterAdapter } from "../navigation/expoRouterAdapter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
})

export type CustomActionHandler = (args: {
  variables: Record<string, ComposableVariableEntry | undefined>;
}) => void | Promise<void>;

export type CustomActions = Record<string, CustomActionHandler>;

interface OnboardingProviderProps {
  children: React.ReactNode;
  client: OnboardingStudioClient;
  locale?: string;
  customAudienceParams?: Record<string, any>;
  /**
   * Map of named handlers invokable from ComposableScreen Button `actions`
   * with `{ type: "custom", function: <name>, variables?: [...] }`. Handlers
   * receive the requested variables filtered from the live ComposableScreen
   * variable map and may return a Promise.
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
  customActions = {},
  fontsFallback,
  navigation = expoRouterAdapter,
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
          customActions,
          navigation,
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
  customActions: CustomActions;
  navigation: OnboardingNavigationAdapter;
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
  customActions: {},
  navigation: expoRouterAdapter,
});
