import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  PaywallPresentation,
  PaywallPresentationSource,
  PresentErrorReason,
} from "@rocapine/react-native-onboarding";

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
 * revalidation that swaps the moment's variant keeps it open, as `present()`
 * does (`PaywallProvider` reacts only to its paywall becoming null), so a
 * purchase in flight across a swap is still reported (r1-1). The info passed to
 * `start()` is the paywall as it was at start, the provider's choice too; the
 * store id a purchase reports is the variant it was made on, on both surfaces.
 * An ENDED presentation is not reused for
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
 *     as `present()` reports it — unless a purchase settled `purchased` on it
 *     (then `purchased`) or is still in flight (then it waits, as below).
 *   - blur or unmount with nothing else ended: `dismissed` (the user went back,
 *     or the flow was torn down), upgraded to the last store outcome
 *     (`purchased` / `cancelled`) exactly as `present()` upgrades one.
 *
 * A LATE PURCHASE COUNTS (owner decision on #286). If a purchase is in flight
 * when the step blurs or unmounts, the visit's presentation is DETACHED rather
 * than ended: it stays open until every purchase pending on it settles, then
 * ends `dismissed` upgraded to the store outcome, so a purchase that completes
 * after the user left still ends `purchased` with its key. A purchase that never
 * settles is bounded by `LATE_PURCHASE_TIMEOUT_MS`, then the presentation ends
 * `dismissed`. The paywall leaving the catalog waits the same way, and a
 * purchase that already settled `purchased` wins over it: the conversion is
 * never reported as an error (owner decision on #286, shared with `present()`).
 *
 * NOTHING ELSE AFTER THE VISIT. Between blur/unmount and the next focus every
 * other call is a no-op. A purchase that settles after the step left is
 * followed in the real runtime by its `onSuccess` `continue` reaching
 * `advance()` through the same closure; that must not start a presentation
 * nobody saw (r1-2). A re-entry while a purchase is pending starts a NEW
 * presentation; the old purchase's result only ever reaches the presentation
 * it started on.
 *
 * PURCHASES are tracked like `PaywallProvider`'s own `purchase` wrapper:
 * - the last `purchased`/`cancelled` wins, `pending`/`error` are ignored, and
 *   the key is kept only for `purchased` (`purchaseOutcomeFromResult`);
 * - a generation guard: `beginPurchase()` binds to the presentation open when
 *   the purchase STARTED, and its result is dropped once that presentation has
 *   ended (the provider's record binding). A detached one has not.
 * - the paywall the purchase was made on goes with the key, so after a variant
 *   swap the store id reported is the bought variant's, not the first one's.
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

/**
 * How long a step that was left with a purchase in flight waits for it.
 * Mirrors the headless `LATE_PURCHASE_TIMEOUT_MS` (`paywalls/present.ts`, the
 * same wait for `present()`) and `DEFAULT_PURCHASE_TIMEOUT_MS` in
 * `packages/onboarding/src/products/adapters/expoIap.ts`, mirrored rather than
 * imported for the peer-range reason above and held equal by the test: that adapter
 * answers `pending` after the same wait, counted from the purchase START, so it
 * settles first and this only ever fires for a provider with no bound of its
 * own. Counted from the blur, so it is never shorter than the adapter's.
 */
export const LATE_PURCHASE_TIMEOUT_MS = 180_000;

const NOOP_PRESENTATION: PaywallPresentation = { shown: () => {}, end: () => {} };
const NOOP_RECORD = () => {};

type Open = {
  id: string;
  presentation: PaywallPresentation;
  ended: boolean;
  shown: boolean;
  purchaseOutcome: PurchaseOutcome;
  purchasedKey: string | null;
  /** The paywall the recorded purchase was made on. */
  purchasedFrom: PaywallPresentationSource | null;
  /** Purchases begun on this presentation and not yet settled. */
  pending: number;
  /** The late-purchase bound, armed when the visit left with `pending > 0`. */
  timer: ReturnType<typeof setTimeout> | null;
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

export function usePaywallStepObservation<P extends PaywallPresentationSource>(
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
      purchasedFrom: null,
      pending: 0,
      timer: null,
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
    const o = open.current;
    open.current = null;
    visiting.current = false;
    if (!o || o.ended) return;
    if (o.pending > 0) detach(o);
    else finish(o, { status: "dismissed" });
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
    disappear(open.current);
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
        const on = latestPaywall.current;
        started.pending += 1;
        let settled = false;
        return (result) => {
          if (settled) return;
          settled = true;
          started.pending -= 1;
          // The generation guard: only the presentation the purchase started
          // on, and only while it is still open (a detached one is). Never
          // `ensure()` here — after the visit that would start a presentation
          // nothing ever ends.
          if (started.ended) return;
          const outcome = purchaseOutcomeFromResult(result);
          if (outcome) {
            started.purchaseOutcome = outcome;
            started.purchasedKey = outcome === "purchased" ? (result.productKey ?? null) : null;
            started.purchasedFrom = outcome === "purchased" ? on : null;
          }
          // Detached and nothing else in flight: the late purchase ends it.
          if (open.current !== started && started.pending === 0) finish(started, { status: "dismissed" });
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

/**
 * Leaves `o` open, no longer the visit's, for the purchases still in flight on
 * it: the last one to settle ends it. Never cleared by an unmount, or a
 * purchase that never settles would leak it.
 */
function detach(o: Open) {
  o.timer ??= setTimeout(() => finish(o, { status: "dismissed" }), LATE_PURCHASE_TIMEOUT_MS);
}

/**
 * The paywall left the catalog under an open presentation. A purchase wins
 * over that (owner decision on #286): one in flight is waited for as a blur
 * waits, one that settled `purchased` ends it `purchased`. Only with neither is
 * it `paywall-disappeared`, at once. A settled `cancelled` alone does not win.
 */
function disappear(o: Open | null) {
  if (!o || o.ended) return;
  if (o.pending > 0) detach(o);
  else if (o.purchaseOutcome === "purchased") finish(o, { status: "purchased" });
  else finish(o, { status: "error", reason: "paywall-disappeared" });
}

function finish(o: Open | null, result: StepOutcome) {
  if (!o || o.ended) return;
  o.ended = true;
  if (o.timer) clearTimeout(o.timer);
  o.timer = null;
  // A bare `dismissed` takes the store's last outcome, exactly as `present()`'s
  // `complete()` does. Spec §4.6's canonical
  // `{type:"purchase", onSuccess:[{type:"dismiss"}]}` does not advance a step,
  // so its end arrives here from unmount, and must not read as a non-conversion;
  // a cancelled purchase followed by leaving reads as `cancelled`, as it does
  // through `present()`.
  const final = resolvePresentedOutcome(result, o.purchaseOutcome);
  o.presentation.end(final, o.purchasedKey, o.purchasedFrom);
}
