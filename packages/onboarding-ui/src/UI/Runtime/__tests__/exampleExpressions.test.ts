import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// Deep `/dist/` import of the built payload — the same pattern
// repeatRowGating.test.ts uses to reach the headless package from the UI
// workspace. It needs `npm run build` first, and pulls no React Native code
// (the built example is a plain object literal).
import { onboardingExample } from "@rocapine/react-native-onboarding/dist/onboarding-example";
import { evaluateSetVariableExpression } from "../elements/expression";

// The shipped example payload is the studio's seed data and the artifact
// CLAUDE.md step 1 asks for, so it is the first thing an integrator copies. A
// demo expression that is CONSTANT across its whole input domain demonstrates
// nothing and would not catch `round` being swapped for `trunc` — which is
// exactly what `clamp(round({{intensity}} / 2), 1, 3)` was against a 0..1
// step-0.1 slider: 1 at all eleven positions.
//
// The replacement went one round further than "not constant". An evenly spread
// alternative (`round(1 + {{intensity}} * 2)` → 1,1,1,2,2,2,2,2,3,3,3) was
// tried and REJECTED, because it never leaves 1..3 and so `clamp` changes no
// value at all: the same defect as the constant, one function over. Hence the
// two tests below that a "spreads nicely" expression would fail — the exact
// distribution, and clamp being observably active.
//
// So rather than asserting a hand-computed number, this walks the real payload
// for both the slider that feeds the expression and the expression itself, then
// sweeps every reachable slider position through the real evaluator.

type Node = { type?: string; props?: Record<string, any>; children?: Node[] };

const walk = (nodes: Node[] | undefined, out: Node[] = []): Node[] => {
  for (const n of nodes ?? []) {
    out.push(n);
    walk(n.children, out);
  }
  return out;
};

const allElements = (): Node[] => {
  const out: Node[] = [];
  for (const step of onboardingExample.steps as any[]) {
    if (step.type === "ComposableScreen") walk(step.payload?.elements, out);
  }
  return out;
};

const findSlider = (variableName: string) =>
  allElements().find(
    (e) => e.type === "Slider" && e.props?.variableName === variableName
  );

const findSetVariable = (name: string) => {
  for (const el of allElements()) {
    for (const action of (el.props?.actions ?? []) as any[]) {
      if (action?.type === "setVariable" && action.name === name) return action;
    }
  }
  return undefined;
};

describe("example payload — the stdlib demo actually demonstrates the stdlib", () => {
  const slider = findSlider("intensity");
  const action = findSetVariable("weeklyPace");

  it("has both halves of the demo in the payload", () => {
    expect(slider).toBeDefined();
    expect(action).toBeDefined();
    expect(action!.valueMode).toBe("expression");
  });

  // Every value the Slider can write, snapped to its step grid the way
  // SliderElement's `cleanValue` snaps it.
  const positions = (): string[] => {
    const min = slider!.props!.min ?? 0;
    const max = slider!.props!.max ?? 1;
    const step = slider!.props!.step ?? 0.1;
    const decimals = (String(step).split(".")[1] ?? "").length;
    const out: string[] = [];
    for (let v = min; v <= max + step / 2; v += step) {
      out.push(String(parseFloat(v.toFixed(decimals))));
    }
    return out;
  };

  const sweep = () =>
    positions().map(
      (value) =>
        evaluateSetVariableExpression(action!.value, {
          intensity: { value, kind: "float" },
        }).value
    );

  it("sweeps the whole slider domain instead of returning one constant", () => {
    const results = sweep();
    expect(results).toHaveLength(11);
    // The defect this pins: `/ 2` produced ["1", …, "1"].
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  it("covers 1, 2 and 3, and nothing outside", () => {
    expect([...new Set(sweep())].sort()).toEqual(["1", "2", "3"]);
  });

  it("sweeps in the lower half and saturates in the upper half, as described", () => {
    // 3/2/6, and deliberately so: the comment in the payload says exactly
    // this, and the saturation is what keeps clamp observable. Pinned as an
    // exact distribution because "more than one distinct value" was too low a
    // bar to catch the constant's first replacement.
    const counts = sweep().reduce<Record<string, number>>((acc, r) => {
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ "1": 3, "2": 2, "3": 6 });
  });

  it("keeps clamp OBSERVABLE — the raw value leaves the range at both ends", () => {
    // The test that would have caught the evenly-spread replacement. Take the
    // payload's own `clamp(inner, lo, hi)` apart, evaluate `inner` across the
    // same domain, and require it to fall outside [lo, hi] at least once in
    // each direction — otherwise the demo calls clamp and clamp does nothing.
    const shape = /^clamp\((.+),\s*(-?[\d.]+),\s*(-?[\d.]+)\)$/.exec(action!.value);
    expect(
      shape,
      `the demo no longer wraps its expression in clamp(inner, lo, hi): ${action!.value}`
    ).not.toBeNull();
    const [, inner, loRaw, hiRaw] = shape!;
    const lo = Number(loRaw);
    const hi = Number(hiRaw);

    const raw = positions().map((value) =>
      Number(
        evaluateSetVariableExpression(inner, { intensity: { value, kind: "float" } }).value
      )
    );
    expect(raw.some((n) => n < lo), `nothing below the floor ${lo}: ${raw}`).toBe(true);
    expect(raw.some((n) => n > hi), `nothing above the ceiling ${hi}: ${raw}`).toBe(true);

    // And the clamped output must actually differ from the raw where it left
    // the range — proof the clamp is what changed it, not the rounding.
    const clamped = sweep().map(Number);
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] < lo || raw[i] > hi) expect(clamped[i]).not.toBe(raw[i]);
    }
  });

  it("rises monotonically with the slider", () => {
    const nums = sweep().map(Number);
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
    }
  });

  it("exercises both clamp bounds at the slider's own extremes", () => {
    const results = sweep();
    // Raw 0 at the bottom, below the floor; raw 5 at the top, above the
    // ceiling. Both come back clamped.
    expect(results[0]).toBe("1");
    expect(results[results.length - 1]).toBe("3");
  });

  it("discriminates round from trunc on exact .5 ties", () => {
    // 0.3 * 5 = 1.5 -> round 2, trunc 1. 0.5 * 5 = 2.5 -> round 3, trunc 2.
    // Real ties, which is what separates round-half-up from truncation rather
    // than merely from flooring.
    const results = sweep();
    expect(results[3]).toBe("2");
    expect(results[5]).toBe("3");
  });

  it("keeps the two shipped copies of the expression identical", () => {
    // `example/app/example/composable-screen.tsx` carries the same payload by
    // hand (CLAUDE.md step 2). Reading the file is the only way to catch the
    // two drifting apart, which is how the constant version survived review.
    const src = readFileSync(
      new URL(
        "../../../../../../example/app/example/composable-screen.tsx",
        import.meta.url
      ),
      "utf8"
    );
    expect(src).toContain(action!.value);
  });
});
