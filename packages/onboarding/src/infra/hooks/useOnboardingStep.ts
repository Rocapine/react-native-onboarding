import { useCallback, useContext } from "react";
import { Platform } from "react-native";
import { useSuspenseQuery } from "@tanstack/react-query";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { BaseStepType, Onboarding, OnboardingMetadata } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { hasStepDevHook, notifyStepShown } from "../../steps/devHook";
import { buildStepShownInfo } from "../../steps/stepShownInfo";

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
    customAudienceParams,
    setActiveStep,
    setTotalSteps,
    setOnboarding,
    navigation,
    completeOnboarding,
  } = useContext(OnboardingProgressContext);

  // Build query with config from context
  const { data } = useSuspenseQuery<Onboarding<StepType>>(
    getOnboardingQuery<StepType>(
      client,
      locale,
      customAudienceParams,
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

      let active = true;
      if (hasStepDevHook() && currentStep) {
        try {
          const info = buildStepShownInfo({
            step: currentStep as {
              id: string;
              name?: string;
              type: string;
              payload?: { customScreenId?: unknown };
            },
            metadata: onboardingMetadata,
            client,
            platform: Platform.OS,
            viewRef: null,
            isActive: () => active,
          });
          if (info) notifyStepShown(info);
        } catch (e) {
          console.warn("[Onboarding] could not describe the step to the step dev hook", e);
        }
      }
      return () => {
        active = false;
      };
    }, [stepNumber, steps, setActiveStep, setTotalSteps, onboardingMetadata, client])
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
