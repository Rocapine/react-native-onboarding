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

// The membership operators (`in` / `not_in`, and `contains` against an array
// variable) need a real list and used to answer a CONSTANT without one —
// `in` false for every row, `not_in` true for every row, no warning (#225).
//
// Two right-hand-side shapes reach them without being `Array.isArray`, and both
// are the natural way to author a membership test now that a `{{ref}}` on the
// right-hand side resolves (#217):
//
//   value: "{{selected}}"    a reference to a multi-select variable, whose flat
//                            value is a JSON-encoded string ('["a","b"]' — see
//                            `decodeArrayValue`), so the ref interpolates to a
//                            string and `Array.isArray` is false.
//   value: ["{{selected}}"]  what Studio's condition editor emits: it splits the
//                            value field on commas, so the reference lands as
//                            the single member of a one-member array. That one
//                            IS an array, and used to reach the comparison as a
//                            list holding one JSON string — equally constant.
//
// So a member list is built by decoding the value itself AND each of its
// members, flattening one level. Only one level: nothing authorable nests
// deeper, and a deep flatten would silently merge a shape nobody wrote.
//
// `value: []` keeps its documented constants (`in` false / `not_in` true) — an
// empty Studio value field yields it, and an empty list legitimately has no
// members. So does a reference that resolves to nothing: an unresolved `{{ref}}`
// interpolates to the empty string (see `interpolateRefs`), and "not written
// yet" means "no members", not "a member that is the empty string".
//
// Anything else scalar (`in` against `"male"`) is an authoring mistake with no
// correct answer. It reads as a ONE-member list — the only reading that is not a
// silent constant, and what `in: "male"` plainly means — and warns, because the
// evaluator returns `boolean` and `renderWhen` has no third state, so a warning
// is the loudest a runtime can be. No Studio-authored payload can produce this
// shape (its editor always emits an array), so nothing that evaluates correctly
// today changes.
function toMemberList(value: unknown, operator: string): unknown[] {
  const decoded = decodeArrayValue(value);
  if (Array.isArray(decoded)) {
    return decoded.flatMap((member) => {
      const inner = decodeArrayValue(member);
      return Array.isArray(inner) ? inner : [inner];
    });
  }
  if (isNullish(decoded) || (typeof decoded === "string" && decoded === "")) return [];
  console.warn(
    `[onboarding] condition operator "${operator}" needs a list on its right-hand side, ` +
      `got ${typeof decoded} ${JSON.stringify(decoded)}. Treating it as a single-member list. ` +
      `Author an array (or a {{ref}} to a multi-select variable) instead.`
  );
  return [decoded];
}

// Members compare stringified. A decoded JSON array keeps its members typed, and
// `Repeat` keeps a numeric row field numeric on purpose (`repeatScope.buildRowFlat`,
// so `gt` compares numerically), so `1` and `"1"` have to be the same member —
// otherwise `not_in(1, [1, 2])` is true. Shared with the `contains` array branch,
// which coerced neither side, so the two operators would otherwise disagree about
// the same data.
function includesMember(members: unknown[], target: unknown): boolean {
  const needle = String(target);
  return members.some((member) => String(member) === needle);
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
        ? includesMember(raw, value)
        : String(raw).includes(String(value));
    case "in":
      return includesMember(toMemberList(value, operator), raw);
    case "not_in":
      return !includesMember(toMemberList(value, operator), raw);
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
