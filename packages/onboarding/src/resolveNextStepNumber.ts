import type { BaseStepType } from "./types";
import type { LeafCondition, ConditionGroup } from "./steps/common.types";

type Condition = LeafCondition | ConditionGroup;

function isConditionGroup(c: Condition): c is ConditionGroup {
  return "logic" in c && "conditions" in c;
}

function coerceToNumber(v: unknown): number {
  return typeof v === "string" ? parseFloat(v) : Number(v);
}

function evaluateLeaf(condition: LeafCondition, variables: Record<string, any>): boolean {
  const raw = variables[condition.variable];
  const { operator, value } = condition;

  switch (operator) {
    case "eq":
      return String(raw) === String(value);
    case "neq":
      return String(raw) !== String(value);
    case "gt":
      return coerceToNumber(raw) > coerceToNumber(value);
    case "lt":
      return coerceToNumber(raw) < coerceToNumber(value);
    case "gte":
      return coerceToNumber(raw) >= coerceToNumber(value);
    case "lte":
      return coerceToNumber(raw) <= coerceToNumber(value);
    case "contains":
      return Array.isArray(raw)
        ? raw.includes(value)
        : String(raw).includes(String(value));
    case "in":
      return Array.isArray(value) ? value.includes(raw) : false;
    case "not_in":
      return Array.isArray(value) ? !value.includes(raw) : true;
    default:
      return false;
  }
}

function evaluateCondition(condition: Condition, variables: Record<string, any>): boolean {
  if (isConditionGroup(condition)) {
    return condition.logic === "and"
      ? condition.conditions.every((c) => evaluateCondition(c, variables))
      : condition.conditions.some((c) => evaluateCondition(c, variables));
  }
  return evaluateLeaf(condition, variables);
}

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
    if (branch.condition === null || evaluateCondition(branch.condition, variables)) {
      const idx = steps.findIndex((s) => s.id === branch.targetStepId);
      if (idx !== -1) return idx + 1;
    }
  }

  const defaultIdx = steps.findIndex((s) => s.id === nextStep.defaultTargetStepId);
  if (defaultIdx !== -1) return defaultIdx + 1;

  return linearNext();
}
