import { createContext, useCallback, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { Onboarding } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { ComposableVariableEntry } from "../../steps/ComposableScreen/types";
import { ActionVariableDecl } from "../../steps/ComposableScreen/elements/ButtonElement";
import { FontLoaderGate } from "./FontLoader";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
})

/**
 * Optional result a custom action handler may return to write variables back
 * into the live ComposableScreen variable bag and/or stop the action queue.
 * Returning `void` (the common case) writes nothing and continues the queue —
 * so existing handlers are unaffected.
 */
export type ActionResult = {
  /** Values to merge into the variable bag, keyed by variable name. */
  variables?: Record<string, ComposableVariableEntry>;
  /** When `true`, stops processing the remaining actions in the button's queue. */
  abort?: boolean;
};

export type CustomActionHandler = (args: {
  variables: Record<string, ComposableVariableEntry | undefined>;
}) => void | ActionResult | Promise<void | ActionResult>;

export type CustomActions = Record<string, CustomActionHandler>;

/**
 * Context every capability handler receives: the live variable bag plus the
 * `writes` the action declared. The handler SHOULD return an `ActionResult`
 * whose `variables` cover those declared names so a later step can branch on
 * them; returning `void` is allowed (writes nothing).
 */
export type ActionHandlerCtx = {
  variables: Record<string, ComposableVariableEntry | undefined>;
  /** Variables the action declared it writes; the handler is expected to return these. */
  writes?: ActionVariableDecl[];
};

/**
 * Typed registry of host handlers for the first-class capability actions. Each
 * is optional — an unregistered handler makes its action a warn-and-skip no-op
 * at runtime (mirroring `customActions` misses). Vendor-neutral by design: the
 * SDK defines the intent + result shape and never imports a paywall/health SDK.
 */
export type ActionHandlers = {
  requestNotificationPermission?: (
    ctx: ActionHandlerCtx
  ) => void | ActionResult | Promise<void | ActionResult>;
  requestHealthSync?: (
    ctx: ActionHandlerCtx & { metrics?: string[] }
  ) => void | ActionResult | Promise<void | ActionResult>;
  presentPaywall?: (
    ctx: ActionHandlerCtx & { placement?: string }
  ) => void | ActionResult | Promise<void | ActionResult>;
  restorePurchase?: (
    ctx: ActionHandlerCtx
  ) => void | ActionResult | Promise<void | ActionResult>;
  openURL?: (
    ctx: ActionHandlerCtx & { url: string; external?: boolean }
  ) => void | ActionResult | Promise<void | ActionResult>;
  requestReview?: (
    ctx: ActionHandlerCtx
  ) => void | ActionResult | Promise<void | ActionResult>;
};

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
   * Typed handlers for the first-class capability actions
   * (`requestNotificationPermission`, `requestHealthSync`, `presentPaywall`,
   * `restorePurchase`, `openURL`, `requestReview`) invokable from
   * ComposableScreen Button `actions`. Each handler may return an `ActionResult`
   * whose `variables` are merged back into the variable bag.
   */
  actionHandlers?: ActionHandlers;
  /**
   * Rendered while the onboarding payload is fetched and any remote fonts
   * declared in the response (`onboarding.fonts`) are downloaded and registered.
   * Defaults to `null`.
   */
  fontsFallback?: React.ReactNode;
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
  actionHandlers = {},
  fontsFallback,
}: OnboardingProviderProps) => {
  const [activeStep, setActiveStep] = useState({
    number: 0,
    displayProgressHeader: false,
  });
  const [totalSteps, setTotalSteps] = useState(0);
  const [onboarding, setOnboarding] = useState<Onboarding<OnboardingStepType> | null>(null);
  const onboardingRef = useRef<Onboarding<OnboardingStepType> | null>(onboarding);
  onboardingRef.current = onboarding;
  const [variables, setVariables] = useState<Record<string, any>>({});
  const variablesRef = useRef<Record<string, any>>(variables);
  const setVariable = useCallback((name: string, value: any) => {
    variablesRef.current = { ...variablesRef.current, [name]: value };
    setVariables(variablesRef.current);
  }, []);
  const getVariables = useCallback(() => variablesRef.current, []);

  // Resolve a `navigate(stepId)` to its 1-based position in the loaded step
  // list and update `activeStep` so the progress header reflects the jump.
  // NOTE: the SDK does not own route changes — the host's `onContinue`/router
  // owns actual screen navigation (see useOnboardingStep). This updates the
  // progress context only; hosts wanting an absolute screen jump should read
  // `activeStep.number` or use their router. Unknown ids warn and no-op.
  const goToStep = useCallback((stepId: string) => {
    const steps = onboardingRef.current?.steps ?? [];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index < 0) {
      console.warn(`[Onboarding] goToStep: no step with id "${stepId}"`);
      return;
    }
    setActiveStep({
      number: index + 1,
      displayProgressHeader: steps[index]?.displayProgressHeader ?? true,
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OnboardingProgressContext.Provider
        value={{
          activeStep,
          setActiveStep,
          totalSteps,
          setTotalSteps,
          client,
          locale,
          customAudienceParams,
          onboarding,
          setOnboarding,
          variables,
          setVariable,
          getVariables,
          customActions,
          actionHandlers,
          goToStep,
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
  client: OnboardingStudioClient;
  locale: string;
  customAudienceParams: Record<string, any>;
  onboarding: Onboarding<OnboardingStepType> | null;
  setOnboarding: (onboarding: Onboarding<OnboardingStepType>) => void;
  variables: Record<string, any>;
  setVariable: (name: string, value: any) => void;
  getVariables: () => Record<string, any>;
  customActions: CustomActions;
  actionHandlers: ActionHandlers;
  goToStep: (stepId: string) => void;
}>({
  activeStep: { number: 0, displayProgressHeader: false },
  setActiveStep: () => { },
  totalSteps: 0,
  setTotalSteps: () => { },
  client: new OnboardingStudioClient('', {}),
  locale: "en",
  customAudienceParams: {},
  onboarding: null,
  setOnboarding: () => { },
  variables: {},
  setVariable: () => { },
  getVariables: () => ({}),
  customActions: {},
  actionHandlers: {},
  goToStep: () => { },
});
