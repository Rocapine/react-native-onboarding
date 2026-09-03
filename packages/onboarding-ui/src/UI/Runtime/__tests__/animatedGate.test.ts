import { describe, it, expect } from "vitest";
import {
  animatedGateRefKey,
  buildAnimatedGatePlan,
  evalAnimatedNode,
} from "../elements/animatedGate";
import type { LeafCondition, ConditionGroup } from "@rocapine/react-native-onboarding";

// A `renderWhen` may reference another variable on its right-hand side
// (`value: "{{threshold}}"`) — see issue #217. The store-backed evaluator
// interpolates those references, so this UI-thread fast path must resolve them to
// the same number or the two paths disagree: `renderElement.tsx` seeds visibility
// from `evaluateCondition` and then the reaction flips it from a `parseFloat`
// of the literal `"{{threshold}}"`, i.e. `NaN`, i.e. never visible.

const leaf = (value: LeafCondition["value"]): LeafCondition => ({
  variable: "loaderProgress",
  operator: "gte",
  value,
});

describe("buildAnimatedGatePlan — `{{ref}}` in a leaf value", () => {
  it("resolves a reference to the referenced variable's number", () => {
    const plan = buildAnimatedGatePlan(leaf("{{threshold}}"), { threshold: 50 });
    expect(plan).toEqual({
      variable: "loaderProgress",
      node: { kind: "leaf", op: "gte", value: 50 },
    });
  });

  it("gates on the resolved threshold, not on NaN", () => {
    const plan = buildAnimatedGatePlan(leaf("{{threshold}}"), { threshold: 50 });
    expect(evalAnimatedNode(plan!.node, 60)).toBe(true);
    expect(evalAnimatedNode(plan!.node, 40)).toBe(false);
  });

  it("resolves a reference held as a string, as the variable store holds it", () => {
    const plan = buildAnimatedGatePlan(leaf("{{threshold}}"), { threshold: "33" });
    expect(plan!.node).toEqual({ kind: "leaf", op: "gte", value: 33 });
  });

  it("falls back to the store path when the reference is unresolved", () =>
    expect(buildAnimatedGatePlan(leaf("{{threshold}}"), {})).toBeNull());

  it("falls back to the store path when the reference is not numeric", () =>
    expect(buildAnimatedGatePlan(leaf("{{sign}}"), { sign: "aries" })).toBeNull());
});

// `toScalar` is called from BOTH branches of `buildAnimatedGatePlan` — the single
// leaf and the one-level and/or group a threshold loader uses. The group form is
// the one that expresses a band (`gte lo AND lt hi`), so fixing only the leaf
// leaves the more common authoring shape broken.

const group = (...values: LeafCondition["value"][]): ConditionGroup => ({
  logic: "and",
  conditions: values.map((value, i) => ({
    variable: "loaderProgress",
    operator: i === 0 ? "gte" : "lt",
    value,
  })),
});

describe("buildAnimatedGatePlan — `{{ref}}` inside an and/or group", () => {
  it("resolves every leaf's reference", () => {
    const plan = buildAnimatedGatePlan(group("{{lo}}", "{{hi}}"), { lo: 33, hi: 67 });
    expect(plan).toEqual({
      variable: "loaderProgress",
      node: {
        kind: "group",
        logic: "and",
        leaves: [
          { op: "gte", value: 33 },
          { op: "lt", value: 67 },
        ],
      },
    });
  });

  it("gates on the resolved band", () => {
    const plan = buildAnimatedGatePlan(group("{{lo}}", "{{hi}}"), { lo: 33, hi: 67 });
    expect(evalAnimatedNode(plan!.node, 50)).toBe(true);
    expect(evalAnimatedNode(plan!.node, 20)).toBe(false);
    expect(evalAnimatedNode(plan!.node, 80)).toBe(false);
  });

  it("falls back to the store path when any one leaf's reference is unresolved", () =>
    expect(buildAnimatedGatePlan(group("{{lo}}", "{{hi}}"), { lo: 33 })).toBeNull());

  it("mixes a reference and an authored literal", () => {
    const plan = buildAnimatedGatePlan(group("{{lo}}", 67), { lo: 33 });
    expect(plan!.node).toEqual({
      kind: "group",
      logic: "and",
      leaves: [
        { op: "gte", value: 33 },
        { op: "lt", value: 67 },
      ],
    });
  });
});

// Regression guards for the shapes that already worked: threading the variable
// map through `toScalar` must not disturb authored literals.

describe("buildAnimatedGatePlan — authored literals are untouched", () => {
  it("keeps a numeric literal", () =>
    expect(buildAnimatedGatePlan(leaf(33), {})!.node).toEqual({
      kind: "leaf",
      op: "gte",
      value: 33,
    }));

  it("keeps a literal string with no reference syntax", () =>
    expect(buildAnimatedGatePlan(leaf("33"), {})!.node).toEqual({
      kind: "leaf",
      op: "gte",
      value: "33",
    }));

  it("coerces a boolean literal to 1/0", () =>
    expect(buildAnimatedGatePlan(leaf(true), {})!.node).toEqual({
      kind: "leaf",
      op: "gte",
      value: 1,
    }));

  it("rejects an array value (in/not_in is not a numeric operator)", () =>
    expect(buildAnimatedGatePlan(leaf(["a", "b"]), {})).toBeNull());

  // Issue #225 changed how the store-backed evaluator reads a membership
  // right-hand side that is not literally an array — a `{{ref}}` to a
  // multi-select variable, or the one-member array Studio's condition editor
  // emits. `renderElement` SEEDS a gate from `evaluateCondition` and then lets
  // the worklet reaction override it, so if either of those shapes could build
  // a plan the two paths would disagree and the element would flicker to the
  // wrong visibility. Neither may: `in` / `not_in` are not numeric operators.
  it("rejects `in` with a reference to a multi-select variable", () =>
    expect(
      buildAnimatedGatePlan(
        { variable: "item.value", operator: "in", value: "{{selected}}" },
        { selected: '["sleep","energy"]', "item.value": "sleep" }
      )
    ).toBeNull());

  it("rejects `not_in` with the array-wrapped shape Studio emits", () =>
    expect(
      buildAnimatedGatePlan(
        { variable: "item.value", operator: "not_in", value: ["{{selected}}"] },
        { selected: '["sleep","energy"]', "item.value": "focus" }
      )
    ).toBeNull());

  it("rejects a non-numeric operator", () =>
    expect(
      buildAnimatedGatePlan({ variable: "x", operator: "contains", value: 1 }, {})
    ).toBeNull());
});

// Now that a plan depends on variable VALUES, `GatedElement` can no longer
// memoize it on `element` alone. It must not key on the whole variable map
// either — a fresh plan identity on every unrelated write rebuilds the gate's
// `useAnimatedReaction` mapper, which is the churn `.claude/rules/
// composable-screen-runtime.md` warns destabilizes other animations. So the key
// has to be stable across writes that the condition does not reference.

describe("animatedGateRefKey", () => {
  it("is empty for a condition holding no reference, so the memo keys on the element alone", () =>
    expect(animatedGateRefKey(leaf(33), { anything: 1 })).toBe(""));

  it("is empty when there is no condition at all", () =>
    expect(animatedGateRefKey(undefined, { anything: 1 })).toBe(""));

  it("is stable when a variable the condition does not reference changes", () => {
    const before = animatedGateRefKey(leaf("{{threshold}}"), { threshold: 50, other: "a" });
    const after = animatedGateRefKey(leaf("{{threshold}}"), { threshold: 50, other: "b" });
    expect(after).toBe(before);
  });

  it("changes when a referenced variable changes", () => {
    const before = animatedGateRefKey(leaf("{{threshold}}"), { threshold: 50 });
    const after = animatedGateRefKey(leaf("{{threshold}}"), { threshold: 67 });
    expect(after).not.toBe(before);
  });

  it("changes when a referenced variable becomes resolvable", () => {
    const before = animatedGateRefKey(leaf("{{threshold}}"), {});
    const after = animatedGateRefKey(leaf("{{threshold}}"), { threshold: 50 });
    expect(after).not.toBe(before);
  });

  it("tracks every leaf of a group independently", () => {
    const key = (vars: Record<string, unknown>) => animatedGateRefKey(group("{{lo}}", "{{hi}}"), vars);
    expect(key({ lo: 33, hi: 67 })).toBe(key({ lo: 33, hi: 67 }));
    expect(key({ lo: 33, hi: 67 })).not.toBe(key({ lo: 33, hi: 80 }));
    expect(key({ lo: 33, hi: 67 })).not.toBe(key({ lo: 20, hi: 67 }));
  });

  it("does not confuse two leaves whose resolved values swap", () => {
    const key = (vars: Record<string, unknown>) => animatedGateRefKey(group("{{lo}}", "{{hi}}"), vars);
    expect(key({ lo: 33, hi: 67 })).not.toBe(key({ lo: 67, hi: 33 }));
  });
});
