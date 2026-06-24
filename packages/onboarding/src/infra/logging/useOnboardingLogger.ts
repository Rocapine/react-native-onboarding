import { useContext } from "react";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import { OnboardingLogger } from "./types";

/**
 * Returns the {@link OnboardingLogger} injected into {@link OnboardingProvider}.
 * Use it to fire host-driven events such as `onboarding_completed` (the SDK has no
 * internal end-of-flow choke point) or any future custom event.
 */
export const useOnboardingLogger = (): OnboardingLogger => {
  const { logger } = useContext(OnboardingProgressContext);
  return logger;
};
