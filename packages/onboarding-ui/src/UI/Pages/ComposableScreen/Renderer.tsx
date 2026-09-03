import { useCallback, useContext, useEffect, useMemo } from "react";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
  usePaywall,
  formatUnknownElementTypes,
  resolveRenderableStep,
} from "@rocapine/react-native-onboarding";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext, ComposableVariableEntry } from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { ScreenRenderer } from "../../Runtime/ScreenRenderer";
import { getRenderableElementTypes } from "../../Runtime/renderableElementTypes";
import type { ScreenHost } from "../../Runtime/ScreenHost";

/**
 * Label for the escape CTA the strip may have to supply. Hardcoded, like the
 * unknown-step fallback in `OnboardingPage`: there is no authored copy to use
 * (the element carrying it is exactly what was stripped), and a screen the user
 * cannot leave is worse than an untranslated word.
 */
const ESCAPE_CTA_LABEL = "Continue";

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
  //
  // Keyed to `getRenderableElementTypes()`, THIS package's own union, not the
  // headless default: the mirror in UI/Runtime/types.ts is what parses below and
  // what `renderElement` dispatches on, and the two packages are joined by a
  // peer-dependency range, so their installed versions can differ.
  //
  // `resolveRenderableStep` also answers whether anything in what survived can
  // still complete the step — see `escapeButton` below.
  const { step: renderableStep, omitted, needsEscape } = useMemo(
    () => resolveRenderableStep(step, getRenderableElementTypes()),
    [step]
  );
  const validatedData = useMemo(
    () => ComposableScreenStepTypeSchema.parse(renderableStep),
    [renderableStep]
  );
  const { elements } = validatedData.payload;

  // Say what went missing. Not dev-gated: this fires when a published screen is
  // ahead of the installed SDK, which is precisely the thing a host needs to see
  // in production logs. As an effect, not inside the memo, so a render stays
  // side-effect free.
  useEffect(() => {
    if (omitted.length > 0) console.warn(formatUnknownElementTypes(omitted));
  }, [omitted]);

  // THE ESCAPE. A ComposableScreen's CTA is authored inside the element tree, so
  // stripping the element that happened to be the screen's root container leaves
  // `elements: []` — which parses cleanly. Without this, the loud throw the strip
  // replaced would have become a silent blank screen with no way forward and, on
  // a header-off step, no back chevron either: the same dead end, harder to see.
  //
  // Both existing boundaries answer this the same way — escape, do not trap: an
  // unknown STEP type renders a Continue button (`OnboardingPage`), and a paywall
  // whose elements fail to parse calls `onContinue()` "so the user is not
  // trapped" (`Pages/Paywall/Renderer`). A visible CTA rather than an automatic
  // `onContinue()` because what survived the strip is still authored content
  // worth showing, and because auto-advancing would rip through every
  // consecutive screen built on the same new element without the user seeing any
  // of them.
  const escapeButton = useMemo(
    () => (needsEscape ? { text: ESCAPE_CTA_LABEL } : undefined),
    [needsEscape]
  );
  useEffect(() => {
    if (!needsEscape) return;
    console.error(
      "[ComposableScreen] Omitting the element types this SDK build does not know left " +
        `nothing on step "${validatedData.id}" that can complete it, so the SDK is showing its ` +
        `own "${ESCAPE_CTA_LABEL}" button — otherwise the user would be stuck here. Upgrade ` +
        "@rocapine/react-native-onboarding-ui to render the screen as authored."
    );
  }, [needsEscape, validatedData.id]);
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
    <OnboardingTemplate
      step={validatedData}
      onContinue={onContinue}
      theme={theme}
      disableTopPadding
      button={escapeButton}
    >
      <ScreenRenderer elements={elements} host={host} />
    </OnboardingTemplate>
  );
};

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
