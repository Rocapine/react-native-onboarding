import { useCallback, useContext, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { OnboardingProgressContext as HeadlessProgressContext, useOnboardingHeaderHeight } from "@rocapine/react-native-onboarding";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext, ComposableVariableEntry } from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { RenderContext } from "./elements/shared";
import { renderElement } from "./elements/renderElement";
import { VariablesContext } from "./elements/VariablesContext";
import { AnimatedVariablesContext, useAnimatedVariablesRegistry } from "./elements/AnimatedVariablesContext";
import { collectElementDefaults } from "./elements/collectDefaults";

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
  /** Distance between the top of the screen and this page's top (e.g. a fixed host header). */
  keyboardVerticalOffset?: number;
};

const ComposableScreenRendererBase = ({ step, onContinue, keyboardVerticalOffset }: ContentProps) => {
  const { theme } = useTheme();
  const { headerHeight } = useOnboardingHeaderHeight();
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

  // Flatten variables to primitives once per render — renderElement reuses this
  // for every element's renderWhen check instead of rebuilding it per element.
  const flatVariables = useMemo(
    () => Object.fromEntries(Object.entries(effectiveVariables).map(([k, v]) => [k, v?.value])),
    [effectiveVariables]
  );

  // Live snapshot of the merged variables for press-time action evaluation
  // (runActions). A ref so `getVariables` keeps a stable identity — that keeps
  // `ctx` stable across variable writes — while always returning the latest map.
  const effectiveVariablesRef = useRef(effectiveVariables);
  effectiveVariablesRef.current = effectiveVariables;
  const getVariables = useCallback(() => effectiveVariablesRef.current, []);

  // `onContinue` is a caller-supplied prop — the one otherwise-unstable ctx input.
  // Ref-stash it so `ctx` keeps a stable identity even if a host re-renders this
  // screen on every variable write (a fresh onContinue would make a new ctx →
  // every ElementHost fails the identity check → full-tree re-render returns).
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  const stableOnContinue = useCallback(() => onContinueRef.current(), []);

  // `renderChildren` must stay referentially stable so `ctx` does not change on
  // every render (a new `ctx` would defeat the element-level memoization). It
  // reads the current `ctx` from a ref to break the ctx ⇄ renderChildren cycle.
  const ctxRef = useRef<RenderContext>(undefined as unknown as RenderContext);
  const renderChildren = useCallback(
    (children: UIElement[], parentType: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll") =>
      children.map((child) => renderElement(child, ctxRef.current, parentType)),
    []
  );

  // Stable across variable writes: every dependency is stable (theme from
  // useTheme; the rest are useCallback'd). It changes only on a theme switch, so
  // memoized elements skip re-render on writes but still pick up theme changes.
  const ctx: RenderContext = useMemo(
    () => ({
      theme,
      getVariables,
      setVariable: setVariableAndSync,
      onContinue: stableOnContinue,
      customActions,
      renderChildren,
    }),
    [theme, getVariables, setVariableAndSync, stableOnContinue, customActions, renderChildren]
  );
  ctxRef.current = ctx;

  // The volatile slice. A write changes this value and re-renders only its
  // consumers (variable-reading leaves + renderWhen-gated elements) via
  // `useVariables()`; everything else is memoized and skipped.
  const variablesValue = useMemo(
    () => ({ variables: effectiveVariables, flatVariables }),
    [effectiveVariables, flatVariables]
  );

  // ROC-2984 finding #2: the root KeyboardAvoidingView has no background, so the
  // keyboard-height padding it inserts when the keyboard opens (behavior:"padding"
  // on iOS) exposes the grey OnboardingTemplate container (theme neutral.lowest)
  // behind it — a grey band between the step's content and the keyboard. Paint
  // that padding region with the step's own outermost background so the band
  // matches the step instead of the template. Undefined when the step declares no
  // root background → falls back to the stable styles.flex ref (a true no-op that
  // preserves the intended themeable page background for steps that want it).
  //
  // Only adopt it when the first element is a full-bleed, UNCONDITIONAL root that
  // actually covers the screen (flex, or height:"100%"; no renderWhen). Painting
  // the flex:1 KAV with the color of a content-sized / gated / decorative first
  // element would overpaint the themeable page background — even with the keyboard
  // closed — so those cases stay a no-op and keep the template background.
  const rootElement = elements[0];
  const rootIsFullBleed =
    !!rootElement &&
    !rootElement.renderWhen &&
    (rootElement.props.flex != null || rootElement.props.height === "100%");
  const rootBackgroundColor = rootIsFullBleed ? rootElement.props.backgroundColor : undefined;
  const keyboardAvoidingStyle = useMemo(
    () =>
      rootBackgroundColor
        ? [styles.flex, { backgroundColor: rootBackgroundColor }]
        : styles.flex,
    [rootBackgroundColor]
  );

  // Stable per-screen registry of animated variables (autoplay ProgressIndicator
  // sweeps). Its identity never changes, so this provider never re-renders its
  // consumers — registration is broadcast through per-name listeners instead.
  const animatedVariables = useAnimatedVariablesRegistry();

  return (
    <OnboardingTemplate
      step={validatedData}
      onContinue={onContinue}
      theme={theme}
      disableTopPadding
    >
      <KeyboardAvoidingView
        style={keyboardAvoidingStyle}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset ?? headerHeight}
      >
        <View style={styles.flex}>
          <AnimatedVariablesContext.Provider value={animatedVariables}>
            <VariablesContext.Provider value={variablesValue}>
              {elements.map((element) => renderElement(element, ctx))}
            </VariablesContext.Provider>
          </AnimatedVariablesContext.Provider>
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
