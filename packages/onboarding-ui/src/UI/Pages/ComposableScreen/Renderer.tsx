import { useCallback, useContext, useMemo } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { OnboardingProgressContext as HeadlessProgressContext } from "@rocapine/react-native-onboarding";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext, ComposableVariableEntry } from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { RenderContext } from "./elements/shared";
import { renderElement } from "./elements/renderElement";
import { collectElementDefaults } from "./elements/collectDefaults";

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

  // Defaults declared inline on UIElements (Carousel.defaultIndex, RadioGroup.defaultValue, etc.)
  // are overlaid onto ctx.variables so renderWhen / expressions see them on first render —
  // before per-element seeding effects (which persist into composableVariables) run.
  // composableVariables wins over defaults so user-driven updates aren't clobbered.
  const elementDefaults = useMemo(() => collectElementDefaults(elements), [elements]);
  const effectiveVariables = useMemo(
    () => ({ ...elementDefaults, ...composableVariables }),
    [elementDefaults, composableVariables]
  );

  const renderChildren = (children: UIElement[], parentType: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll") =>
    children.map((child) => renderElement(child, ctx, parentType));

  const ctx: RenderContext = {
    theme,
    variables: effectiveVariables,
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
      disableTopPadding
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.flex}>
          {elements.map((element) => renderElement(element, ctx))}
        </View>
      </KeyboardAvoidingView>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
