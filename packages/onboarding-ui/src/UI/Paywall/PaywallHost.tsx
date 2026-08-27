import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  usePaywallHost,
  usePaywall,
  useProductRuntime,
} from "@rocapine/react-native-onboarding";
import type { ComposableVariableEntry, PresentResult } from "@rocapine/react-native-onboarding";
import { ScreenElementsSchema, type UIElement } from "../Runtime/types";
import { ScreenRenderer } from "../Runtime/ScreenRenderer";
import type { ScreenHost, CompleteOutcome } from "../Runtime/ScreenHost";
import { withErrorBoundary } from "../ErrorBoundary";
import { useTheme } from "../Theme/useTheme";
import {
  describePaywallParseError,
  resolvePaywallModalDecision,
} from "./resolvePaywallModalDecision";
import type { CustomPaywallScreenProps, CustomPaywallScreens } from "./CustomPaywallScreen";

// `usePaywallHost().complete` takes the CLOSED `PresentResult` union
// (required argument); `ScreenHost.complete` takes the OPEN `CompleteOutcome`
// (optional argument — a bare `"continue"` action calls it with none at all).
// This function ONLY does that narrowing — nothing more.
//
// The engine itself only ever produces `undefined` (bare `"continue"`) or
// `{status:"dismissed"}` (the `dismiss` action — see `runActions.ts`) —
// `dismiss` doesn't know anything about purchase state, so a purchase closed
// via spec §4.6's `{type:"purchase", onSuccess:[{type:"dismiss"}]}` narrows
// to `"dismissed"` right here too, unchanged. The "did a purchase actually
// happen" upgrade to `"purchased"`/`"cancelled"` is NOT this function's job:
// it happens one level up, in `PaywallProvider`'s `purchase()` wrapper
// (records the outcome, race-guarded against a stale in-flight purchase from
// a PREVIOUS presentation — see `shouldRecordPurchaseOutcome`) and its
// `complete()` (applies `resolvePresentedOutcome`) — both in `present.ts` /
// `PaywallProvider.tsx`, where the product runtime and the pending
// `present()` resolver already live. This function still checks the status
// against the closed set (rather than hardcoding `"dismissed"`) purely so a
// genuinely explicit status forwards unchanged instead of being clobbered.
const PRESENT_RESULT_STATUSES: ReadonlySet<PresentResult["status"]> = new Set([
  "purchased",
  "dismissed",
  "cancelled",
  "error",
]);

function toPresentResult(outcome?: CompleteOutcome): PresentResult {
  const status = outcome?.status;
  if (status && (PRESENT_RESULT_STATUSES as ReadonlySet<string>).has(status)) {
    return { status: status as PresentResult["status"] };
  }
  return { status: "dismissed" };
}

type PaywallContentProps = {
  /** Already parsed by `PaywallHost` — see `resolvePaywallModalDecision`'s doc for why parsing happens OUTSIDE this component's error boundary. */
  elements: UIElement[];
  complete: ScreenHost["complete"];
  customActions: ScreenHost["customActions"];
};

/**
 * The onboarding adapter (`Pages/ComposableScreen/Renderer.tsx`) has a step to
 * sync into (dual-write) and `OnboardingTemplate` chrome to supply. A paywall
 * has neither: it is a root, not a step, so there is no second variable store
 * to keep in sync and no progress header/CTA template to wrap it in — the
 * paywall's own elements ARE the whole screen.
 */
const PaywallContentBase = ({ elements, complete, customActions }: PaywallContentProps) => {
  const { theme } = useTheme();
  const { present } = usePaywall();
  const productRuntime = useProductRuntime();

  // Own local variable store, scoped to this presentation only. Unlike the
  // onboarding adapter's `setVariableAndSync`, there is nothing to dual-write
  // to — a paywall does not branch on steps. State resets for free: this
  // component only exists while `activePaywall` is non-null (see
  // `PaywallHost` below), so dismissing and re-presenting unmounts and
  // remounts it, discarding any selection (e.g. a RadioGroup plan pick) from
  // the previous presentation.
  const [variables, setVariables] = useState<Record<string, ComposableVariableEntry>>({});
  const setVariable = useCallback((key: string, entry: ComposableVariableEntry) => {
    setVariables((prev) => ({ ...prev, [key]: entry }));
  }, []);

  // A paywall's own elements may fire `presentPaywall` too (spec §4.5 — a
  // paywall can open another paywall), wired through the same `present()` an
  // onboarding step uses. `PaywallProvider` shows one paywall at a time, so
  // calling this while THIS paywall is still active resolves `{status:
  // "error"}` immediately (`resolvePresentDecision`) rather than stacking a
  // second Modal — correct given the single-active-paywall design, not a bug.
  const presentPaywall = useCallback(
    (placement: string) => {
      void present(placement);
    },
    [present]
  );

  // `setVariable` (above), `customActions` and `products` are contractually
  // referentially stable (ScreenHost.ts) — `customActions` comes straight
  // from `usePaywallHost()` (frozen at module scope in PaywallProvider when
  // unset), `products` straight from `useProductRuntime()` (memoized in
  // `useProducts`). Passed through as-is, not rewrapped, so `host` only
  // changes identity when one of its dependencies actually does.
  const host: ScreenHost = useMemo(
    () => ({
      variables,
      setVariable,
      complete,
      customActions,
      products: productRuntime ?? undefined,
      presentPaywall,
      keyboardVerticalOffset: 0,
    }),
    [variables, setVariable, complete, customActions, productRuntime, presentPaywall]
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.neutral.lowest }]}>
      <ScreenRenderer elements={elements} host={host} />
    </View>
  );
};

const PaywallContent = withErrorBoundary(PaywallContentBase, "Paywall");

type CustomPaywallContentProps = CustomPaywallScreenProps & {
  Screen: React.ComponentType<CustomPaywallScreenProps>;
};

/**
 * Renders a host-registered screen in place of the element tree.
 *
 * Wrapped in the SAME error boundary as `PaywallContent`, deliberately: this
 * is the host's own component, so a crash in it is a host bug rather than a
 * data bug — but the consequence is identical either way. Without the
 * boundary, a throw here leaves the boundary-less fullScreen, non-transparent
 * Modal on screen with no interactive control and the pending `present()`
 * promise unsettled, which on iOS means force-quit. The boundary routes it to
 * `render-error`, exactly as it does for an element renderer that throws.
 *
 * No theme background `View` and no `ScreenRenderer`: the registered screen
 * owns the whole surface, and wrapping it in the SDK's own background would
 * mean a host fighting a colour it never asked for.
 */
const CustomPaywallContentBase = ({ Screen, ...props }: CustomPaywallContentProps) => (
  <Screen {...props} />
);

const CustomPaywallContent = withErrorBoundary(CustomPaywallContentBase, "Paywall");

/**
 * The second `ScreenHost` implementation — sibling to
 * `Pages/ComposableScreen/Renderer.tsx`, sharing the same screen-agnostic
 * `ScreenRenderer`. Mounted once, as a sibling of the app (spec §7):
 *
 * ```tsx
 * <PaywallProvider client={client} productProvider={revenueCatProductProvider(Purchases)}>
 *   <App />
 *   <PaywallHost />
 * </PaywallProvider>
 * ```
 *
 * Reads `usePaywallHost()` for which paywall (if any) is active and renders
 * it in a fullScreen `Modal` — either the authored element tree, or, for a
 * `renderMode: "custom"` paywall, a screen the host registered:
 *
 * ```tsx
 * const SCREENS = { "paywall-native-v2": NativePaywall }; // module scope: stable
 * <PaywallHost customScreens={SCREENS} />
 * ```
 *
 * Both paths share this one Modal, which is the whole reason the custom path
 * lives here rather than being left to the host: `onShow` (the iOS
 * refused-presentation recovery), Android `onRequestClose`, and the nested
 * `SafeAreaProvider` all apply to a custom screen without it doing anything.
 *
 * This is the first `Modal` in the repo, so each of its properties is a
 * decision made here, not a copy of precedent:
 *
 * - `presentationStyle="fullScreen"` + `transparent={false}`: a paywall is a
 *   full interstitial screen, not a popover or a dimmed sheet over visible
 *   app content, so it gets a fully opaque, fully covering presentation.
 *   (`presentationStyle` is iOS-only; Android's `Modal` is already
 *   full-screen by construction.)
 * - `animationType="slide"`: paywalls are commonly presented as a bottom
 *   sheet-style interruption; slide-up is the platform-idiomatic transition
 *   for that on both iOS and Android.
 * - `onRequestClose`: REQUIRED on Android — without it, RN throws when the
 *   hardware back button is pressed while the Modal is visible. Wired to the
 *   exact same outcome as the in-content `dismiss` action
 *   (`complete({status:"dismissed"})`), so Android back can never trap a user
 *   inside a paywall with no other way out.
 * - `SafeAreaProvider` rendered INSIDE the Modal: `react-native-safe-area-
 *   context` measures insets against the native view hierarchy it is mounted
 *   in. A `Modal` presents into a separate native hierarchy from the app
 *   root, so the app's own root `SafeAreaProvider` (e.g. the one
 *   `OnboardingProgressProvider` renders) does not reach in here — every
 *   authored `SafeAreaView` inside a paywall would silently measure zero
 *   insets without this nested provider.
 */
export type PaywallHostProps = {
  /**
   * Screens for `renderMode: "custom"` paywalls, keyed by the `customScreenId`
   * authored in the studio.
   *
   * AN OVERRIDE, not the canonical place. Register on `PaywallProvider`
   * instead: the inline `Paywall` onboarding step is a second renderer of these
   * screens and never goes through `PaywallHost`, so one registration on the
   * provider serves both. This prop predates that step (1.72.0) and is kept so
   * those integrations keep compiling; when both are set, this one wins for
   * this host.
   *
   * A paywall naming a key absent from the effective map never opens the Modal
   * — it resolves `{ status: "error", reason: "unknown-custom-screen" }` and
   * logs both the missing id and the ones that are registered.
   *
   * MUST be referentially stable (module scope, or `useMemo`). It is a
   * `useMemo` dependency of the decision below, so a fresh object every render
   * re-derives that decision every render.
   */
  customScreens?: CustomPaywallScreens;
};

export const PaywallHost = ({ customScreens }: PaywallHostProps = {}) => {
  const {
    activePaywall,
    complete: resolvePresent,
    acknowledgePresentation,
    customActions,
    customScreens: providerScreens,
  } = usePaywallHost();

  // The prop wins where it is passed, otherwise the provider's registry. NOT
  // merged: two half-registries would make "which map is this id missing from"
  // unanswerable, and the log below names the registered ids.
  const effectiveScreens = customScreens ?? providerScreens;

  // Adapts the engine's open `ScreenHost.complete` (optional CompleteOutcome)
  // into `usePaywallHost().complete`'s closed, required `PresentResult` — see
  // `toPresentResult` above. `resolvePresent` is itself stable (empty-deps
  // `useCallback` in `PaywallProvider`), so this wrapper is too.
  const complete = useCallback(
    (outcome?: CompleteOutcome) => resolvePresent(toPresentResult(outcome)),
    [resolvePresent]
  );

  // Android hardware back must resolve exactly like the in-content `dismiss`
  // action. `complete` no-ops safely if called with nothing pending, so there
  // is no need to additionally gate this on `activePaywall`.
  const handleRequestClose = useCallback(() => {
    complete({ status: "dismissed" });
  }, [complete]);

  // N4, 2026-08-18 final review round 2: Finding 2 closes the trap for a
  // payload that fails to PARSE, but `PaywallContent` is still wrapped in an
  // error boundary for a genuine RENDER-time crash the parse can't predict
  // (an element renderer throwing on valid-but-unusual props) — that fallback
  // still has no interactive control, still inside a fullScreen, non-
  // transparent Modal. Symmetric fix: resolve the pending `present()` call
  // with `"error"` the same way a parse failure does, closing the trap
  // completely instead of narrowing it.
  // `resolvePresent` directly, not the `complete` wrapper above: that wrapper
  // goes through `toPresentResult`, which narrows to `{status}` alone and would
  // drop the reason. The reason is the whole point — a caller must be able to
  // tell a crashed render from a refused presentation from an unknown placement.
  const handleRenderError = useCallback(() => {
    resolvePresent({ status: "error", reason: "render-error" });
  }, [resolvePresent]);

  // Parsed OUTSIDE `PaywallContent`'s error boundary — Finding 2, 2026-08-17
  // final review — so a malformed payload never reaches the Modal at all. See
  // `resolvePaywallModalDecision`'s doc for the full reasoning.
  const decision = useMemo(
    () =>
      resolvePaywallModalDecision(
        activePaywall,
        (elements) => ScreenElementsSchema.safeParse(elements),
        effectiveScreens
      ),
    [activePaywall, effectiveScreens]
  );

  // A parse failure resolves the pending `present()` call with `"error"` —
  // exactly what `PresentResult.error` exists for — instead of opening a
  // Modal with nothing renderable inside it. Runs as an effect (a side
  // effect, not a render-time call); `complete` no-ops safely if this ever
  // ran with nothing pending.
  useEffect(() => {
    if (decision.type !== "parse-error") return;
    // LOG IT. `safeParse` already computed exactly which prop is wrong, and
    // discarding that was its own bug: a paywall that can never render
    // resolved a bare "error", with no log at any level, so the cause was only
    // reachable by fetching the payload and re-running the schema by hand.
    // Almost always a CMS data bug (a wrong enum value), which the host cannot
    // fix and the author must — so name the path and the value.
    console.error(
      `[PaywallHost] Paywall "${activePaywall?.moment ?? "?"}" (${activePaywall?.id ?? "?"}) ` +
        "was NOT shown: its elements failed validation. This is a data problem in the " +
        `authored paywall, not a device problem — fix it in the studio. ` +
        describePaywallParseError(decision.error, activePaywall?.elements),
    );
    resolvePresent({ status: "error", reason: "parse-error" });
  }, [decision, resolvePresent, activePaywall]);

  // The custom-mode twin of the effect above, and the same trap it closes: a
  // paywall that cannot render must resolve the pending `present()` call
  // rather than opening an empty Modal. The distinct reason is the point —
  // `parse-error` is a data bug for the studio author, this is a wiring bug in
  // the host app, and the log below is written for whoever has to fix THAT:
  // naming the ids that ARE registered turns "why is nothing showing" into a
  // typo you can see.
  useEffect(() => {
    if (decision.type !== "unknown-custom-screen") return;
    const registered = Object.keys(effectiveScreens ?? {});
    console.error(
      `[PaywallHost] Paywall "${activePaywall?.moment ?? "?"}" (${activePaywall?.id ?? "?"}) ` +
        "was NOT shown: it is set to render a custom screen, but " +
        (decision.customScreenId
          ? `no screen is registered under "${decision.customScreenId}". `
          : "the studio gave it no customScreenId at all. ") +
        (registered.length > 0
          ? `Registered ids: ${registered.map((id) => `"${id}"`).join(", ")}. `
          : "No customScreens were registered on PaywallProvider or PaywallHost. ") +
        "Register it via <PaywallProvider customScreens={{ ... }} />, or set the paywall's " +
        "Render mode back to Elements in the studio.",
    );
    resolvePresent({ status: "error", reason: "unknown-custom-screen" });
  }, [decision, resolvePresent, activePaywall, effectiveScreens]);

  return (
    <Modal
      visible={decision.type === "show" || decision.type === "show-custom"}
      animationType="slide"
      presentationStyle="fullScreen"
      transparent={false}
      onRequestClose={handleRequestClose}
      // The host's confirmation that the paywall is genuinely on screen.
      // `PaywallProvider` abandons an unacknowledged presentation after its
      // timeout, because iOS silently REFUSES to present over an
      // already-presenting view controller (another Modal, a
      // `presentation: "modal"` route, a StoreKit alert) — and without this
      // signal that refusal wedged every later present() call for the life of
      // the process. onShow never fires when the platform refuses, which is
      // exactly what makes it the right signal.
      onShow={acknowledgePresentation}
    >
      <SafeAreaProvider>
        {decision.type === "show" && activePaywall && (
          <PaywallContent
            key={activePaywall.id}
            elements={decision.elements}
            complete={complete}
            customActions={customActions}
            onError={handleRenderError}
          />
        )}
        {/* Same Modal, same `onShow` acknowledgement, same Android
            `onRequestClose`, same nested SafeAreaProvider — only the content
            differs. That is why a custom screen gets the iOS
            refused-presentation recovery and the hardware-back escape for
            free, rather than each host having to reimplement both. */}
        {decision.type === "show-custom" && activePaywall && (
          <CustomPaywallContent
            key={activePaywall.id}
            Screen={decision.Screen}
            payload={decision.payload}
            complete={complete}
            paywall={{
              id: activePaywall.id,
              name: activePaywall.name,
              moment: activePaywall.moment,
              customScreenId: decision.customScreenId,
            }}
            onError={handleRenderError}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
