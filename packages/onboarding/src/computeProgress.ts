import type { ProgressMode } from "./steps/common.types";

/** Minimal step shape the progress math reads. */
export type ProgressStep = {
  progressMode?: ProgressMode;
  displayProgressHeader?: boolean;
};

/**
 * Progress-bar position for the active step, honoring per-step `progressMode`.
 *
 * Back-compat: when NO step declares `progressMode` (all absent), every step is
 * "counted" and this returns exactly today's index-based fraction
 * (`100 * number / steps.length`). `interstitial`/`excluded` steps are dropped
 * from both the denominator and the active position so the bar advances evenly
 * across the counted steps only.
 *
 * @param activeNumber 1-based position of the active step (as `activeStep.number`).
 * @param steps        Full ordered steps array.
 *
 * This is the single source of truth for the runtime fraction; studio mirrors
 * the same formula for its preview (keep them in sync).
 */
export function computeProgress(
  activeNumber: number,
  steps: ProgressStep[]
): { percentage: number; visible: boolean } {
  const isCounted = (s: ProgressStep) =>
    s.progressMode == null || s.progressMode === "counted";

  const totalCounted = steps.reduce((n, s) => (isCounted(s) ? n + 1 : n), 0);
  if (totalCounted === 0) return { percentage: 0, visible: false };

  // activeNumber is 1-based; clamp to a valid index for safety.
  const activeIndex = Math.min(Math.max(activeNumber - 1, 0), steps.length - 1);
  const current = steps[activeIndex];

  // Count counted steps strictly before the active step, then include the
  // active step itself only when it is counted. A non-counted active step
  // freezes the bar at the surrounding counted position.
  let countedUpTo = 0;
  for (let i = 0; i < activeIndex; i++) {
    if (isCounted(steps[i])) countedUpTo += 1;
  }
  if (current && isCounted(current)) countedUpTo += 1;

  const percentage = Math.round((100 * countedUpTo) / totalCounted);

  // `excluded` hides the bar entirely; otherwise honor the per-step header flag.
  const visible =
    current?.progressMode === "excluded"
      ? false
      : (current?.displayProgressHeader ?? false);

  return { percentage, visible };
}
