import { useContext, useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext } from "../../Provider/OnboardingProgressProvider";
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

  const renderChildren = (children: UIElement[], parentType: "XStack" | "YStack") =>
    children.map((child) => renderElement(child, ctx, parentType));

  const ctx: RenderContext = {
    theme,
    variables: composableVariables,
    setVariable: setComposableVariable,
    onContinue,
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
    flex: 1,
    flexDirection: "column",
  },
});

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
