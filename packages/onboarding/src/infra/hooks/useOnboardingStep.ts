import { useCallback, useContext } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import { getOnboardingQuery } from "../queries/getOnboarding.query";
import { BaseStepType, Onboarding, OnboardingMetadata } from "../../types";
import { OnboardingStepType } from "../../steps/types";
import { metadataToIdentity } from "../logging/types";

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
    logger,
    getVariables,
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

      if (currentStep) {
        logger.track({
          name: "step_shown",
          ...metadataToIdentity(onboardingMetadata),
          step: {
            id: currentStep.id,
            type: currentStep.type,
            name: currentStep.name,
            number: stepNumber,
          },
          totalSteps: steps.length,
          isLastStep: stepNumber >= steps.length,
          displayProgressHeader: currentStep.displayProgressHeader ?? true,
          answers: getVariables(),
          customPayload: currentStep.customPayload,
          timestamp: Date.now(),
        });
      }
    }, [
      stepNumber,
      steps,
      setActiveStep,
      setTotalSteps,
      logger,
      getVariables,
      onboardingMetadata,
    ])
  );

  const step = steps[stepNumber - 1];
  const isLastStep = stepNumber >= steps.length;
  const stepsLength = steps.length;

  return {
    step,
    isLastStep,
    stepsLength,
    onboardingMetadata,
    steps,
  };
};
