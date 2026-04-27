import { describe, it, expect } from "vitest";
import { resolveNextStepNumber } from "../resolveNextStepNumber";
import type { BaseStepType } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(id: string, overrides: Partial<BaseStepType> = {}): BaseStepType {
  return {
    id,
    type: "Question",
    name: id,
    displayProgressHeader: true,
    nextStep: null,
    ...overrides,
  } as BaseStepType;
}

const steps = [
  makeStep("s1"),
  makeStep("s2"),
  makeStep("s3"),
  makeStep("s4"),
];

// ---------------------------------------------------------------------------
// Linear progression (nextStep = null)
// ---------------------------------------------------------------------------

describe("linear progression", () => {
  it("returns 2 from step 1", () => expect(resolveNextStepNumber(steps[0], {}, steps)).toBe(2));
  it("returns 3 from step 2", () => expect(resolveNextStepNumber(steps[1], {}, steps)).toBe(3));
  it("returns null from last step", () => expect(resolveNextStepNumber(steps[3], {}, steps)).toBe(null));
  it("returns null when step not found in array", () => {
    const orphan = makeStep("orphan");
    expect(resolveNextStepNumber(orphan, {}, steps)).toBe(null);
  });
  it("returns null for single-step array", () => {
    const single = [makeStep("only")];
    expect(resolveNextStepNumber(single[0], {}, single)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Branching — condition match
// ---------------------------------------------------------------------------

describe("branch — first matching branch wins", () => {
  it("routes to targetStepId of first matching branch", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          { condition: { variable: "gender", operator: "eq", value: "female" }, targetStepId: "s4" },
          { condition: { variable: "gender", operator: "eq", value: "male" }, targetStepId: "s3" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, { gender: "male" }, steps)).toBe(3);
  });

  it("first branch wins even if second also matches", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          { condition: { variable: "age", operator: "gt", value: 10 }, targetStepId: "s3" },
          { condition: { variable: "age", operator: "gt", value: 5 }, targetStepId: "s4" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, { age: 20 }, steps)).toBe(3);
  });

  it("skips non-matching branch, takes second", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          { condition: { variable: "gender", operator: "eq", value: "female" }, targetStepId: "s4" },
          { condition: { variable: "gender", operator: "eq", value: "male" }, targetStepId: "s3" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, { gender: "female" }, steps)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Branching — unconditional branch (null condition)
// ---------------------------------------------------------------------------

describe("branch — null condition (unconditional)", () => {
  it("always matches null condition", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          { condition: null, targetStepId: "s4" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, {}, steps)).toBe(4);
  });

  it("null condition after a non-matching branch acts as catch-all", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          { condition: { variable: "age", operator: "gt", value: 100 }, targetStepId: "s3" },
          { condition: null, targetStepId: "s4" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, { age: 25 }, steps)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Branching — defaultTargetStepId fallback
// ---------------------------------------------------------------------------

describe("branch — defaultTargetStepId fallback", () => {
  it("uses defaultTargetStepId when no branch matches", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s3",
        branches: [
          { condition: { variable: "x", operator: "eq", value: "never" }, targetStepId: "s4" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, { x: "something_else" }, steps)).toBe(3);
  });

  it("defaultTargetStepId with empty branches array still resolves", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s4",
        branches: [],
      },
    });
    expect(resolveNextStepNumber(step, {}, steps)).toBe(4);
  });

  it("falls back to linear when defaultTargetStepId not in steps", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "does-not-exist",
        branches: [],
      },
    });
    expect(resolveNextStepNumber(step, {}, steps)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Branching — branch targetStepId not found
// ---------------------------------------------------------------------------

describe("branch — targetStepId not found", () => {
  it("skips branch with unknown targetStepId, tries next branch", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          { condition: { variable: "x", operator: "eq", value: "y" }, targetStepId: "ghost" },
          { condition: { variable: "x", operator: "eq", value: "y" }, targetStepId: "s3" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, { x: "y" }, steps)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Branching — compound conditions in branches
// ---------------------------------------------------------------------------

describe("branch — compound conditions", () => {
  it("AND group in branch condition", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          {
            condition: {
              logic: "and",
              conditions: [
                { variable: "age", operator: "gte", value: 18 },
                { variable: "gender", operator: "eq", value: "female" },
              ],
            },
            targetStepId: "s4",
          },
        ],
      },
    });

    expect(resolveNextStepNumber(step, { age: 25, gender: "female" }, steps)).toBe(4);
    expect(resolveNextStepNumber(step, { age: 15, gender: "female" }, steps)).toBe(2);
    expect(resolveNextStepNumber(step, { age: 25, gender: "male" }, steps)).toBe(2);
  });

  it("OR group in branch condition", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s2",
        branches: [
          {
            condition: {
              logic: "or",
              conditions: [
                { variable: "vip", operator: "eq", value: "true" },
                { variable: "age", operator: "lt", value: 13 },
              ],
            },
            targetStepId: "s3",
          },
        ],
      },
    });

    expect(resolveNextStepNumber(step, { vip: "true", age: 25 }, steps)).toBe(3);
    expect(resolveNextStepNumber(step, { vip: "false", age: 10 }, steps)).toBe(3);
    expect(resolveNextStepNumber(step, { vip: "false", age: 20 }, steps)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("empty steps array returns null", () => {
    expect(resolveNextStepNumber(makeStep("s1"), {}, [])).toBe(null);
  });

  it("empty variables object, no branch matches → linear", () => {
    const step = makeStep("s1", {
      nextStep: {
        defaultTargetStepId: "s3",
        branches: [
          { condition: { variable: "gender", operator: "eq", value: "male" }, targetStepId: "s4" },
        ],
      },
    });
    expect(resolveNextStepNumber(step, {}, [step, makeStep("s2"), makeStep("s3"), makeStep("s4")])).toBe(3);
  });

  it("steps array with one element and current step last returns null", () => {
    const s = makeStep("only");
    expect(resolveNextStepNumber(s, {}, [s])).toBe(null);
  });
});
