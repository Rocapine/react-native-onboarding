import { useContext, useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext } from "../../Provider/OnboardingProgressProvider";
import { RenderContext } from "./elements/shared";
import { renderElement } from "./elements/renderElement";

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
  theme?: Theme;
};

const ComposableScreenRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
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
      step={step}
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
