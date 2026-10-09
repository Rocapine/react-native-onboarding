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
 *     only when a purchase actually happened (`recordPurchase`) or the outcome
 *     says so; a plain authored `continue` reports `dismissed`, never a
 *     conversion nobody made.
 *   - `fail(reason)`: a resolved paywall that cannot render (`parse-error`,
 *     `unknown-custom-screen`, `render-error`).
 *   - the paywall leaving the catalog mid-step: `error` / `paywall-disappeared`,
 *     as `present()` reports it.
 *   - unmount with nothing else ended: `dismissed` (the user went back, or the
 *     flow was torn down). Without this a step presentation would never end.
 *
 * START IS LAZY. A child that throws on the very first render is caught by an
 * error boundary whose `componentDidCatch` runs in the layout phase — BEFORE
 * this hook's start effect. So `fail()`/`advance()` start the presentation
 * themselves if it has not started yet, and the effect then finds it open.
 *
 * Imports only `react` and types, so it is testable under jsdom without a
 * react-native stub.
 */
export type PaywallStepObservation = {
  shown(): void;
  recordPurchase(productKey: string): void;
  advance(outcome: { status?: string } | undefined): void;
  fail(reason: PresentErrorReason): void;
};

type Open = {
  id: string;
  presentation: PaywallPresentation;
  ended: boolean;
  purchasedKey: string | null;
};

export function usePaywallStepObservation<P extends { id: string }>(
  observePresentation: (paywall: P) => PaywallPresentation,
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
      presentation: observePresentation(current),
      ended: false,
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
      recordPurchase: (productKey) => {
        const o = ensure();
        if (o) o.purchasedKey = productKey;
      },
      advance: (outcome) => {
        const o = ensure();
        if (!o) return;
        const purchased = outcome?.status === "purchased" || o.purchasedKey !== null;
        finish(o, { status: purchased ? "purchased" : "dismissed" });
      },
      fail: (reason) => finish(ensure(), { status: "error", reason }),
    }),
    [ensure],
  );
}

function finish(
  o: Open | null,
  result: { status: "purchased" | "dismissed" | "cancelled" | "error"; reason?: PresentErrorReason },
) {
  if (!o || o.ended) return;
  o.ended = true;
  o.presentation.end(result, result.status === "purchased" ? o.purchasedKey : null);
}
