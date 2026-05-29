import type { LeafCondition, ConditionGroup } from "./steps/common.types";

export type Condition = LeafCondition | ConditionGroup;

export function isConditionGroup(c: Condition): c is ConditionGroup {
  return "logic" in c && "conditions" in c;
}

function coerceToNumber(v: unknown): number {
  return typeof v === "string" ? parseFloat(v) : Number(v);
}

// `null`-ness: only null / undefined. A set-but-empty value (e.g. "") is NOT null.
function isNullish(v: unknown): boolean {
  return v === null || v === undefined;
}

// Type-aware emptiness: null|undefined, empty/whitespace string, or empty array.
// Numbers and booleans are never "empty" (0 / false are meaningful values).
function isEmpty(v: unknown): boolean {
  if (isNullish(v)) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function evaluateLeaf(condition: LeafCondition, variables: Record<string, unknown>): boolean {
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
      return Array.isArray(value) ? value.includes(String(raw)) : false;
    case "not_in":
      return Array.isArray(value) ? !value.includes(String(raw)) : true;
    case "is_empty":
      return isEmpty(raw);
    case "is_not_empty":
      return !isEmpty(raw);
    case "is_null":
      return isNullish(raw);
    case "is_not_null":
      return !isNullish(raw);
    default:
      return false;
  }
}

export function evaluateCondition(condition: Condition, variables: Record<string, unknown>): boolean {
  if (isConditionGroup(condition)) {
    return condition.logic === "and"
      ? condition.conditions.every((c) => evaluateCondition(c, variables))
      : condition.conditions.some((c) => evaluateCondition(c, variables));
  }
  return evaluateLeaf(condition, variables);
}
