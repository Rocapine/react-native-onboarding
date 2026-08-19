import { useContext } from "react";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";
import type { ProgressHeaderConfiguration } from "../../types";

const EMPTY: ProgressHeaderConfiguration = {};

/**
 * Studio-authored progress-header styling (`configuration.progressHeader`).
 *
 * Returns an empty object when the onboarding hasn't loaded yet or the studio
 * hasn't authored the block, so callers can read fields unconditionally and fall
 * back per-field rather than branching on the whole object.
 *
 * The progress header is host-rendered (the app mounts `<ProgressBar>` in its
 * layout), so the bar reads this itself instead of the provider passing props
 * down — that keeps the studio knob working without every host changing code.
 */
export const useProgressHeaderConfig = (): ProgressHeaderConfiguration => {
  const { onboarding } = useContext(OnboardingProgressContext);
  return onboarding?.configuration?.progressHeader ?? EMPTY;
};
