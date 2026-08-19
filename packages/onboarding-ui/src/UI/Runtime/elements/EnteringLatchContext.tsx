import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
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
 * Builds the per-screen latch and drives `settled`.
 *
 * `InteractionManager.runAfterInteractions` is the right primitive here: the SDK
 * cannot know the host navigator's transition duration (it belongs to the app's
 * navigator, not to us), and hardcoding a guess would be wrong on every app that
 * configured something else. RN already tracks "no interaction or animation is
 * in flight", which is exactly the question.
 *
 * The value identity changes exactly once per screen, when `settled` flips —
 * so consumers re-render once, at the moment they are meant to.
 */
export const useEnteringLatchValue = (): EnteringLatchValue => {
  const latchRef = useRef<EnteringLatch | null>(null);
  if (latchRef.current === null) latchRef.current = createEnteringLatch();

  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setSettled(true));
    return () => handle.cancel();
  }, []);

  return useMemo(() => ({ latch: latchRef.current!, settled }), [settled]);
};
