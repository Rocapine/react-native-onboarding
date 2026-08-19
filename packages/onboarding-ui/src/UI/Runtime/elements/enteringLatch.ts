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

/**
 * The three states an element with `once` can be in. They must be THREE, not two.
 *
 * The first version of this returned `{ play: boolean }`, and the consumer mapped
 * both `false` cases to "render without an entrance". But "already played" and
 * "not settled yet" are opposites: the first must render VISIBLE, the second must
 * render HIDDEN. Collapsing them made a held element render at full opacity, so
 * the entrance was never seen, and then blink to opacity 0 and re-fade when the
 * hold released — defeating the entrance and adding a flash that did not exist
 * before `once`. A table test over the old boolean passed, because the decision
 * table was right; the return type simply could not express the difference.
 */
export type EnteringPhase =
  /** Not played, screen still arriving — hidden, no entrance. */
  | "hold"
  /** Not played, screen settled — render the entrance now. */
  | "play"
  /** Already played on this screen — visible, no entrance. */
  | "done";

export type EnteringPlayDecision = {
  phase: EnteringPhase;
  /** Attach the entering builder this pass. */
  playEntering: boolean;
  /**
   * Render the element invisible. True ONLY during `hold` — this is the field
   * whose absence caused the bug, and the one distinguishing `hold` from `done`
   * in the output rather than merely in intent.
   */
  hidden: boolean;
  /**
   * Key suffix for the animated wrapper. Changes exactly once, `hold` → `play`,
   * which remounts the wrapper so reanimated fires `entering` then — it only
   * ever runs an entering builder on mount, so a remount is the only way to
   * start one late.
   */
  keySuffix: EnteringPhase;
};

/**
 * The whole `once` contract in one pure function.
 *
 * @param playedAtMount whether the latch already held this id **when the element
 *   mounted**. Sampled once per mount by the caller, never re-read: `markPlayed`
 *   is non-reactive precisely so a stray re-render cannot turn a playing
 *   animation into an already-played one.
 * @param settled whether the screen has finished its entry transition.
 */
export const decideEnteringPlay = (
  playedAtMount: boolean,
  settled: boolean
): EnteringPlayDecision => {
  const phase: EnteringPhase = playedAtMount ? "done" : settled ? "play" : "hold";
  return {
    phase,
    playEntering: phase === "play",
    hidden: phase === "hold",
    keySuffix: phase,
  };
};
