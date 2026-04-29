import { useCallback, useContext, useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { OnboardingProgressContext as HeadlessProgressContext } from "@rocapine/react-native-onboarding";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext, ComposableVariableEntry } from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { RenderContext } from "./elements/shared";
import { renderElement } from "./elements/renderElement";

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
};

const ComposableScreenRendererBase = ({ step, onContinue }: ContentProps) => {
  const { theme } = useTheme();
  const validatedData = useMemo(() => ComposableScreenStepTypeSchema.parse(step), [step]);
  const { elements } = validatedData.payload;
  const { composableVariables, setComposableVariable } = useContext(OnboardingProgressContext);
  const { setVariable: setHeadlessVariable, customActions } = useContext(HeadlessProgressContext);

  const setVariableAndSync = useCallback(
    (key: string, entry: ComposableVariableEntry) => {
      setComposableVariable(key, entry);
      setHeadlessVariable(key, entry.value);
    },
    [setComposableVariable, setHeadlessVariable]
  );

  const renderChildren = (children: UIElement[], parentType: "XStack" | "YStack" | "ZStack") =>
    children.map((child) => renderElement(child, ctx, parentType));

  const ctx: RenderContext = {
    theme,
    variables: composableVariables,
    setVariable: setVariableAndSync,
    onContinue,
    customActions,
    renderChildren,
  };

  return (
    <OnboardingTemplate
      step={validatedData}
      onContinue={onContinue}
      theme={theme}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        {elements.map((element) => renderElement(element, ctx))}
      </ScrollView>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
