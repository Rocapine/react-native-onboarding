import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PaywallPresentation, PresentErrorReason } from "@rocapine/react-native-onboarding";

/**
 * The inline `Paywall` step's half of `PaywallProvider`'s `observer`
 * (reported as `surface: "paywall_step"` by `usePaywallHost().observePresentation`).
 *
 * A step has no `present()`, no acknowledgement and no `complete()` that ends
 * anything, so its lifecycle is defined here (proposed on RNO#286, reworked in
 * review round 2):
 *
 * ONE PRESENTATION PER VISIT. A visit runs from the step gaining focus to it
 * losing focus (or unmounting), read through the onboarding's own
 * `navigation.useFocusEffect` — the `useOnboardingStep` precedent, because a
 * push-based Stack keeps an advanced step MOUNTED and shows it again on back,
 * and `present()` opens a fresh presentation for every showing (r1-5). Inside a
 * visit the presentation is keyed on the moment, not on the paywall id: a
 * revalidation that swaps the moment's variant keeps it open, exactly as
 * `PaywallProvider` does — it ends one only when its paywall becomes null
 * (`PaywallProvider.tsx:703-706`), so a purchase in flight across a swap is
 * still reported (r1-1). The info passed to `start()` is the paywall as it was
 * at start, the provider's choice too. An ENDED presentation is not reused for
 * a different paywall: after a render crash, a revalidated variant renders (the
 * boundary is keyed by id) and can be bought, so it starts its own.
 *
 * - **start** — once the step decision is `show` and the step is focused.
 *   `no-provider`, `loading` and `unknown-moment` start nothing: they are
 *   pre-resolution, like `present()`'s refusals.
 * - **shown** — at most once per presentation, once `renderable` is true.
 * - **end** — exactly one of:
 *   - `advance(outcome)`: the step's gate let the user through. `purchased`
 *     only when a purchase actually happened (`beginPurchase`) or the outcome
 *     says so; a plain authored `continue` reports `dismissed` (or `cancelled`
 *     after a cancelled purchase), never a conversion nobody made.
 *   - `fail(reason)`: a resolved paywall that cannot render (`parse-error`,
 *     `unknown-custom-screen`, `render-error`).
 *   - the paywall leaving the catalog mid-step: `error` / `paywall-disappeared`,
 *     as `present()` reports it.
 *   - blur or unmount with nothing else ended: `dismissed` (the user went back,
 *     or the flow was torn down), upgraded to the last store outcome
 *     (`purchased` / `cancelled`) exactly as `present()` upgrades one.
 *
 * NOTHING AFTER THE VISIT. Between blur/unmount and the next focus every call
 * is a no-op. A purchase that settles after the step left is followed in the
 * real runtime by its `onSuccess` `continue` reaching `advance()` through a
 * stale closure; that must not start a presentation nobody saw (r1-2).
 *
 * PURCHASES are tracked like `PaywallProvider`'s own `purchase` wrapper:
 * - the last `purchased`/`cancelled` wins, `pending`/`error` are ignored, and
 *   the key is kept only for `purchased` (`purchaseOutcomeFromResult`);
 * - a generation guard: `beginPurchase()` binds to the presentation open when
 *   the purchase STARTED, and its result is dropped if that presentation has
 *   since ended or been replaced (`shouldRecordPurchaseOutcome`'s race).
 *
 * START IS LAZY. A child that throws on the very first render is caught by an
 * error boundary whose `componentDidCatch` runs in the layout phase — BEFORE
 * this hook's effects. So `fail()`/`advance()` start the presentation
 * themselves if it has not started yet, and the effects then find it open.
 *
 * Imports only `react` and types, so it is testable under jsdom without a
 * react-native stub.
 *
 * `observePresentation` is optional: the packages are joined by a peer RANGE,
 * and a headless that predates it has no `observer` prop either, so there is
 * nothing to report — the hook then reports nothing rather than throwing.
 */
export type PaywallStepObservation = {
  /**
   * Call BEFORE awaiting the store; call the returned function with the store's
   * result. Bound to the presentation open at the call.
   */
  beginPurchase(): (result: StepPurchaseResult) => void;
  advance(outcome: { status?: string } | undefined): void;
  fail(reason: PresentErrorReason): void;
};

/** Structural `PurchaseResult`: only the fields read here. */
export type StepPurchaseResult = { status: string; productKey?: string };
type StepOutcome = { status: "purchased" | "dismissed" | "cancelled" | "error"; reason?: PresentErrorReason };
type PurchaseOutcome = "purchased" | "cancelled" | null;

/**
 * UI mirrors of the headless `purchaseOutcomeFromResult` and
 * `resolvePresentedOutcome` (`packages/onboarding/src/paywalls/present.ts`),
 * held equal by `__tests__/usePaywallStepObservation.test.ts`, which feeds both
 * the same table. Mirrored rather than imported for the reason
 * `Runtime/elements/completingActions.ts` gives: a runtime import would key this
 * package's behaviour on whichever headless version the host resolved.
 */
export const purchaseOutcomeFromResult = (result: StepPurchaseResult): PurchaseOutcome =>
  result.status === "purchased" || result.status === "cancelled" ? result.status : null;

export const resolvePresentedOutcome = <R extends { status: string }>(
  reported: R,
  purchaseOutcome: PurchaseOutcome,
): R | { status: "purchased" | "cancelled" } =>
  reported.status === "dismissed" && purchaseOutcome ? { status: purchaseOutcome } : reported;

const NOOP_PRESENTATION: PaywallPresentation = { shown: () => {}, end: () => {} };
const NOOP_RECORD = () => {};

type Open = {
  id: string;
  presentation: PaywallPresentation;
  ended: boolean;
  shown: boolean;
  purchaseOutcome: PurchaseOutcome;
  purchasedKey: string | null;
};

type FocusEffect = (effect: () => void | (() => void)) => void;

export type PaywallStepObservationOptions = {
  /** The paywall's content can render (elements parsed, custom screen registered). */
  renderable: boolean;
  /**
   * The onboarding's `navigation.useFocusEffect`. Must be a stable reference
   * (the `OnboardingProvider` `navigation` contract). Without one, a visit is
   * the mount — `expoRouterAdapter`'s own fallback.
   */
  useFocusEffect?: FocusEffect;
};

const useMountAsFocus: FocusEffect = (effect) => {
  useEffect(effect, [effect]);
};

export function usePaywallStepObservation<P extends { id: string }>(
  observePresentation: ((paywall: P) => PaywallPresentation) | undefined,
  paywall: P | null,
  { renderable, useFocusEffect = useMountAsFocus }: PaywallStepObservationOptions,
): PaywallStepObservation {
  const latestPaywall = useRef(paywall);
  latestPaywall.current = paywall;
  // Read through refs so every callback below is stable: the focus effect
  // re-runs on a new callback identity, and a re-run is a blur + focus — an
  // end and a restart for a mere re-render or an inline `observePresentation`.
  const observeRef = useRef(observePresentation);
  observeRef.current = observePresentation;
  const renderableRef = useRef(renderable);
  renderableRef.current = renderable;
  const open = useRef<Open | null>(null);
  // Between focus and blur/unmount. True from the first render, so the lazy
  // start in a first-render `componentDidCatch` (before any effect) works.
  const visiting = useRef(true);

  // The presentation for this visit, started if need be. Null while there is
  // nothing to show or the step is not being visited.
  const ensure = useCallback((): Open | null => {
    const current = latestPaywall.current;
    if (!visiting.current || !current) return null;
    // A live presentation survives a variant swap (r1-1). An ENDED one is not
    // reused for a different paywall: after a crash a revalidated variant
    // renders and can be bought, so it is a presentation of its own.
    if (open.current && !(open.current.ended && open.current.id !== current.id)) return open.current;
    const observe = observeRef.current;
    open.current = {
      id: current.id,
      presentation: typeof observe === "function" ? observe(current) : NOOP_PRESENTATION,
      ended: false,
      shown: false,
      purchaseOutcome: null,
      purchasedKey: null,
    };
    return open.current;
  }, []);

  const reportShown = useCallback(() => {
    if (!renderableRef.current) return;
    const o = ensure();
    if (!o || o.ended || o.shown) return;
    o.shown = true;
    o.presentation.shown();
  }, [ensure]);

  const leave = useCallback(() => {
    finish(open.current, { status: "dismissed" });
    open.current = null;
    visiting.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      visiting.current = true;
      ensure();
      reportShown();
      return leave;
    }, [ensure, reportShown, leave]),
  );

  const id = paywall?.id ?? null;
  useEffect(() => {
    if (id !== null) {
      ensure();
      return;
    }
    finish(open.current, { status: "error", reason: "paywall-disappeared" });
    open.current = null;
  }, [id, ensure]);

  useEffect(() => {
    if (renderable) reportShown();
  }, [renderable, id, reportShown]);

  // Unmount, for a navigation whose focus effect does not clean up on unmount.
  // `finish` is idempotent, so the usual double cleanup is harmless. The setup
  // re-arms a StrictMode remount, which runs this cleanup in between.
  useEffect(() => {
    visiting.current = true;
    return leave;
  }, [leave]);

  return useMemo<PaywallStepObservation>(
    () => ({
      beginPurchase: () => {
        const started = ensure();
        if (!started) return NOOP_RECORD;
        return (result) => {
          // The generation guard: only the presentation the purchase started
          // on, and only while it is still open. Never `ensure()` here — after
          // the visit that would start a presentation nothing ever ends.
          if (open.current !== started || started.ended) return;
          const outcome = purchaseOutcomeFromResult(result);
          if (!outcome) return;
          started.purchaseOutcome = outcome;
          started.purchasedKey = outcome === "purchased" ? (result.productKey ?? null) : null;
        };
      },
      advance: (outcome) => {
        // The gate only lets through `purchased` or no status (a plain
        // continue); the latter is `present()`'s bare `dismissed`.
        finish(ensure(), { status: outcome?.status === "purchased" ? "purchased" : "dismissed" });
      },
      fail: (reason) => finish(ensure(), { status: "error", reason }),
    }),
    [ensure],
  );
}

function finish(o: Open | null, result: StepOutcome) {
  if (!o || o.ended) return;
  o.ended = true;
  // A bare `dismissed` takes the store's last outcome, exactly as `present()`'s
  // `complete()` does. Spec §4.6's canonical
  // `{type:"purchase", onSuccess:[{type:"dismiss"}]}` does not advance a step,
  // so its end arrives here from unmount, and must not read as a non-conversion;
  // a cancelled purchase followed by leaving reads as `cancelled`, as it does
  // through `present()`.
  const final = resolvePresentedOutcome(result, o.purchaseOutcome);
  o.presentation.end(final, o.purchasedKey);
}
