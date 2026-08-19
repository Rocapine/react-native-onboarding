import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createEnteringLatch, type EnteringLatch } from "./enteringLatch";

// Screen-scoped state behind `animation.entering.once`: which elements have
// already played, and whether the screen has finished arriving.
//
// Separate from `AnimatedVariablesContext` on purpose. That registry has the
// right lifetime and stability, but its contract is "SharedValues a producer
// animates on the UI thread" — overloading it with an unrelated latch would make
// its name a lie. Same shape, honest name.
export type EnteringLatchValue = {
  latch: EnteringLatch;
  /**
   * False until the screen has finished its entry transition. Elements with
   * `once` hold their entrance until this flips, so a push animation (and the
   * first paint of remote images) doesn't consume it.
   */
  settled: boolean;
};

// Default for any tree with no provider — e.g. a renderer used outside
// `ScreenRenderer`. `settled: true` means `once` degrades to "play on first
// mount, never again": the latch still works, only the deferral is skipped.
// Failing open like this keeps an unprovided tree animating rather than silent.
const FALLBACK: EnteringLatchValue = { latch: createEnteringLatch(), settled: true };

export const EnteringLatchContext = React.createContext<EnteringLatchValue>(FALLBACK);

export const useEnteringLatch = (): EnteringLatchValue => useContext(EnteringLatchContext);

/**
 * Default wait before a deferred initial-mount entrance is released.
 *
 * Approximates a typical native-stack push (~350ms). It is a duration and not a
 * framework signal because **no usable signal exists**: React Native stubbed
 * `InteractionManager` — as of 0.85 `runAfterInteractions` is a bare
 * `setImmediate` and `createInteractionHandle()` returns `-1` — so it resolves on
 * the next tick and waits for neither the navigation transition nor anything
 * else. Image loading never registered an interaction handle in any version
 * (`Libraries/Image` does not reference `InteractionManager` at all), so it would
 * not have covered decode even unstubbed. The navigation adapter exposes no
 * transition-complete hook either.
 *
 * A host that knows its own transition duration should pass
 * `enteringSettleDelayMs` instead of relying on this.
 */
export const DEFAULT_ENTERING_SETTLE_MS = 350;

/**
 * Builds the per-screen latch and drives `settled`.
 *
 * The value identity changes exactly once per screen, when `settled` flips — so
 * consumers re-render once, at the moment they are meant to.
 *
 * Scope note, because it is easy to over-claim: this buys the element clear air
 * from the **entry transition**. It does NOT wait for remote images to decode —
 * nothing in React Native reports that — so a cold, slow first load can still
 * outrun it. Delaying by the transition does hand decode a head start, but that
 * is a side effect, not a guarantee.
 */
export const useEnteringLatchValue = (settleDelayMs?: number): EnteringLatchValue => {
  const latchRef = useRef<EnteringLatch | null>(null);
  if (latchRef.current === null) latchRef.current = createEnteringLatch();

  const [settled, setSettled] = useState(false);
  const delay = settleDelayMs ?? DEFAULT_ENTERING_SETTLE_MS;

  useEffect(() => {
    if (delay <= 0) {
      setSettled(true);
      return;
    }
    const id = setTimeout(() => setSettled(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  return useMemo(() => ({ latch: latchRef.current!, settled }), [settled]);
};
