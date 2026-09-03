import { describe, it, expect, vi } from "vitest";
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
  // A right-hand side that is not literally an array is covered by the `#225`
  // block at the bottom of this file: it is normalized to a member list rather
  // than answering a constant.
  it("empty list always false", () => expect(evaluateLeaf({ variable: "x", operator: "in", value: [] }, { x: "male" })).toBe(false));
  it("coerces numeric raw to string before comparison", () => expect(evaluateLeaf({ variable: "age", operator: "in", value: ["18", "25"] }, { age: 18 })).toBe(true));
  it("numeric raw not in string list returns false", () => expect(evaluateLeaf({ variable: "age", operator: "in", value: ["30", "40"] }, { age: 18 })).toBe(false));
});

describe("evaluateLeaf — not_in", () => {
  it("passes when variable not in list", () => expect(evaluateLeaf({ variable: "gender", operator: "not_in", value: ["male", "female"] }, { gender: "other" })).toBe(true));
  it("fails when variable is in list", () => expect(evaluateLeaf({ variable: "gender", operator: "not_in", value: ["male", "female"] }, { gender: "male" })).toBe(false));
  it("coerces numeric raw to string before comparison", () => expect(evaluateLeaf({ variable: "age", operator: "not_in", value: ["18", "25"] }, { age: 30 })).toBe(true));
  it("numeric raw in string list returns false", () => expect(evaluateLeaf({ variable: "age", operator: "not_in", value: ["18", "25"] }, { age: 18 })).toBe(false));
});

describe("evaluateLeaf — unknown operator", () => {
  it("returns false for unknown operator", () => expect(evaluateLeaf({ variable: "x", operator: "xor" as any, value: "y" }, { x: "y" })).toBe(false));
});

describe("evaluateLeaf — unary is_empty / is_not_empty", () => {
  it("empty string is empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_empty" }, { x: "" })).toBe(true));
  it("whitespace string is empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_empty" }, { x: "   " })).toBe(true));
  it("unset variable is empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_empty" }, {})).toBe(true));
  it("empty array is empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_empty" }, { x: [] })).toBe(true));
  it("non-empty string is not empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_empty" }, { x: "Paul" })).toBe(true));
  it("zero-string is not empty (0 is a value)", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_empty" }, { x: "0" })).toBe(true));
  it("populated array is not empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_empty" }, { x: ["a"] })).toBe(true));
  it("is_not_empty is the negation of is_empty", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_empty" }, { x: "" })).toBe(false));
});

describe("evaluateLeaf — unary is_null / is_not_null", () => {
  it("unset variable is null", () => expect(evaluateLeaf({ variable: "x", operator: "is_null" }, {})).toBe(true));
  it("explicit null is null", () => expect(evaluateLeaf({ variable: "x", operator: "is_null" }, { x: null })).toBe(true));
  it("set-but-empty string is NOT null", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_null" }, { x: "" })).toBe(true));
  it("set value is not null", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_null" }, { x: "Paul" })).toBe(true));
  it("unset variable is_not_null is false", () => expect(evaluateLeaf({ variable: "x", operator: "is_not_null" }, {})).toBe(false));
});

describe("evaluateLeaf — JSON-array-encoded variable values (CheckboxGroup)", () => {
  // Multi-select stores its value as a JSON string; "[]" is an empty selection.
  it('empty "[]" reads as empty', () => expect(evaluateLeaf({ variable: "tags", operator: "is_empty" }, { tags: "[]" })).toBe(true));
  it('empty "[]" is_not_empty is false (gated element falls back on deselect)', () =>
    expect(evaluateLeaf({ variable: "tags", operator: "is_not_empty" }, { tags: "[]" })).toBe(false));
  it('non-empty "[\\"a\\"]" is not empty', () => expect(evaluateLeaf({ variable: "tags", operator: "is_not_empty" }, { tags: '["a"]' })).toBe(true));
  it("contains uses real array membership on encoded value", () =>
    expect(evaluateLeaf({ variable: "tags", operator: "contains", value: "sport" }, { tags: '["health","sport"]' })).toBe(true));
  it("contains is false when element absent from encoded array", () =>
    expect(evaluateLeaf({ variable: "tags", operator: "contains", value: "music" }, { tags: '["health","sport"]' })).toBe(false));
  it("a plain string that is not a JSON array is left untouched", () =>
    expect(evaluateLeaf({ variable: "x", operator: "is_not_empty" }, { x: "[oops" })).toBe(true));
  it("a numeric-looking string is not coerced to empty", () =>
    expect(evaluateLeaf({ variable: "x", operator: "is_not_empty" }, { x: "5" })).toBe(true));
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

// ---------------------------------------------------------------------------
// evaluateLeaf — `{{var}}` references on the RIGHT-hand side
//
// `RepeatElement` documents "Repeat plus a per-row gate is a switch" using
// `{ variable: "item.sign", operator: "eq", value: "{{zodiacSign}}" }`. That
// only works if the condition's `value` is interpolated against the same
// variable map, which lets a condition compare two variables rather than a
// variable against an authored literal. See issue #217.
// ---------------------------------------------------------------------------

describe("evaluateLeaf — variable references in `value`", () => {
  it("matches the documented Repeat-as-Match example", () =>
    expect(
      evaluateLeaf(
        { variable: "item.sign", operator: "eq", value: "{{zodiacSign}}" },
        { "item.sign": "aries", zodiacSign: "aries" }
      )
    ).toBe(true));

  it("rejects the rows the switch should not select", () =>
    expect(
      evaluateLeaf(
        { variable: "item.sign", operator: "eq", value: "{{zodiacSign}}" },
        { "item.sign": "taurus", zodiacSign: "aries" }
      )
    ).toBe(false));

  it("compares two variables numerically", () =>
    expect(
      evaluateLeaf(
        { variable: "score", operator: "gt", value: "{{threshold}}" },
        { score: 80, threshold: 50 }
      )
    ).toBe(true));

  it("resolves a reference embedded in surrounding text", () =>
    expect(
      evaluateLeaf(
        { variable: "sku", operator: "eq", value: "plan_{{tier}}" },
        { sku: "plan_yearly", tier: "yearly" }
      )
    ).toBe(true));

  it("interpolates references inside an `in` array", () =>
    expect(
      evaluateLeaf(
        { variable: "x", operator: "in", value: ["{{a}}", "{{b}}"] },
        { x: "two", a: "one", b: "two" }
      )
    ).toBe(true));

  it("resolves an unknown reference to the empty string", () =>
    expect(
      evaluateLeaf(
        { variable: "x", operator: "eq", value: "{{nope}}" },
        { x: "something" }
      )
    ).toBe(false));

  it("treats a plain literal as a literal", () =>
    expect(
      evaluateLeaf({ variable: "x", operator: "eq", value: "aries" }, { x: "aries" })
    ).toBe(true));

  it("does not interpolate a literal containing no reference syntax", () =>
    expect(
      evaluateLeaf({ variable: "x", operator: "eq", value: "{not a ref}" }, { x: "{not a ref}" })
    ).toBe(true));
});

// ---------------------------------------------------------------------------
// evaluateLeaf — `in` / `not_in` right-hand side that is not literally an array
//
// Both operators used to answer a CONSTANT whenever `Array.isArray(value)` was
// false — `in` false for every row, `not_in` true for every row, no warning
// (issue #225). Two shapes reach them that way, and both are the natural way to
// author a membership test now that #217 made a `{{ref}}` on the right-hand
// side resolve:
//
//   value: "{{selected}}"     a reference to a multi-select variable, whose
//                             flat value is a JSON-encoded string '["a","b"]'
//   value: ["{{selected}}"]   what Studio's condition editor emits — it splits
//                             the value field on commas, so the reference lands
//                             as the single member of a one-member array
//
// Both must flatten to the same member list, else a fix covering only the bare
// string leaves every Studio-authored payload broken in the same silent way.
// ---------------------------------------------------------------------------

describe("evaluateLeaf — in / not_in against a JSON-array-string reference", () => {
  const vars = (row: string) => ({ selected: '["sleep","energy"]', "item.value": row });

  it("`in` matches a row that is a member of the referenced selection", () =>
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value: "{{selected}}" }, vars("sleep"))).toBe(true));

  it("`in` rejects a row that is not a member", () =>
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value: "{{selected}}" }, vars("focus"))).toBe(false));

  it("`not_in` rejects a row that is a member", () =>
    expect(evaluateLeaf({ variable: "item.value", operator: "not_in", value: "{{selected}}" }, vars("sleep"))).toBe(false));

  it("`not_in` matches a row that is not a member", () =>
    expect(evaluateLeaf({ variable: "item.value", operator: "not_in", value: "{{selected}}" }, vars("focus"))).toBe(true));

  it("an authored JSON-array literal string is also a list", () =>
    expect(evaluateLeaf({ variable: "x", operator: "in", value: '["a","b"]' }, { x: "b" })).toBe(true));
});

describe("evaluateLeaf — in / not_in with the array-wrapped shape Studio emits", () => {
  const vars = (row: string) => ({ selected: '["sleep","energy"]', "item.value": row });

  it("flattens a one-member array holding the JSON string", () =>
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value: ["{{selected}}"] }, vars("sleep"))).toBe(true));

  it("still rejects a non-member through the flattened shape", () =>
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value: ["{{selected}}"] }, vars("focus"))).toBe(false));

  it("`not_in` is the negation through the flattened shape", () => {
    expect(evaluateLeaf({ variable: "item.value", operator: "not_in", value: ["{{selected}}"] }, vars("energy"))).toBe(false);
    expect(evaluateLeaf({ variable: "item.value", operator: "not_in", value: ["{{selected}}"] }, vars("focus"))).toBe(true);
  });

  it("mixes a literal member with a referenced list", () => {
    const value = ["mood", "{{selected}}"];
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value }, vars("mood"))).toBe(true);
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value }, vars("energy"))).toBe(true);
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value }, vars("focus"))).toBe(false);
  });

  it("an empty value field (Studio yields []) keeps its documented constants", () => {
    expect(evaluateLeaf({ variable: "x", operator: "in", value: [] }, { x: "a" })).toBe(false);
    expect(evaluateLeaf({ variable: "x", operator: "not_in", value: [] }, { x: "a" })).toBe(true);
  });
});

describe("evaluateLeaf — an unresolved reference has no members in EITHER shape", () => {
  // The array-wrapped shape is the one Studio actually emits — its condition
  // editor always splits the value field into an array — so an unresolved
  // reference has to mean "no members" there too. Interpolation resolves it to
  // the empty string, and keeping that as a MEMBER makes an empty-string
  // variable a member of a list nobody has written: `in` true, `not_in` false,
  // the exact opposite of the bare-reference shape on the same data. An
  // empty-string variable is reachable — `InputElement` stores "" on clear and
  // `Input.defaultValue: ""` is overlaid into the variable map.
  it("`in` never matches, even when the variable is the empty string", () =>
    expect(evaluateLeaf({ variable: "name", operator: "in", value: ["{{blocked}}"] }, { name: "" })).toBe(false));

  it("`not_in` matches every row, even when the variable is the empty string", () =>
    expect(evaluateLeaf({ variable: "name", operator: "not_in", value: ["{{blocked}}"] }, { name: "" })).toBe(true));

  it("answers the same as the bare-reference shape on the same data", () => {
    const vars = { name: "" };
    expect(evaluateLeaf({ variable: "name", operator: "in", value: ["{{blocked}}"] }, vars)).toBe(
      evaluateLeaf({ variable: "name", operator: "in", value: "{{blocked}}" }, vars)
    );
    expect(evaluateLeaf({ variable: "name", operator: "not_in", value: ["{{blocked}}"] }, vars)).toBe(
      evaluateLeaf({ variable: "name", operator: "not_in", value: "{{blocked}}" }, vars)
    );
  });

  it("drops only the unresolved member, keeping the resolved ones", () => {
    const value = ["{{blocked}}", "{{selected}}"];
    const vars = (row: string) => ({ selected: '["sleep"]', "item.value": row });
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value }, vars("sleep"))).toBe(true);
    expect(evaluateLeaf({ variable: "item.value", operator: "in", value }, vars(""))).toBe(false);
  });
});

describe("evaluateLeaf — membership compares members stringified", () => {
  // A payload-authored literal array may hold numbers (ConditionValueSchema
  // permits them), and `Repeat` keeps a numeric row field numeric on purpose
  // (`repeatScope.buildRowFlat`), so `1` and `"1"` must be the same member.
  it("a numeric variable is a member of a numeric list", () =>
    expect(evaluateLeaf({ variable: "id", operator: "in", value: [1, 2] }, { id: 1 })).toBe(true));

  it("`not_in` agrees with `in` on a numeric list", () =>
    expect(evaluateLeaf({ variable: "id", operator: "not_in", value: [1, 2] }, { id: 1 })).toBe(false));

  it("a numeric variable is not a member of a list it is absent from", () =>
    expect(evaluateLeaf({ variable: "id", operator: "not_in", value: [1, 2] }, { id: 3 })).toBe(true));

  it("a numeric row field matches a decoded string list", () =>
    expect(evaluateLeaf({ variable: "item.id", operator: "in", value: "{{picked}}" }, { picked: '["1","2"]', "item.id": 1 })).toBe(true));

  it("`contains` uses the same member comparison on an array variable", () => {
    expect(evaluateLeaf({ variable: "ids", operator: "contains", value: "1" }, { ids: [1, 2] })).toBe(true);
    expect(evaluateLeaf({ variable: "ids", operator: "contains", value: "{{item.id}}" }, { ids: [1, 2], "item.id": 1 })).toBe(true);
    expect(evaluateLeaf({ variable: "ids", operator: "contains", value: "3" }, { ids: [1, 2] })).toBe(false);
  });
});

describe("evaluateLeaf — in / not_in with a right-hand side that is no list at all", () => {
  it("an unresolved reference has no members, so `in` never matches", () =>
    expect(evaluateLeaf({ variable: "x", operator: "in", value: "{{nope}}" }, { x: "sleep" })).toBe(false));

  it("an unresolved reference has no members, so `not_in` matches every row", () =>
    expect(evaluateLeaf({ variable: "x", operator: "not_in", value: "{{nope}}" }, { x: "sleep" })).toBe(true));

  it("a scalar right-hand side reads as a one-member list rather than a constant", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(evaluateLeaf({ variable: "x", operator: "in", value: "male" }, { x: "male" })).toBe(true);
    expect(evaluateLeaf({ variable: "x", operator: "in", value: "male" }, { x: "female" })).toBe(false);
    expect(evaluateLeaf({ variable: "x", operator: "not_in", value: "male" }, { x: "male" })).toBe(false);
    warn.mockRestore();
  });

  it("warns once per evaluation about a scalar right-hand side, naming the operator", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    evaluateLeaf({ variable: "x", operator: "in", value: "male" }, { x: "male" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('operator "in"');
    warn.mockRestore();
  });

  it("does not warn when the right-hand side is a real list", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    evaluateLeaf({ variable: "x", operator: "in", value: ["male"] }, { x: "male" });
    evaluateLeaf({ variable: "x", operator: "not_in", value: "{{sel}}" }, { x: "male", sel: '["male"]' });
    evaluateLeaf({ variable: "x", operator: "in", value: "{{nope}}" }, { x: "male" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
