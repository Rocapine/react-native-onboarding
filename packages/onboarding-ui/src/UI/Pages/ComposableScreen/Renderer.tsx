import { useCallback, useContext, useMemo } from "react";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
  usePaywall,
} from "@rocapine/react-native-onboarding";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext, ComposableVariableEntry } from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { ScreenRenderer } from "../../Runtime/ScreenRenderer";
import type { ScreenHost } from "../../Runtime/ScreenHost";

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
  /** Distance between the top of the screen and this page's top (e.g. a fixed host header). */
  keyboardVerticalOffset?: number;
};

/**
 * Onboarding adapter over the generic ScreenRenderer: turns the onboarding
 * contexts into a ScreenHost and supplies the onboarding chrome. All rendering
 * lives in UI/Runtime and is shared with the paywall renderer.
 */
const ComposableScreenRendererBase = ({ step, onContinue, keyboardVerticalOffset }: ContentProps) => {
  const { theme } = useTheme();
  const { headerHeight } = useOnboardingHeaderHeight();
  const validatedData = useMemo(() => ComposableScreenStepTypeSchema.parse(step), [step]);
  const { elements } = validatedData.payload;
  const { composableVariables, setComposableVariable } = useContext(OnboardingProgressContext);
  const { setVariable: setHeadlessVariable, customActions, products } = useContext(HeadlessProgressContext);
  // Degrades to an inert `present` (resolves `{status:"error"}`, never throws)
  // when there is no ancestor `PaywallProvider` — so an onboarding app that
  // never mounts one keeps working exactly as it does today; `presentPaywall`
  // is simply reachable but a no-op placement lookup, not a crash.
  const { present } = usePaywall();

  // Writes go to both stores: the UI store drives rendering, the headless store
  // drives step branching (resolveNextStepNumber).
  const setVariableAndSync = useCallback(
    (key: string, entry: ComposableVariableEntry) => {
      setComposableVariable(key, entry);
      setHeadlessVariable(key, entry.value);
    },
    [setComposableVariable, setHeadlessVariable]
  );

  // Lets an onboarding step open a paywall (spec §4.5/§7) via the same
  // `present()` a paywall's own host uses to open another paywall
  // (`UI/Paywall/PaywallHost.tsx`). `PaywallHost` (rendered by the host app
  // alongside `OnboardingProvider`, per `PaywallProvider`'s mount-order doc)
  // is what actually shows the Modal — this only asks for it.
  const presentPaywall = useCallback(
    (placement: string) => {
      void present(placement);
    },
    [present]
  );

  const host: ScreenHost = useMemo(
    () => ({
      variables: composableVariables,
      setVariable: setVariableAndSync,
      complete: onContinue,
      customActions,
      products,
      presentPaywall,
      keyboardVerticalOffset: keyboardVerticalOffset ?? headerHeight,
    }),
    [
      composableVariables,
      setVariableAndSync,
      onContinue,
      customActions,
      products,
      presentPaywall,
      keyboardVerticalOffset,
      headerHeight,
    ]
  );

  return (
    <OnboardingTemplate step={validatedData} onContinue={onContinue} theme={theme} disableTopPadding>
      <ScreenRenderer elements={elements} host={host} />
    </OnboardingTemplate>
  );
};

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
