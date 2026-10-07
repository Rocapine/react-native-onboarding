// A run filled to just under studio-sdk's RECORDING_BUDGET (261,120 bytes),
// to check that a snapshot that large survives AsyncStorage and a relaunch.
// No relative imports, so `node --test` can load this file as is.
import {
  createOnboardingRunTracker,
  type OnboardingRun,
  type RunContextInput,
  type StartOptions,
} from "@rocapine/studio-sdk/onboarding";

/** The tracker's per-entry cap on answers. */
const ANSWERS_PER_STEP = 50;
/** A text answer's cap: the largest unit of growth the contract allows. */
const ANSWER_TEXT = "x".repeat(1000);
const STEP_KEYS = Array.from({ length: 10 }, (_, i) => `big_${String(i + 1).padStart(2, "0")}`);

export const BIG_RUN_START: StartOptions = {
  onboarding: { key: "studio_sdk_check_big", version: "1" },
  manifest: { steps: STEP_KEYS.map((stepKey) => ({ stepKey })) },
};

/**
 * Records up to `count` text answers of 1,000 characters, 50 per screen,
 * entering a new screen every 50. Each answer goes in its own `exitStep`, so
 * recording stops at exactly the answer that would break the budget. Stops
 * early once `stop()` is true after an answer, and returns how many answers
 * were recorded before that one.
 */
export function fillAnswers(run: OnboardingRun, count: number, stop: () => boolean = () => false): number {
  const max = Math.min(count, STEP_KEYS.length * ANSWERS_PER_STEP);
  for (let i = 0; i < max; i++) {
    const step = STEP_KEYS[Math.floor(i / ANSWERS_PER_STEP)];
    if (i % ANSWERS_PER_STEP === 0) run.enterStep(step);
    run.exitStep(step, { answers: [{ questionKey: `q_${i}`, kind: "text", value: ANSWER_TEXT }] });
    if (stop()) return i;
  }
  return max;
}

/**
 * How many answers fit before the tracker truncates, measured with a
 * throwaway tracker (no storage, a sink that sends nowhere) on the same
 * context, since the context is part of the measured size. Filling one fewer
 * leaves room for the few bytes a different `seq` can add.
 */
export function measureCapacity(context: RunContextInput): number {
  let truncated = false;
  const probe = createOnboardingRunTracker({
    sink: { send: () => ({ outcome: "accepted" }) },
    context,
    storageKey: "example:studio-sdk-check:capacity-probe",
    debounceMs: 60_000,
    onDiagnostic: (d) => {
      if (d.code === "truncated") truncated = true;
    },
  });
  const fitted = fillAnswers(probe.start(BIG_RUN_START), Infinity, () => truncated);
  probe.dispose();
  return fitted;
}
