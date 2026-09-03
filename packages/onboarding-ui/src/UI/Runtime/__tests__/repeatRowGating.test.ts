import { describe, it, expect } from "vitest";
// The built module, not the package entry point: this vitest project runs in a
// node environment (see vitest.config.ts) and the package entry pulls in
// react-native, whose Flow syntax node cannot parse. Same compiled function the
// renderer calls.
import { evaluateCondition } from "@rocapine/react-native-onboarding/dist/evaluateCondition";
import type { Condition } from "@rocapine/react-native-onboarding";
import { buildRowFlat } from "../elements/repeatScope";

/**
 * The UI half of issue #225. `renderWhen` is evaluated by the headless
 * `evaluateCondition` (single gating point in `elements/renderElement.tsx`), and
 * a `Repeat` row's variables come from `buildRowFlat` here — which keeps a
 * numeric row field numeric on purpose. This composes the two the way the
 * renderer does, because that combination is where a membership gate actually
 * mis-evaluated: the row field arrives typed, and the selection arrives as the
 * JSON-encoded string a CheckboxGroup writes (`VariablesContext` flattens to
 * `entry.value`, `CheckboxGroupElement` writes `JSON.stringify(next)`).
 *
 * These are the two payload shapes #185 (grouped / regrouping multi-select) and
 * `rocapine/onboarding-studio#251` (dual-list catalog picker) are built from.
 */

const rows = (values: Array<string | number>) =>
  values.map((value, i) => buildRowFlat({ value }, i, "item"));

const gate = (condition: Condition, host: Record<string, unknown>, list: Array<string | number>) =>
  rows(list)
    .filter((row) => evaluateCondition(condition, { ...host, ...row }))
    .map((row) => row["item.value"]);

describe("Repeat row gating — the Available bucket of a grouped multi-select (#185)", () => {
  const catalog = ["sleep", "energy", "focus", "mood"];
  const selected = { selected: '["sleep","energy"]' };

  it("`not_in` shows only the rows that are NOT selected", () =>
    expect(gate({ variable: "item.value", operator: "not_in", value: "{{selected}}" }, selected, catalog)).toEqual([
      "focus",
      "mood",
    ]));

  it("`in` shows only the rows that ARE selected", () =>
    expect(gate({ variable: "item.value", operator: "in", value: "{{selected}}" }, selected, catalog)).toEqual([
      "sleep",
      "energy",
    ]));

  it("the same holds through the array-wrapped shape Studio's condition editor emits", () =>
    expect(gate({ variable: "item.value", operator: "not_in", value: ["{{selected}}"] }, selected, catalog)).toEqual([
      "focus",
      "mood",
    ]));

  it("an empty selection leaves the whole catalog available", () =>
    expect(
      gate({ variable: "item.value", operator: "not_in", value: "{{selected}}" }, { selected: "[]" }, catalog)
    ).toEqual(catalog));
});

describe("Repeat row gating — the 'not yet tagged' view of a dual-list picker (studio#251)", () => {
  it("an AND of two `not_in` shows only the untagged rows", () => {
    const condition: Condition = {
      logic: "and",
      conditions: [
        { variable: "item.value", operator: "not_in", value: "{{likes}}" },
        { variable: "item.value", operator: "not_in", value: "{{dislikes}}" },
      ],
    };
    expect(gate(condition, { likes: '["a"]', dislikes: '["b"]' }, ["a", "b", "c"])).toEqual(["c"]);
  });
});

describe("Repeat row gating — a numeric row field", () => {
  const picked = { picked: '["1","3"]' };

  it("`in` matches a numeric row id against a decoded string list", () =>
    expect(gate({ variable: "item.value", operator: "in", value: "{{picked}}" }, picked, [1, 2, 3])).toEqual([1, 3]));

  it("`not_in` is its exact negation on the same rows", () =>
    expect(gate({ variable: "item.value", operator: "not_in", value: "{{picked}}" }, picked, [1, 2, 3])).toEqual([2]));

  it("`contains` against the selection agrees with `in` on the same data", () =>
    expect(gate({ variable: "picked", operator: "contains", value: "{{item.value}}" }, picked, [1, 2, 3])).toEqual([
      1, 3,
    ]));
});
