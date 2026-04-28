import { createContext, useCallback, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { Onboarding } from "../../types";
import { OnboardingStepType } from "../../steps/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
})

interface OnboardingProviderProps {
  children: React.ReactNode;
  client: OnboardingStudioClient;
  locale?: string;
  customAudienceParams?: Record<string, any>;
}

export const OnboardingProvider = ({
  children,
  client,
  locale = "en",
  customAudienceParams = {},
}: OnboardingProviderProps) => {
  const [activeStep, setActiveStep] = useState({
    number: 0,
    displayProgressHeader: false,
  });
  const [totalSteps, setTotalSteps] = useState(0);
  const [onboarding, setOnboarding] = useState<Onboarding<OnboardingStepType> | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const setVariable = useCallback((name: string, value: any) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
  }, []);

  queryClient.prefetchQuery(getOnboardingQuery(client, locale, customAudienceParams, setOnboarding))

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
        }}
      >
        {children}
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
});