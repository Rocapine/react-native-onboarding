import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PaywallPresentation, PresentErrorReason } from "@rocapine/react-native-onboarding";

/**
 * The inline `Paywall` step's half of `PaywallProvider`'s `observer`
 * (reported as `surface: "paywall_step"` by `usePaywallHost().observePresentation`).
 *
 * A step has no `present()`, no acknowledgement and no `complete()` that ends
 * anything, so its lifecycle is defined here (proposed on RNO#286):
 *
 * - **start** — only once the step decision is `show`. `no-provider`,
 *   `loading` and `unknown-moment` start nothing: they are pre-resolution, like
 *   `present()`'s refusals.
 * - **shown** — the renderer calls it once the paywall's content commits.
 * - **end** — exactly one of:
 *   - `advance(outcome)`: the step's gate let the user through. `purchased`
 *     only when a purchase actually happened (`beginPurchase`) or the outcome
 *     says so; a plain authored `continue` reports `dismissed` (or `cancelled`
 *     after a cancelled purchase), never a conversion nobody made.
 *   - `fail(reason)`: a resolved paywall that cannot render (`parse-error`,
 *     `unknown-custom-screen`, `render-error`).
 *   - the paywall leaving the catalog mid-step: `error` / `paywall-disappeared`,
 *     as `present()` reports it.
 *   - unmount with nothing else ended: `dismissed` (the user went back, or the
 *     flow was torn down), upgraded to the last store outcome (`purchased` /
 *     `cancelled`) exactly as `present()` upgrades one. Without this a step
 *     presentation would never end.
 *
 * PURCHASES are tracked like `PaywallProvider`'s own `purchase` wrapper:
 * - the last `purchased`/`cancelled` wins, `pending`/`error` are ignored, and
 *   the key is kept only for `purchased` (`purchaseOutcomeFromResult`);
 * - a generation guard: `beginPurchase()` binds to the presentation open when
 *   the purchase STARTED, and its result is dropped if that presentation has
 *   since ended or been replaced (`shouldRecordPurchaseOutcome`'s race). It
 *   never starts a presentation, so a purchase settling after unmount reports
 *   nothing rather than a start with no end.
 *
 * START IS LAZY. A child that throws on the very first render is caught by an
 * error boundary whose `componentDidCatch` runs in the layout phase — BEFORE
 * this hook's start effect. So `fail()`/`advance()` start the presentation
 * themselves if it has not started yet, and the effect then finds it open.
 *
 * Imports only `react` and types, so it is testable under jsdom without a
 * react-native stub.
 *
 * `observePresentation` is optional: the packages are joined by a peer RANGE,
 * and a headless that predates it has no `observer` prop either, so there is
 * nothing to report — the hook then reports nothing rather than throwing.
 */
export type PaywallStepObservation = {
  shown(): void;
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
  purchaseOutcome: PurchaseOutcome;
  purchasedKey: string | null;
};

export function usePaywallStepObservation<P extends { id: string }>(
  observePresentation: ((paywall: P) => PaywallPresentation) | undefined,
  paywall: P | null,
): PaywallStepObservation {
  const latestPaywall = useRef(paywall);
  latestPaywall.current = paywall;
  const open = useRef<Open | null>(null);

  // The presentation for the CURRENT paywall, started if need be. Null while
  // there is nothing to show.
  const ensure = useCallback((): Open | null => {
    const current = latestPaywall.current;
    if (!current) return null;
    if (open.current?.id === current.id) return open.current;
    // A different paywall replaced the one being observed (a revalidation
    // swapped the moment's variant): the old one is gone from the screen.
    finish(open.current, { status: "error", reason: "paywall-disappeared" });
    open.current = {
      id: current.id,
      presentation:
        typeof observePresentation === "function" ? observePresentation(current) : NOOP_PRESENTATION,
      ended: false,
      purchaseOutcome: null,
      purchasedKey: null,
    };
    return open.current;
  }, [observePresentation]);

  const id = paywall?.id ?? null;
  useEffect(() => {
    if (id !== null) {
      ensure();
      return;
    }
    finish(open.current, { status: "error", reason: "paywall-disappeared" });
    open.current = null;
  }, [id, ensure]);

  // Unmount. Clears the ref so a StrictMode remount starts a NEW presentation
  // rather than finding an ended one and reporting nothing.
  useEffect(
    () => () => {
      finish(open.current, { status: "dismissed" });
      open.current = null;
    },
    [],
  );

  return useMemo<PaywallStepObservation>(
    () => ({
      shown: () => {
        const o = ensure();
        if (o && !o.ended) o.presentation.shown();
      },
      beginPurchase: () => {
        const started = ensure();
        if (!started) return NOOP_RECORD;
        return (result) => {
          // The generation guard: only the presentation the purchase started
          // on, and only while it is still open. Never `ensure()` here — after
          // an unmount that would start a presentation nothing ever ends.
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
