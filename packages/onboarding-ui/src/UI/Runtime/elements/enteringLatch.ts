/**
 * Screen-scoped record of which elements have already played their `once`
 * entrance, plus the pure decision that drives it.
 *
 * Kept free of react and react-native imports so the decision table can be
 * unit-tested directly (the vitest project runs in a node environment).
 */

export type EnteringLatch = {
  /** Has this element id already played its entrance on this screen? */
  hasPlayed: (id: string) => boolean;
  /** Record that it has. Deliberately NOT reactive — see `decideEnteringPlay`. */
  markPlayed: (id: string) => void;
};

// A plain mutable Set behind a stable object. It must not be React state: the
// mark happens *while the animation is running*, and a re-render triggered by it
// would flip the decision from "play" to "already played" mid-flight, change the
// key, remount the element and cut the animation off at the knees. Nothing reads
// this reactively; the value is sampled once per mount (see below).
export const createEnteringLatch = (): EnteringLatch => {
  const played = new Set<string>();
  return {
    hasPlayed: (id) => played.has(id),
    markPlayed: (id) => {
      played.add(id);
    },
  };
};

export type EnteringPlayDecision = {
  /** Render the entrance builder this pass. */
  play: boolean;
  /**
   * Key suffix for the animated wrapper. It changes exactly once — when a
   * deferred initial-mount entrance is released — which remounts the wrapper so
   * reanimated fires `entering` then. Reanimated only runs an entering builder
   * on mount, so a remount is the only way to start one late.
   */
  keySuffix: string;
};

/**
 * The whole `once` contract in one pure function.
 *
 * @param playedAtMount whether the latch already held this id **when the element
 *   mounted**. Sampled once per mount by the caller, never re-read: `markPlayed`
 *   is non-reactive precisely so a stray re-render cannot turn a playing
 *   animation into an already-played one.
 * @param settled whether the screen has finished its entry transition.
 *
 * Three cases:
 *   • played before        → never animate again (the revisit case)
 *   • not played, settled  → animate now (arriving at a slide later)
 *   • not played, unsettled→ hold, then animate when `settled` flips (initial
 *                            mount — deferred so the host's push transition and
 *                            image decoding don't eat it)
 */
export const decideEnteringPlay = (
  playedAtMount: boolean,
  settled: boolean
): EnteringPlayDecision => {
  const play = !playedAtMount && settled;
  return { play, keySuffix: play ? "play" : "hold" };
};
