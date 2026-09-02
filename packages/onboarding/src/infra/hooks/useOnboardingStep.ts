import { useCallback, useContext } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  OnboardingProgressContext,
  useServedAudienceParams,
} from "../provider/OnboardingProvider";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { BaseStepType, Onboarding, OnboardingMetadata } from "../../types";
import { OnboardingStepType } from "../../steps/types";

export const useOnboardingStep = <
  StepType extends BaseStepType = OnboardingStepType
>({
  stepNumber,
}: {
  stepNumber: number;
}): {
  step: StepType;
  isLastStep: boolean;
  stepsLength: number;
  onboardingMetadata: OnboardingMetadata;
  steps: StepType[];
  completeOnboarding: () => void;
} => {
  // Get all config from context
  const {
    client,
    locale,
    setActiveStep,
    setTotalSteps,
    setOnboarding,
    navigation,
    completeOnboarding,
  } = useContext(OnboardingProgressContext);
  // The params the gate served this onboarding with — NOT the raw
  // `customAudienceParams` prop. The two differ whenever the user-property
  // store is non-empty, and this must be the very query the gate fetched
  // (same params, same key) or the screens render a payload resolved without
  // the user's properties, from a second fetch. See `ServedAudienceParamsContext`.
  const audienceParams = useServedAudienceParams();

  // Build query with config from context
  const { data } = useSuspenseQuery<Onboarding<StepType>>(
    getOnboardingQuery<StepType>(
      client,
      locale,
      audienceParams,
      setOnboarding as (onboarding: Onboarding<StepType>) => void
    )
  );
  const steps = data.steps;
  const onboardingMetadata = data.metadata;

  navigation.useFocusEffect(
    useCallback(() => {
      const currentStep = steps[stepNumber - 1];
      setActiveStep({
        number: stepNumber,
        displayProgressHeader: currentStep?.displayProgressHeader ?? true,
      });
      setTotalSteps(steps.length);
    }, [stepNumber, steps, setActiveStep, setTotalSteps])
  );

  const step = steps[stepNumber - 1];
  // Positional last step (kept for back-compat; not branch-aware). The true end
  // is signaled by resolveNextStepNumber(...) === null (e.g. the end sentinel).
  const isLastStep = stepNumber >= steps.length;
  const stepsLength = steps.length;

  return {
    step,
    isLastStep,
    stepsLength,
    onboardingMetadata,
    steps,
    completeOnboarding,
  };
};
