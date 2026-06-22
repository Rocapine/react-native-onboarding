import { useContext } from "react";
import { OnboardingProgressContext } from "../provider/OnboardingProvider";

/**
 * Access the measured pixel height of the host-rendered ProgressBar/header.
 *
 * `headerHeight` is the full footprint the bar occupies from the top of the
 * screen, including the top safe-area inset it spans (0 when the bar is hidden).
 * `<ProgressBar>` publishes it via `setHeaderHeight` (onLayout). Step content
 * reads it to offset below the bar instead of guessing a fixed height.
 *
 * Consumers that ALSO apply the top safe-area inset themselves (e.g. a
 * `SafeAreaView` with a `top` edge) should add only `headerHeight - insets.top`
 * to avoid double-counting the inset — see the UI `useProgressHeaderInset` hook.
 */
export const useOnboardingHeaderHeight = () => {
  const { headerHeight, setHeaderHeight } = useContext(OnboardingProgressContext);
  return { headerHeight, setHeaderHeight };
};
