import { useCallback, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { productVariables } from "@rocapine/react-native-onboarding";
import type { UIElement } from "./types";
import type { ScreenHost, CompleteOutcome } from "./ScreenHost";
import { useTheme } from "../Theme/useTheme";
import { RenderContext } from "./elements/shared";
import {
  EnteringLatchContext,
  useEnteringLatchValue,
} from "./elements/EnteringLatchContext";
import type { BaseBoxProps } from "./elements/BaseBoxProps";
import { renderElement } from "./elements/renderElement";
import { VariablesContext } from "./elements/VariablesContext";
import { AnimatedVariablesContext, useAnimatedVariablesRegistry } from "./elements/AnimatedVariablesContext";
import { collectElementDefaults } from "./elements/collectDefaults";
import { mergeVariables, flattenVariables, withProductVariables } from "./variables";

export type ScreenRendererProps = {
  /**
   * Must be referentially stable across renders — e.g. parsed/built inside a
   * `useMemo` keyed on the raw step/payload, never inline in the adapter's
   * render body. Its identity is memoized below (`collectElementDefaults`) and
   * flows into every element's `areElementPropsEqual` check. An adapter that
   * parses or `.map()`s its elements inline on each render silently loses ALL
   * element memoization — no type error, no test failure, just a whole-tree
   * re-render on every variable write.
   */
  elements: UIElement[];
  /**
   * Fine to rebuild fresh on every render — only its destructured fields
   * (`variables`, `setVariable`, `complete`, etc.) reach `ctx`, and each of
   * those is individually ref-stashed or memoized below before landing on
   * `RenderContext`.
   */
  host: ScreenHost;
};

type ParentType = "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";

/**
 * The screen-agnostic rendering engine. Renders a UIElement tree against an
 * injected ScreenHost. Knows nothing about onboarding steps or paywalls — the
 * caller supplies the host and any surrounding chrome.
 */
export const ScreenRenderer = ({ elements, host }: ScreenRendererProps) => {
  const { theme } = useTheme();
  const { variables: hostVariables, setVariable, complete, customActions, products, presentPaywall, keyboardVerticalOffset } = host;

  // Defaults declared inline on UIElements are overlaid BENEATH the host store so
  // renderWhen / {{var}} interpolation see them on first render, before per-element
  // seeding effects run. Host values always win — except resolved product
  // variables, which win over everything (see withProductVariables).
  const elementDefaults = useMemo(() => collectElementDefaults(elements), [elements]);
  const productVars = useMemo(
    () => (products ? productVariables(products) : undefined),
    [products]
  );
  const effectiveVariables = useMemo(
    () => withProductVariables(mergeVariables(elementDefaults, hostVariables), productVars),
    [elementDefaults, hostVariables, productVars]
  );
  const flatVariables = useMemo(() => flattenVariables(effectiveVariables), [effectiveVariables]);

  // Live snapshot for press-time action evaluation (runActions). A ref so
  // `getVariables` keeps a stable identity — which keeps `ctx` stable across
  // variable writes — while always returning the latest map.
  const effectiveVariablesRef = useRef(effectiveVariables);
  effectiveVariablesRef.current = effectiveVariables;
  const getVariables = useCallback(() => effectiveVariablesRef.current, []);

  // `complete` comes from the host and may be a fresh closure on every host
  // render. Ref-stash it so `ctx` keeps a stable identity — a new ctx would fail
  // every ElementHost identity check and bring back the full-tree re-render.
  // Forwards its optional outcome through (e.g. `{status:"dismissed"}` from the
  // `dismiss` action) — the wrapper must not silently drop it.
  const completeRef = useRef(complete);
  completeRef.current = complete;
  const stableOnContinue = useCallback(
    (outcome?: CompleteOutcome) => completeRef.current(outcome),
    []
  );

  // `renderChildren` must stay referentially stable, so it reads the current ctx
  // from a ref to break the ctx ⇄ renderChildren cycle.
  const ctxRef = useRef<RenderContext>(undefined as unknown as RenderContext);
  const renderChildren = useCallback(
    (children: UIElement[], parentType: ParentType, ctxOverride?: RenderContext) =>
      children.map((child) => renderElement(child, ctxOverride ?? ctxRef.current, parentType)),
    []
  );

  // Stable across variable writes; changes only on a theme switch — PROVIDED the
  // host's `products` is itself referentially stable (the contract is on
  // ScreenHost.products, not enforced here). A host that hands in a fresh
  // ProductRuntime object each render makes this ctx churn on every render too,
  // and every memoized element re-renders with it. Nothing here catches that.
  const ctx: RenderContext = useMemo(
    () => ({
      theme,
      getVariables,
      setVariable,
      onContinue: stableOnContinue,
      customActions,
      products,
      presentPaywall,
      renderChildren,
    }),
    [theme, getVariables, setVariable, stableOnContinue, customActions, products, presentPaywall, renderChildren]
  );
  ctxRef.current = ctx;

  // The volatile slice: a write re-renders only its consumers.
  const variablesValue = useMemo(
    () => ({ variables: effectiveVariables, flatVariables }),
    [effectiveVariables, flatVariables]
  );

  // ROC-2984 finding #2: the root KeyboardAvoidingView has no background, so the
  // padding it inserts when the keyboard opens exposes whatever sits behind it as a
  // coloured band. Paint that region with the screen's own root background — but
  // only when the first element is a full-bleed, UNCONDITIONAL root that actually
  // covers the screen (flex, or height:"100%"; no renderWhen).
  //
  // Painting the flex:1 KeyboardAvoidingView with the colour of a content-sized,
  // gated, or decorative first element would overpaint the themeable page
  // background — even with the keyboard closed — so those cases intentionally
  // stay a no-op and keep the host's own background.
  const rootElement = elements[0];
  // Cast: not every element's props extend BaseBoxProps (`Repeat` renders no view
  // of its own, so it has no box props) — those simply read as undefined here,
  // which correctly means "not a full-bleed root".
  const rootProps = rootElement?.props as Partial<BaseBoxProps> | undefined;
  const rootIsFullBleed =
    !!rootElement &&
    !rootElement.renderWhen &&
    (rootProps?.flex != null || rootProps?.height === "100%");
  const rootBackgroundColor = rootIsFullBleed ? rootProps?.backgroundColor : undefined;
  const keyboardAvoidingStyle = useMemo(
    () => (rootBackgroundColor ? [styles.flex, { backgroundColor: rootBackgroundColor }] : styles.flex),
    [rootBackgroundColor]
  );

  // Stable per-screen registry of animated variables (autoplay ProgressIndicator
  // sweeps). Its identity never changes, so this provider never re-renders consumers.
  const animatedVariables = useAnimatedVariablesRegistry();
  // Per-screen `entering.once` latch + the settled signal that releases a
  // deferred initial-mount entrance. Scoped here so each screen defers its own
  // arrival and each screen's "once" means once on THAT screen.
  const enteringLatch = useEnteringLatchValue(host.enteringSettleDelayMs);

  return (
    <KeyboardAvoidingView
      style={keyboardAvoidingStyle}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={styles.flex}>
        <AnimatedVariablesContext.Provider value={animatedVariables}>
          <EnteringLatchContext.Provider value={enteringLatch}>
          <VariablesContext.Provider value={variablesValue}>
            {elements.map((element) => renderElement(element, ctx))}
          </VariablesContext.Provider>
          </EnteringLatchContext.Provider>
        </AnimatedVariablesContext.Provider>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
