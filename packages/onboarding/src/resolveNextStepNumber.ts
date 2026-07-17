import type { BaseStepType } from "./types";
import { evaluateCondition } from "./evaluateCondition";
import { ONBOARDING_END_STEP_ID } from "./steps/common.types";

/**
 * Resolves the 1-indexed step number to navigate to after the current step.
 * Returns null when the onboarding should end — either the branching pattern
 * resolved to the reserved end sentinel (`ONBOARDING_END_STEP_ID`) or there is
 * no next step (last step / no valid target).
 *
 * @param currentStep - The step that just completed
 * @param variables   - Global variable store (build a merged copy before calling if you just set a variable)
 * @param steps       - Full ordered steps array
 */
export function resolveNextStepNumber(
  currentStep: BaseStepType,
  variables: Record<string, any>,
  steps: BaseStepType[]
): number | null {
  const linearNext = (): number | null => {
    const idx = steps.findIndex((s) => s.id === currentStep.id);
    if (idx === -1 || idx + 1 >= steps.length) return null;
    return idx + 2;
  };

  const { nextStep } = currentStep;

  if (nextStep == null) return linearNext();

  for (const branch of nextStep.branches) {
    if (branch.targetStepId === currentStep.id) continue;
    if (branch.condition === null || evaluateCondition(branch.condition, variables)) {
      // A matching branch that targets the end sentinel ends the onboarding.
      if (branch.targetStepId === ONBOARDING_END_STEP_ID) return null;
      const idx = steps.findIndex((s) => s.id === branch.targetStepId);
      if (idx !== -1) return idx + 1;
    }
  }

  // Default target ends the onboarding when it is the end sentinel.
  if (nextStep.defaultTargetStepId === ONBOARDING_END_STEP_ID) return null;

  if (nextStep.defaultTargetStepId !== currentStep.id) {
    const defaultIdx = steps.findIndex((s) => s.id === nextStep.defaultTargetStepId);
    if (defaultIdx !== -1) return defaultIdx + 1;
  }

  return linearNext();
}
