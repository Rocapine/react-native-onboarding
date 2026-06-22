import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingHeaderHeight } from "@rocapine/react-native-onboarding";

/**
 * Top offset that step content should add to sit just below the host-rendered
 * ProgressBar/header, on top of any top safe-area inset the content already
 * applies itself.
 *
 * The headless `headerHeight` is the bar's full footprint *including* the top
 * inset it spans. A `SafeAreaView` with a `top` edge already pads that inset,
 * so adding the raw `headerHeight` would count the inset twice. This returns
 * `headerHeight - insets.top` (the bar portion below the status bar), clamped
 * to 0 — and is naturally 0 when the bar is hidden (`headerHeight === 0`).
 */
export const useProgressHeaderInset = (): number => {
  const { headerHeight } = useOnboardingHeaderHeight();
  const insets = useSafeAreaInsets();
  return Math.max(0, headerHeight - insets.top);
};
