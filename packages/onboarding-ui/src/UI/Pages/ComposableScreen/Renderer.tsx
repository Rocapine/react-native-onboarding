import { useCallback, useContext, useEffect, useMemo } from "react";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
  usePaywall,
  collectUnknownElementTypes,
  dropUnknownElementTypesInStep,
  formatUnknownElementTypes,
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
  /** See OnboardingPageProps — overrides the `entering.once` settle delay. */
  enteringSettleDelayMs?: number;
};

/**
 * Onboarding adapter over the generic ScreenRenderer: turns the onboarding
 * contexts into a ScreenHost and supplies the onboarding chrome. All rendering
 * lives in UI/Runtime and is shared with the paywall renderer.
 */
const ComposableScreenRendererBase = ({ step, onContinue, keyboardVerticalOffset, enteringSettleDelayMs }: ContentProps) => {
  const { theme } = useTheme();
  const { headerHeight } = useOnboardingHeaderHeight();
  // FORWARD COMPATIBILITY (#209). An element type published after this app
  // shipped is not in the discriminated union, so it used to fail the parse
  // below — and take the whole screen with it. That is not a degraded screen:
  // this component is wrapped in `withErrorBoundary`, whose fallback has no
  // interactive control, and the back chevron lives in `<ProgressBar>` behind
  // the step's `displayProgressHeader`. On a header-off step the user has no
  // exit in either direction, because `onContinue` died with the subtree.
  //
  // So unknown element TYPES are omitted before parsing — matching
  // `renderElement`'s terminal `return null` — and everything else still parses
  // strictly, so a real data bug (a `variant` outside its enum, a missing `id`)
  // keeps failing loudly with its exact path instead of quietly vanishing.
  const { validatedData, omitted } = useMemo(() => {
    const renderableStep = dropUnknownElementTypesInStep(step);
    return {
      validatedData: ComposableScreenStepTypeSchema.parse(renderableStep),
      // Only walked when something was actually dropped (the strip returns the
      // same reference otherwise), so the common path costs one comparison.
      omitted:
        renderableStep === step ? [] : collectUnknownElementTypes(step.payload?.elements),
    };
  }, [step]);
  const { elements } = validatedData.payload;

  // Say what went missing. Not dev-gated: this fires when a published screen is
  // ahead of the installed SDK, which is precisely the thing a host needs to see
  // in production logs. As an effect, not inside the memo, so a render stays
  // side-effect free.
  useEffect(() => {
    if (omitted.length > 0) console.warn(formatUnknownElementTypes(omitted));
  }, [omitted]);
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
      enteringSettleDelayMs,
    }),
    [
      composableVariables,
      setVariableAndSync,
      onContinue,
      customActions,
      products,
      presentPaywall,
      keyboardVerticalOffset,
      enteringSettleDelayMs,
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
