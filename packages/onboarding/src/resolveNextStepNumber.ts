import type { BaseStepType } from "./types";
import { evaluateCondition } from "./evaluateCondition";

/**
 * Resolves the 1-indexed step number to navigate to after the current step.
 * Returns null when the onboarding should end (no next step exists).
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
      const idx = steps.findIndex((s) => s.id === branch.targetStepId);
      if (idx !== -1) return idx + 1;
    }
  }

  if (nextStep.defaultTargetStepId !== currentStep.id) {
    const defaultIdx = steps.findIndex((s) => s.id === nextStep.defaultTargetStepId);
    if (defaultIdx !== -1) return defaultIdx + 1;
  }

  return linearNext();
}
