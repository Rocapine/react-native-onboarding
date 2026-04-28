import { describe, it, expect } from "vitest";
import { evaluateLeaf, evaluateCondition } from "../evaluateCondition";
import type { Condition } from "../evaluateCondition";

// ---------------------------------------------------------------------------
// evaluateLeaf — operator coverage
// ---------------------------------------------------------------------------

describe("evaluateLeaf — eq", () => {
  it("matches equal strings", () => expect(evaluateLeaf({ variable: "x", operator: "eq", value: "male" }, { x: "male" })).toBe(true));
  it("rejects unequal strings", () => expect(evaluateLeaf({ variable: "x", operator: "eq", value: "male" }, { x: "female" })).toBe(false));
  it("coerces number to string for comparison", () => expect(evaluateLeaf({ variable: "x", operator: "eq", value: "42" }, { x: 42 })).toBe(true));
  it("undefined variable yields false", () => expect(evaluateLeaf({ variable: "x", operator: "eq", value: "foo" }, {})).toBe(false));
});

describe("evaluateLeaf — neq", () => {
  it("passes when values differ", () => expect(evaluateLeaf({ variable: "x", operator: "neq", value: "male" }, { x: "female" })).toBe(true));
  it("fails when values equal", () => expect(evaluateLeaf({ variable: "x", operator: "neq", value: "male" }, { x: "male" })).toBe(false));
});

describe("evaluateLeaf — gt", () => {
  it("passes when variable greater", () => expect(evaluateLeaf({ variable: "age", operator: "gt", value: 18 }, { age: 25 })).toBe(true));
  it("fails when equal", () => expect(evaluateLeaf({ variable: "age", operator: "gt", value: 18 }, { age: 18 })).toBe(false));
  it("fails when less", () => expect(evaluateLeaf({ variable: "age", operator: "gt", value: 18 }, { age: 10 })).toBe(false));
  it("coerces string variable", () => expect(evaluateLeaf({ variable: "age", operator: "gt", value: 18 }, { age: "25" })).toBe(true));
  it("coerces string value", () => expect(evaluateLeaf({ variable: "age", operator: "gt", value: "18" }, { age: 25 })).toBe(true));
});

describe("evaluateLeaf — lt", () => {
  it("passes when variable less", () => expect(evaluateLeaf({ variable: "age", operator: "lt", value: 18 }, { age: 10 })).toBe(true));
  it("fails when equal", () => expect(evaluateLeaf({ variable: "age", operator: "lt", value: 18 }, { age: 18 })).toBe(false));
  it("fails when greater", () => expect(evaluateLeaf({ variable: "age", operator: "lt", value: 18 }, { age: 25 })).toBe(false));
});

describe("evaluateLeaf — gte", () => {
  it("passes when greater", () => expect(evaluateLeaf({ variable: "x", operator: "gte", value: 5 }, { x: 6 })).toBe(true));
  it("passes when equal", () => expect(evaluateLeaf({ variable: "x", operator: "gte", value: 5 }, { x: 5 })).toBe(true));
  it("fails when less", () => expect(evaluateLeaf({ variable: "x", operator: "gte", value: 5 }, { x: 4 })).toBe(false));
});

describe("evaluateLeaf — lte", () => {
  it("passes when less", () => expect(evaluateLeaf({ variable: "x", operator: "lte", value: 5 }, { x: 4 })).toBe(true));
  it("passes when equal", () => expect(evaluateLeaf({ variable: "x", operator: "lte", value: 5 }, { x: 5 })).toBe(true));
  it("fails when greater", () => expect(evaluateLeaf({ variable: "x", operator: "lte", value: 5 }, { x: 6 })).toBe(false));
});

describe("evaluateLeaf — contains (string)", () => {
  it("passes when substring found", () => expect(evaluateLeaf({ variable: "bio", operator: "contains", value: "run" }, { bio: "I love running" })).toBe(true));
  it("fails when substring absent", () => expect(evaluateLeaf({ variable: "bio", operator: "contains", value: "swim" }, { bio: "I love running" })).toBe(false));
  it("coerces number variable to string", () => expect(evaluateLeaf({ variable: "code", operator: "contains", value: "4" }, { code: 42 })).toBe(true));
});

describe("evaluateLeaf — contains (array)", () => {
  it("passes when element in array", () => expect(evaluateLeaf({ variable: "tags", operator: "contains", value: "sport" }, { tags: ["health", "sport"] })).toBe(true));
  it("fails when element absent", () => expect(evaluateLeaf({ variable: "tags", operator: "contains", value: "music" }, { tags: ["health", "sport"] })).toBe(false));
});

describe("evaluateLeaf — in", () => {
  it("passes when variable is in list", () => expect(evaluateLeaf({ variable: "gender", operator: "in", value: ["male", "female"] }, { gender: "male" })).toBe(true));
  it("fails when variable not in list", () => expect(evaluateLeaf({ variable: "gender", operator: "in", value: ["male", "female"] }, { gender: "other" })).toBe(false));
  it("returns false when value is not array", () => expect(evaluateLeaf({ variable: "x", operator: "in", value: "male" as any }, { x: "male" })).toBe(false));
  it("empty list always false", () => expect(evaluateLeaf({ variable: "x", operator: "in", value: [] }, { x: "male" })).toBe(false));
  it("coerces numeric raw to string before comparison", () => expect(evaluateLeaf({ variable: "age", operator: "in", value: ["18", "25"] }, { age: 18 })).toBe(true));
  it("numeric raw not in string list returns false", () => expect(evaluateLeaf({ variable: "age", operator: "in", value: ["30", "40"] }, { age: 18 })).toBe(false));
});

describe("evaluateLeaf — not_in", () => {
  it("passes when variable not in list", () => expect(evaluateLeaf({ variable: "gender", operator: "not_in", value: ["male", "female"] }, { gender: "other" })).toBe(true));
  it("fails when variable is in list", () => expect(evaluateLeaf({ variable: "gender", operator: "not_in", value: ["male", "female"] }, { gender: "male" })).toBe(false));
  it("returns true when value is not array (safe default)", () => expect(evaluateLeaf({ variable: "x", operator: "not_in", value: "male" as any }, { x: "male" })).toBe(true));
  it("coerces numeric raw to string before comparison", () => expect(evaluateLeaf({ variable: "age", operator: "not_in", value: ["18", "25"] }, { age: 30 })).toBe(true));
  it("numeric raw in string list returns false", () => expect(evaluateLeaf({ variable: "age", operator: "not_in", value: ["18", "25"] }, { age: 18 })).toBe(false));
});

describe("evaluateLeaf — unknown operator", () => {
  it("returns false for unknown operator", () => expect(evaluateLeaf({ variable: "x", operator: "xor" as any, value: "y" }, { x: "y" })).toBe(false));
});

// ---------------------------------------------------------------------------
// evaluateCondition — logic groups
// ---------------------------------------------------------------------------

describe("evaluateCondition — AND group", () => {
  const and: Condition = {
    logic: "and",
    conditions: [
      { variable: "age", operator: "gt", value: 18 },
      { variable: "gender", operator: "eq", value: "male" },
    ],
  };

  it("passes when all conditions true", () => expect(evaluateCondition(and, { age: 25, gender: "male" })).toBe(true));
  it("fails when one condition false", () => expect(evaluateCondition(and, { age: 25, gender: "female" })).toBe(false));
  it("fails when all conditions false", () => expect(evaluateCondition(and, { age: 10, gender: "female" })).toBe(false));
});

describe("evaluateCondition — OR group", () => {
  const or: Condition = {
    logic: "or",
    conditions: [
      { variable: "age", operator: "lt", value: 18 },
      { variable: "gender", operator: "eq", value: "female" },
    ],
  };

  it("passes when first condition true", () => expect(evaluateCondition(or, { age: 10, gender: "male" })).toBe(true));
  it("passes when second condition true", () => expect(evaluateCondition(or, { age: 25, gender: "female" })).toBe(true));
  it("passes when both true", () => expect(evaluateCondition(or, { age: 10, gender: "female" })).toBe(true));
  it("fails when all false", () => expect(evaluateCondition(or, { age: 25, gender: "male" })).toBe(false));
});

describe("evaluateCondition — nested groups", () => {
  // (age > 18 AND gender = male) OR (vip = true)
  const nested: Condition = {
    logic: "or",
    conditions: [
      {
        logic: "and",
        conditions: [
          { variable: "age", operator: "gt", value: 18 },
          { variable: "gender", operator: "eq", value: "male" },
        ],
      },
      { variable: "vip", operator: "eq", value: "true" },
    ],
  };

  it("passes via inner AND branch", () => expect(evaluateCondition(nested, { age: 25, gender: "male", vip: "false" })).toBe(true));
  it("passes via vip branch", () => expect(evaluateCondition(nested, { age: 10, gender: "female", vip: "true" })).toBe(true));
  it("fails when neither branch matches", () => expect(evaluateCondition(nested, { age: 10, gender: "male", vip: "false" })).toBe(false));
});

describe("evaluateCondition — deeply nested (3 levels)", () => {
  // ((a=1 AND b=2) OR c=3) AND d=4
  const deep: Condition = {
    logic: "and",
    conditions: [
      {
        logic: "or",
        conditions: [
          {
            logic: "and",
            conditions: [
              { variable: "a", operator: "eq", value: "1" },
              { variable: "b", operator: "eq", value: "2" },
            ],
          },
          { variable: "c", operator: "eq", value: "3" },
        ],
      },
      { variable: "d", operator: "eq", value: "4" },
    ],
  };

  it("passes via a+b path with d", () => expect(evaluateCondition(deep, { a: "1", b: "2", c: "0", d: "4" })).toBe(true));
  it("passes via c path with d", () => expect(evaluateCondition(deep, { a: "0", b: "0", c: "3", d: "4" })).toBe(true));
  it("fails when d missing", () => expect(evaluateCondition(deep, { a: "1", b: "2", c: "3", d: "0" })).toBe(false));
  it("fails when inner OR fails and d present", () => expect(evaluateCondition(deep, { a: "0", b: "0", c: "0", d: "4" })).toBe(false));
});

describe("evaluateCondition — leaf passthrough", () => {
  it("delegates to evaluateLeaf directly", () => {
    const leaf: Condition = { variable: "x", operator: "eq", value: "yes" };
    expect(evaluateCondition(leaf, { x: "yes" })).toBe(true);
    expect(evaluateCondition(leaf, { x: "no" })).toBe(false);
  });
});
