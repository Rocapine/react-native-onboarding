import type { LeafCondition, ConditionGroup } from "./steps/common.types";

export type Condition = LeafCondition | ConditionGroup;

export function isConditionGroup(c: Condition): c is ConditionGroup {
  return "logic" in c && "conditions" in c;
}

function coerceToNumber(v: unknown): number {
  return typeof v === "string" ? parseFloat(v) : Number(v);
}

// Multi-select elements (e.g. CheckboxGroup) store their value as a JSON-encoded
// string[] to fit the string-based variable system, so an empty selection is the
// literal string "[]". Decode such strings back to an array before evaluating so
// array-aware operators (is_empty / is_not_empty / contains / in / not_in) see the
// real collection — otherwise "[]" reads as a non-empty 2-char string. Only strings
// that parse to an actual array are coerced; scalars and plain text are untouched.
function decodeArrayValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!(trimmed.startsWith("[") && trimmed.endsWith("]"))) return raw;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : raw;
  } catch {
    return raw;
  }
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

// A condition's right-hand side may reference other variables with `{{name}}`,
// which is what lets a condition compare two variables instead of a variable
// against an authored literal. `RepeatElement` documents exactly this shape to
// make `Repeat` subsume a `Match` — `{ variable: "item.sign", operator: "eq",
// value: "{{zodiacSign}}" }` — and without interpolation here that comparison
// tests against the 14-character literal and never matches.
//
// References resolve to the variable's raw value stringified, matching
// `Image mode:"expression"` (machine identifiers, not display labels); the map
// reaching this function is already flat primitives. An unknown reference
// resolves to the empty string rather than throwing, so a gate on a variable
// that has not been written yet simply does not match.
const REF = /\{\{([^}]+?)\}\}/g;

function interpolateRefs(value: unknown, variables: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((v) => interpolateRefs(v, variables));
  if (typeof value !== "string" || !value.includes("{{")) return value;
  return value.replace(REF, (_, key: string) => {
    const resolved = variables[key.trim()];
    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}

export function evaluateLeaf(condition: LeafCondition, variables: Record<string, unknown>): boolean {
  const raw = decodeArrayValue(variables[condition.variable]);
  const { operator } = condition;
  const value = interpolateRefs(condition.value, variables) as typeof condition.value;

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
