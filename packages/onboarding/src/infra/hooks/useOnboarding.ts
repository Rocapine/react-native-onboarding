import { useContext } from "react";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import { computeProgress } from "../../computeProgress";

export const useOnboarding = () => {
  const { activeStep, totalSteps, onboarding } = useContext(
    OnboardingProgressContext
  );
  const steps = onboarding?.steps;
  // Use the counted-aware formula when the steps array is available (the common
  // case once an onboarding is loaded). When no `progressMode` is set on any
  // step this matches the legacy index-based fraction exactly. Fall back to the
  // legacy math while steps haven't loaded yet (preserves prior behavior).
  let progressPercentage: number;
  let isProgressBarVisible: boolean;
  if (steps && steps.length > 0) {
    const progress = computeProgress(activeStep.number, steps);
    progressPercentage = progress.percentage;
    isProgressBarVisible = progress.visible;
  } else {
    progressPercentage =
      totalSteps > 0 ? Math.round((100 * activeStep.number) / totalSteps) : 0;
    isProgressBarVisible = activeStep.displayProgressHeader;
  }
  return {
    progressPercentage,
    isProgressBarVisible,
    onboarding,
  };
};
