// The runs the studio-sdk check starts on its one persisted tracker.
//
// The near-budget run is left in progress on purpose, so that a kill and a
// relaunch can resume it. Started again in the same process ("Run all" a
// second time), the tracker would replace that run and report `run-replaced`,
// which the screen rightly logs as a FAIL. So every start goes through here,
// and completes the run the check itself left behind first. A run-replaced
// diagnostic therefore only ever comes from a run the check did NOT leave in
// progress, and stays a FAIL.
// No relative imports, so `node --test` can load this file as is.
import type { OnboardingRun, OnboardingRunTracker, StartOptions } from "@rocapine/studio-sdk/onboarding";

export interface CheckRuns {
  /**
   * Starts a run on `tracker`, after completing the run left by
   * `leaveInProgress`, if any. `completedLeftover` is that run's id, or null.
   */
  start(tracker: OnboardingRunTracker, options: StartOptions): { run: OnboardingRun; completedLeftover: string | null };
  /** Records that `run` stays in progress on purpose: the next `start` completes it. */
  leaveInProgress(run: OnboardingRun): void;
}

/** `onStarted` hears the id of every run started, so the summary can expect it at the collector. */
export function createCheckRuns(onStarted: (runId: string) => void = () => {}): CheckRuns {
  let leftover: OnboardingRun | null = null;
  return {
    start(tracker, options) {
      let completedLeftover: string | null = null;
      if (leftover) {
        leftover.complete();
        completedLeftover = leftover.runId;
        leftover = null;
      }
      const run = tracker.start(options);
      onStarted(run.runId);
      return { run, completedLeftover };
    },
    leaveInProgress(run) {
      leftover = run;
    },
  };
}

/** How the screen logs a tracker diagnostic: truncation is INFO (null), anything else is a FAIL (false). */
export function diagnosticVerdict(code: string): boolean | null {
  return code === "truncated" ? null : false;
}
