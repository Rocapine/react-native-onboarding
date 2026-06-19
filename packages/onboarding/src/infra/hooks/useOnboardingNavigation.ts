import { useContext } from "react";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import type { OnboardingNavigationAdapter } from "../navigation/types";

/**
 * Returns the navigation adapter provided to `OnboardingProvider` (defaults to
 * the expo-router adapter). Used by UI components (e.g. ProgressBar) to perform
 * back navigation without importing expo-router directly.
 */
export const useOnboardingNavigation = (): OnboardingNavigationAdapter =>
  useContext(OnboardingProgressContext).navigation;
