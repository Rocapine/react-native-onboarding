import { useCallback, useContext, useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
  usePaywall,
} from "@rocapine/react-native-onboarding";
import { PaywallStepTypeSchema, type PaywallStepType } from "./types";
import type { OnboardingStepType } from "../../types";
import { resolvePaywallStepDecision } from "./resolvePaywallStepDecision";
import { shouldAdvanceOnComplete } from "./shouldAdvanceOnComplete";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import {
  OnboardingProgressContext,
  ComposableVariableEntry,
} from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { ScreenRenderer } from "../../Runtime/ScreenRenderer";
import type { ScreenHost, CompleteOutcome } from "../../Runtime/ScreenHost";
import { ScreenElementsSchema } from "../../Runtime/types";

type ContentProps = {
  step: PaywallStepType;
  onContinue: () => void;
  keyboardVerticalOffset?: number;
};

/** The fields this renderer reads off a resolved catalog entry. */
type ResolvedPaywall = {
  id: string;
  name: string;
  moment: string;
  elements: unknown;
  renderMode?: "elements" | "custom" | null;
  customScreenId?: string | null;
  customPayload?: Record<string, { ios?: string; android?: string }> | null;
};

/**
 * A paywall in flow position — the sibling of
 * `Pages/ComposableScreen/Renderer.tsx`, sharing its `OnboardingTemplate`
 * wrapper and `ScreenHost` construction, and the third consumer of
 * `ScreenRenderer` after that adapter and `PaywallHost`.
 *
 * The step's payload is one field, a `moments.key`. `get-paywalls` already
 * returns the catalog keyed by moment with the audience waterfall applied, so
 * resolving it is a lookup — which is why targeting and weighted A/B work here
 * with no new machinery and no wire change.
 *
 * HARD GATE: only a purchase advances (`shouldAdvanceOnComplete`). There are
 * exactly three exceptions, all structural, all of which SKIP the step rather
 * than trap the user — a paywall that cannot appear must not brick the funnel:
 * no `PaywallProvider`, a moment absent from a settled catalog, and a paywall
 * that cannot render (bad elements, or an unregistered custom screen).
 */
const PaywallStepRendererBase = ({ step, onContinue, keyboardVerticalOffset }: ContentProps) => {
  const { theme } = useTheme();
  const { headerHeight } = useOnboardingHeaderHeight();
  const validated = useMemo(() => PaywallStepTypeSchema.parse(step), [step]);
  const { moment } = validated.payload;

  const { catalog, catalogStatus, isProviderMounted, customScreens } = usePaywall();
  const { composableVariables, setComposableVariable } = useContext(OnboardingProgressContext);
  const { setVariable: setHeadlessVariable, customActions, products } =
    useContext(HeadlessProgressContext);

  const decision = useMemo(
    () =>
      resolvePaywallStepDecision<ResolvedPaywall>({
        isProviderMounted,
        catalog: catalog as { paywalls: Record<string, ResolvedPaywall> } | null,
        catalogStatus,
        moment,
      }),
    [isProviderMounted, catalog, catalogStatus, moment],
  );

  const paywall = decision.type === "show" ? decision.paywall : null;
  const isCustom = paywall?.renderMode === "custom";
  const customScreenId = (paywall?.customScreenId ?? "").trim();
  const CustomScreen = isCustom && customScreenId ? customScreens?.[customScreenId] : undefined;

  // Elements are parsed only for the elements path. A custom paywall's
  // `elements` is `[]` by construction and is never rendered, so parsing it
  // would be meaningless work whose failure would skip a perfectly good screen.
  const parsedElements = useMemo(
    () => (paywall && !isCustom ? ScreenElementsSchema.safeParse(paywall.elements) : null),
    [paywall, isCustom],
  );

  // Every skip path, as one effect. Each logs the diagnosis rather than
  // skipping quietly: a silently skipped paywall in a paid funnel is the most
  // expensive thing this file could do without saying so.
  useEffect(() => {
    if (decision.type === "no-provider") {
      console.error(
        `[Paywall step] "${validated.name}" names moment "${moment}", but no PaywallProvider is ` +
          "mounted above this onboarding, so no paywall can ever load. SKIPPING the step so the " +
          "user is not trapped. Mount it above OnboardingProvider: <PaywallProvider client={client} " +
          "productProvider={…}><App/></PaywallProvider>.",
      );
      onContinue();
      return;
    }
    if (decision.type === "unknown-moment") {
      const available = Object.keys(catalog?.paywalls ?? {})
        .map((k) => `"${k}"`)
        .join(", ");
      console.error(
        `[Paywall step] "${validated.name}" names moment "${moment}", which is not in the paywall ` +
          `catalog. SKIPPING the step so the user is not trapped. Moments available: ` +
          `${available || "(none)"}. Likely causes: the key is mis-typed, the paywall was never ` +
          "published, or the moment's audience waterfall matched nothing for this user (a moment " +
          "with no catch-all audience serves nothing to unmatched users).",
      );
      onContinue();
      return;
    }
    if (isCustom && !CustomScreen) {
      const registered = Object.keys(customScreens ?? {})
        .map((k) => `"${k}"`)
        .join(", ");
      console.error(
        `[Paywall step] The paywall for moment "${moment}" renders a custom screen, but ` +
          (customScreenId
            ? `no screen is registered under "${customScreenId}". `
            : "the studio gave it no customScreenId at all. ") +
          `SKIPPING the step so the user is not trapped. Registered ids: ${registered || "(none)"}. ` +
          "Pass the screen via <PaywallProvider customScreens={{ … }} />.",
      );
      onContinue();
      return;
    }
    if (parsedElements && !parsedElements.success) {
      console.error(
        `[Paywall step] The paywall for moment "${moment}" has elements that failed validation, so ` +
          "it cannot render. SKIPPING the step so the user is not trapped. This is a data problem " +
          "in the authored paywall — fix it in the studio.",
        parsedElements.error,
      );
      onContinue();
    }
  }, [
    decision.type,
    validated.name,
    moment,
    catalog,
    isCustom,
    CustomScreen,
    customScreenId,
    customScreens,
    parsedElements,
    onContinue,
  ]);

  const setVariableAndSync = useCallback(
    (key: string, entry: ComposableVariableEntry) => {
      setComposableVariable(key, entry);
      setHeadlessVariable(key, entry.value);
    },
    [setComposableVariable, setHeadlessVariable],
  );

  // THE GATE. `ScreenHost.complete` is how every authored action reports an
  // outcome, so filtering here is what makes "only a purchase advances" true
  // without tracking purchases anywhere. A custom screen is handed the same
  // callback, so the gate applies identically to it.
  const complete = useCallback(
    (outcome?: CompleteOutcome) => {
      if (shouldAdvanceOnComplete(outcome)) onContinue();
    },
    [onContinue],
  );

  const host: ScreenHost = useMemo(
    () => ({
      variables: composableVariables,
      setVariable: setVariableAndSync,
      complete,
      customActions,
      products,
      // A paywall step opening ANOTHER paywall is out of scope for now; the
      // engine requires the field, so this is an explicit no-op rather than an
      // accidental one.
      presentPaywall: () => {},
      keyboardVerticalOffset: keyboardVerticalOffset ?? headerHeight,
    }),
    [
      composableVariables,
      setVariableAndSync,
      complete,
      customActions,
      products,
      keyboardVerticalOffset,
      headerHeight,
    ],
  );

  // Narrowed to a plain value (or null) so the JSX below needs no non-null
  // assertion — `safeParse`'s union does not narrow through the early returns.
  const elements = parsedElements?.success ? parsedElements.data : null;

  const spinner = (
    <View style={[styles.center, { backgroundColor: theme.colors.neutral.lowest }]}>
      <ActivityIndicator />
    </View>
  );

  // Loading, or one of the skip cases whose effect above has fired and is one
  // tick from unmounting. A spinner is the honest thing to show in all of them.
  if (!paywall) return spinner;

  const template = (children: React.ReactNode) => (
    <OnboardingTemplate
      step={validated as unknown as OnboardingStepType}
      onContinue={onContinue}
      theme={theme}
      disableTopPadding
    >
      {children}
    </OnboardingTemplate>
  );

  if (isCustom) {
    if (!CustomScreen) return spinner;
    return template(
      <CustomScreen
        payload={paywall.customPayload ?? {}}
        complete={complete}
        paywall={{
          id: paywall.id,
          name: paywall.name,
          moment: paywall.moment,
          customScreenId,
        }}
      />,
    );
  }

  if (!elements) return spinner;
  return template(<ScreenRenderer elements={elements} host={host} />);
};

export const PaywallStepRenderer = withErrorBoundary(PaywallStepRendererBase, "PaywallStep");

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
