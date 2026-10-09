import { useCallback, useContext, useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
  usePaywall,
  usePaywallHost,
} from "@rocapine/react-native-onboarding";
import { PaywallStepTypeSchema, type PaywallStepType } from "./types";
import type { OnboardingStepType } from "../../types";
import { resolvePaywallStepDecision } from "./resolvePaywallStepDecision";
import { shouldAdvanceOnComplete } from "./shouldAdvanceOnComplete";
import { usePaywallStepObservation } from "./usePaywallStepObservation";
import { ErrorBoundary, withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import {
  OnboardingProgressContext,
  ComposableVariableEntry,
} from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { ScreenRenderer } from "../../Runtime/ScreenRenderer";
import type { ScreenHost, CompleteOutcome } from "../../Runtime/ScreenHost";
import type { PermissionResolver } from "../../Runtime/elements/permissions";
import { ScreenElementsSchema } from "../../Runtime/types";

type ContentProps = {
  step: PaywallStepType;
  onContinue: () => void;
  keyboardVerticalOffset?: number;
  /**
   * See `OnboardingPageProps` — host override for the `requestPermission`
   * action's resolver, forwarded from there because a paywall's own elements can
   * carry that action just as an onboarding step's can.
   *
   * Threading it is not tidiness. Review round 1 of #196: with the field unset
   * here, a consumer who passed a resolver to `OnboardingPage` got it for a
   * `ComposableScreen` step and NOT for a byte-identical action inside a
   * `Paywall` step in the same flow — the bundled resolver answered
   * `"unavailable"` and the user was recorded as refusing a permission nobody
   * asked them for. Same payload, two answers, no error anywhere.
   */
  requestPermission?: PermissionResolver;
};

/** The fields this renderer reads off a resolved catalog entry. */
type ResolvedPaywall = {
  id: string;
  name: string;
  moment: string;
  // Read only to report the presentation to `PaywallProvider`'s observer.
  audienceId?: number | null;
  billing?: "store" | "stripe";
  products?: Array<{ key: string; ios?: string; android?: string }>;
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
const PaywallStepRendererBase = ({
  step,
  onContinue,
  keyboardVerticalOffset,
  requestPermission,
}: ContentProps) => {
  const { theme } = useTheme();
  const { headerHeight } = useOnboardingHeaderHeight();
  const validated = useMemo(() => PaywallStepTypeSchema.parse(step), [step]);
  const { moment } = validated.payload;

  const { catalog, catalogStatus, isProviderMounted, customScreens } = usePaywall();
  const { observePresentation } = usePaywallHost();
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

  // Reports this step to `PaywallProvider`'s `observer` (surface
  // "paywall_step"). Starts only on a `show` decision; see the hook for the
  // whole lifecycle. Declared BEFORE the skip effect below, so a paywall that
  // resolves and then cannot render is started before it is failed.
  const observation = usePaywallStepObservation(observePresentation, paywall);
  const renderable = isCustom ? Boolean(CustomScreen) : Boolean(parsedElements?.success);
  useEffect(() => {
    if (renderable) observation.shown();
  }, [renderable, paywall?.id, observation]);

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
      observation.fail("unknown-custom-screen");
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
      observation.fail("parse-error");
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
    observation,
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
      if (!shouldAdvanceOnComplete(outcome)) return;
      observation.advance(outcome);
      onContinue();
    },
    [onContinue, observation],
  );

  // The step's own purchases, recorded so the observer's `end()` reports what
  // the store did (`purchased` with the slot, or `cancelled`). Wraps the runtime
  // rather than reading the provider's per-`present()` tracking, which a step is
  // not part of. `beginPurchase` runs BEFORE the await, so a result that settles
  // after the paywall was swapped or the step unmounted is dropped — the
  // provider's `shouldRecordPurchaseOutcome` rule.
  const observedProducts = useMemo(
    () =>
      products && {
        ...products,
        purchase: async (key: string) => {
          const record = observation.beginPurchase();
          const result = await products.purchase(key);
          record(result);
          return result;
        },
      },
    [products, observation],
  );

  const host: ScreenHost = useMemo(
    () => ({
      variables: composableVariables,
      setVariable: setVariableAndSync,
      complete,
      customActions,
      products: observedProducts,
      // A paywall step opening ANOTHER paywall is out of scope for now; the
      // engine requires the field, so this is an explicit no-op rather than an
      // accidental one.
      presentPaywall: () => {},
      requestPermission,
      keyboardVerticalOffset: keyboardVerticalOffset ?? headerHeight,
    }),
    [
      composableVariables,
      setVariableAndSync,
      complete,
      customActions,
      observedProducts,
      requestPermission,
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

  // The inner boundary exists to REPORT a render-time crash as
  // `end(error, render-error)`: the outer `withErrorBoundary` sits above this
  // component, so a crash caught there unmounts it and could only ever read as
  // a dismissal. Same `ErrorBoundary`, same `stepType`, wrapping the whole
  // output — the fallback the user sees is the one they saw before.
  const template = (children: React.ReactNode) => (
    <ErrorBoundary stepType="PaywallStep" onError={() => observation.fail("render-error")}>
      <OnboardingTemplate
        step={validated as unknown as OnboardingStepType}
        onContinue={onContinue}
        theme={theme}
        disableTopPadding
      >
        {children}
      </OnboardingTemplate>
    </ErrorBoundary>
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
