import type { LeafCondition, ConditionGroup } from "@rocapine/react-native-onboarding";

// A `renderWhen` qualifies for UI-thread (SharedValue-driven) evaluation only when
// it depends solely on ONE numeric variable — the shape a threshold loader uses:
//   • a single leaf:            loaderProgress gte 33
//   • a one-level and/or group: loaderProgress gte 33 AND loaderProgress lt 67
// Anything else (multiple variables, nested groups, or a non-numeric operator)
// returns null and falls back to the store-backed path — for those shapes never a
// regression, just no UI-thread fast path. That is NOT true of every reason to
// return null: see `toScalar` on why a `{{ref}}` in the value is resolved here
// rather than disqualifying the plan. Non-numeric operators are excluded so the worklet
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

// A condition's right-hand side may reference another variable — `value:
// "{{threshold}}"` — which the store-backed `evaluateCondition` interpolates
// (issue #217). This fast path has to resolve the reference to the SAME number,
// because the two paths are not alternatives: `renderElement` seeds the gate's
// visibility from `evaluateCondition` and the reaction then overrides it, so an
// unresolved reference reaching `evalAnimatedNode`'s `parseFloat` below becomes
// `NaN`, every comparison turns false, and a visible element silently vanishes.
//
// Why the variable map is threaded in, rather than a reference simply
// disqualifying the plan: for THIS shape, falling back to the store path is a
// regression, not the free "no UI-thread fast path" the note at the top of the
// file describes. An autoplay `ProgressIndicator` writes its bound variable to
// the store only at the sweep BOUNDARIES (min/max — the per-step
// re-render-storm fix in `ProgressIndicatorElement.tsx`), so a mid-sweep
// threshold evaluated against the store never fires at all. `null` is right only
// when there is genuinely no number to compare against.
const REF = /\{\{([^}]+?)\}\}/g;

// Resolve every `{{name}}` against the flat variable map, or null if any one of
// them has no value yet — an unresolved reference must not silently read as the
// empty string, which `Number("")` would then turn into a plausible-looking 0.
const resolveRefs = (value: string, variables: Record<string, unknown>): string | null => {
  let unresolved = false;
  const out = value.replace(REF, (_, key: string) => {
    const resolved = variables[key.trim()];
    if (resolved === undefined || resolved === null || resolved === "") {
      unresolved = true;
      return "";
    }
    return String(resolved);
  });
  return unresolved ? null : out;
};

// Numeric-comparable scalar, or null if the value can't feed a numeric operator
// (arrays are for in/not_in — excluded; booleans coerce to 1/0). A `{{ref}}`
// resolves to a number here rather than passing a string on to the worklet's
// `parseFloat`: the check is `Number.isFinite`, so a reference to a non-numeric
// variable disqualifies the plan instead of comparing against a half-parsed
// number.
const toScalar = (
  value: LeafCondition["value"],
  variables: Record<string, unknown>
): number | string | null => {
  if (value === undefined || Array.isArray(value)) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.includes("{{")) {
    const resolved = resolveRefs(value, variables);
    if (resolved === null) return null;
    const n = Number(resolved);
    return Number.isFinite(n) ? n : null;
  }
  return value;
};

export const buildAnimatedGatePlan = (
  renderWhen: LeafCondition | ConditionGroup | undefined,
  variables: Record<string, unknown>
): AnimatedGatePlan | null => {
  if (!renderWhen) return null;

  if (!isGroup(renderWhen)) {
    if (!NUMERIC_OPERATORS.has(renderWhen.operator)) return null;
    const value = toScalar(renderWhen.value, variables);
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
    const value = toScalar(condition.value, variables);
    if (value === null) return null;
    if (variable === null) variable = condition.variable;
    else if (variable !== condition.variable) return null; // mixed variables → store path
    leaves.push({ op: condition.operator, value });
  }
  if (variable === null) return null;
  return { variable, node: { kind: "group", logic: renderWhen.logic, leaves } };
};

// The plan now depends on variable VALUES, so `GatedElement` can no longer
// memoize it on `element` alone — but it must not key on the whole variable map
// either: a fresh plan identity on every unrelated write tears down and rebuilds
// the gate's `useAnimatedReaction` mapper (see `.claude/rules/
// composable-screen-runtime.md`, "`useAnimatedReaction` needs an explicit deps
// array" — that churn destabilizes other animations running on the screen) and
// resets the reaction's `previous` to undefined each time.
//
// This is the primitive memo key in between: it changes only when a value that a
// `{{ref}}` in this condition resolves to actually changes. It is "" for a
// condition holding no reference, so the overwhelmingly common case still keys on
// `element` alone, exactly as before.
export const animatedGateRefKey = (
  renderWhen: LeafCondition | ConditionGroup | undefined,
  variables: Record<string, unknown>
): string => {
  if (!renderWhen) return "";
  const values = isGroup(renderWhen)
    ? renderWhen.conditions.map((c) => (isGroup(c) ? undefined : c.value))
    : [renderWhen.value];
  let key = "";
  for (const value of values) {
    if (typeof value !== "string" || !value.includes("{{")) continue;
    key += `${String(toScalar(value, variables))} `;
  }
  return key;
};

// Evaluate a plan node against a live numeric value. Declared as a reanimated
// worklet so the SAME function runs both on the UI thread (inside the gate's
// `useAnimatedReaction`, to detect threshold crossings) and on the JS thread
// (during render, to decide visibility from the current value) — guaranteeing the
// two never disagree.
//
// `eq`/`neq` compare the rounded value (`Math.round(p) === n`), NOT the exact
// string compare the store-backed `evaluateCondition` uses. A continuous sweep
// never lands exactly on an integer threshold mid-flight, so exact-equality would
// never fire; they agree at rest, where an autoplay bar settles precisely on an
// integer boundary. All other operators are plain numeric comparisons.
export const evalAnimatedNode = (node: AnimatedGateNode, p: number): boolean => {
  "worklet";
  const cmp = (op: Operator, raw: number | string): boolean => {
    const v = typeof raw === "string" ? parseFloat(raw) : raw;
    if (op === "gt") return p > v;
    if (op === "lt") return p < v;
    if (op === "gte") return p >= v;
    if (op === "lte") return p <= v;
    if (op === "eq") return Math.round(p) === v;
    if (op === "neq") return Math.round(p) !== v;
    return false;
  };
  if (node.kind === "leaf") return cmp(node.op, node.value);
  if (node.logic === "and") {
    for (let i = 0; i < node.leaves.length; i++) {
      if (!cmp(node.leaves[i].op, node.leaves[i].value)) return false;
    }
    return true;
  }
  for (let i = 0; i < node.leaves.length; i++) {
    if (cmp(node.leaves[i].op, node.leaves[i].value)) return true;
  }
  return false;
};
