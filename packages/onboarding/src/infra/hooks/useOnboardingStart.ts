import { useContext } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { BaseStepType, Onboarding } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { resolveStartStepNumber } from "../../resolveStartStepNumber";

/**
 * Resolves the entry point of the onboarding. Suspends on the onboarding query
 * (like `useOnboardingStep`) so the payload is guaranteed loaded, then returns
 * the 1-indexed `startStepNumber` derived from `metadata.startStepId` (falling
 * back to the first step). Use it in the entry route to navigate to the start.
 */
export const useOnboardingStart = <
  StepType extends BaseStepType = OnboardingStepType
>(): {
  startStepNumber: number;
} => {
  const { client, locale, customAudienceParams, setOnboarding } = useContext(
    OnboardingProgressContext
  );

  const { data } = useSuspenseQuery<Onboarding<StepType>>(
    getOnboardingQuery<StepType>(
      client,
      locale,
      customAudienceParams,
      setOnboarding as (onboarding: Onboarding<StepType>) => void
    )
  );

  const startStepNumber = resolveStartStepNumber(
    data.steps,
    data.metadata?.startStepId
  );

  return { startStepNumber };
};
