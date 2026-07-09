import type { LeafCondition, ConditionGroup } from "@rocapine/react-native-onboarding";

// A `renderWhen` qualifies for UI-thread (SharedValue-driven) evaluation only when
// it depends solely on ONE numeric variable — the shape a threshold loader uses:
//   • a single leaf:            loaderProgress gte 33
//   • a one-level and/or group: loaderProgress gte 33 AND loaderProgress lt 67
// Anything else (multiple variables, nested groups, or a non-numeric operator)
// returns null and falls back to the store-backed path — never a regression, just
// no UI-thread fast path. Non-numeric operators are excluded so the worklet
// evaluator only ever does numeric comparisons (no array/JSON decoding on the UI
// thread); an animated variable is always a numeric sweep, so this loses nothing.

type Operator = LeafCondition["operator"];

const NUMERIC_OPERATORS = new Set<Operator>(["gt", "lt", "gte", "lte", "eq", "neq"]);

export type AnimatedGateLeaf = { op: Operator; value: number | string };

export type AnimatedGateNode =
  | { kind: "leaf"; op: Operator; value: number | string }
  | { kind: "group"; logic: "and" | "or"; leaves: AnimatedGateLeaf[] };

export type AnimatedGatePlan = {
  /** The single numeric variable this condition depends on. */
  variable: string;
  /** Serializable condition, safe to evaluate inside a reanimated worklet. */
  node: AnimatedGateNode;
};

const isGroup = (c: LeafCondition | ConditionGroup): c is ConditionGroup =>
  "logic" in c && "conditions" in c;

// Numeric-comparable scalar, or null if the value can't feed a numeric operator
// (arrays are for in/not_in — excluded; booleans coerce to 1/0).
const toScalar = (value: LeafCondition["value"]): number | string | null => {
  if (value === undefined || Array.isArray(value)) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
};

export const buildAnimatedGatePlan = (
  renderWhen: LeafCondition | ConditionGroup | undefined
): AnimatedGatePlan | null => {
  if (!renderWhen) return null;

  if (!isGroup(renderWhen)) {
    if (!NUMERIC_OPERATORS.has(renderWhen.operator)) return null;
    const value = toScalar(renderWhen.value);
    if (value === null) return null;
    return {
      variable: renderWhen.variable,
      node: { kind: "leaf", op: renderWhen.operator, value },
    };
  }

  if (renderWhen.conditions.length === 0) return null;
  let variable: string | null = null;
  const leaves: AnimatedGateLeaf[] = [];
  for (const condition of renderWhen.conditions) {
    if (isGroup(condition)) return null; // nested group → store path
    if (!NUMERIC_OPERATORS.has(condition.operator)) return null;
    const value = toScalar(condition.value);
    if (value === null) return null;
    if (variable === null) variable = condition.variable;
    else if (variable !== condition.variable) return null; // mixed variables → store path
    leaves.push({ op: condition.operator, value });
  }
  if (variable === null) return null;
  return { variable, node: { kind: "group", logic: renderWhen.logic, leaves } };
};
