import { useCallback, useContext, useMemo } from "react";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
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
  const { setVariable: setHeadlessVariable, customActions } = useContext(HeadlessProgressContext);

  // Writes go to both stores: the UI store drives rendering, the headless store
  // drives step branching (resolveNextStepNumber).
  const setVariableAndSync = useCallback(
    (key: string, entry: ComposableVariableEntry) => {
      setComposableVariable(key, entry);
      setHeadlessVariable(key, entry.value);
    },
    [setComposableVariable, setHeadlessVariable]
  );

  const host: ScreenHost = useMemo(
    () => ({
      variables: composableVariables,
      setVariable: setVariableAndSync,
      complete: onContinue,
      customActions,
      keyboardVerticalOffset: keyboardVerticalOffset ?? headerHeight,
    }),
    [composableVariables, setVariableAndSync, onContinue, customActions, keyboardVerticalOffset, headerHeight]
  );

  return (
    <OnboardingTemplate step={validatedData} onContinue={onContinue} theme={theme} disableTopPadding>
      <ScreenRenderer elements={elements} host={host} />
    </OnboardingTemplate>
  );
};

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
