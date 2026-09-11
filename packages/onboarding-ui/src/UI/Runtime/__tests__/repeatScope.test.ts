import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRowEntries,
  buildRowFlat,
  buildRowKeys,
  suffixIds,
  withRowPendingAliases,
} from "../elements/repeatScope";
import { IN_FLIGHT_ANY_KEY, inFlightVariableKey } from "../inFlight";
import type { UIElement } from "../types";

const template = [
  {
    id: "card",
    type: "YStack",
    props: {},
    children: [
      { id: "art", type: "Image", props: { url: "{{item.art}}" } },
      { id: "title", type: "Text", props: { content: "x" } },
    ],
  },
] as unknown as UIElement[];

describe("suffixIds", () => {
  it("suffixes ids through the whole subtree so N rows never collide", () => {
    const out = suffixIds(template, "aries") as any[];
    expect(out[0].id).toBe("card__aries");
    expect(out[0].children.map((c: any) => c.id)).toEqual(["art__aries", "title__aries"]);
  });

  it("does not mutate the template — every row clones from the same source", () => {
    const a = suffixIds(template, "aries") as any[];
    const b = suffixIds(template, "leo") as any[];
    expect((template[0] as any).id).toBe("card");
    expect((template[0] as any).children[0].id).toBe("art");
    expect(a[0].id).not.toBe(b[0].id);
    expect(a[0].children[0].id).toBe("art__aries");
    expect(b[0].children[0].id).toBe("art__leo");
  });

  it("leaves leaf elements without children untouched in shape", () => {
    const out = suffixIds([{ id: "t", type: "Text", props: {} }] as unknown as UIElement[], "0") as any[];
    expect(out[0]).toEqual({ id: "t__0", type: "Text", props: {} });
    expect("children" in out[0]).toBe(false);
  });
});

describe("buildRowKeys", () => {
  it("uses the keyField when it resolves", () => {
    expect(buildRowKeys([{ sign: "aries" }, { sign: "leo" }], "sign")).toEqual(["aries", "leo"]);
  });

  it("falls back to the index when keyField is unset or missing on a row", () => {
    expect(buildRowKeys([{ a: 1 }, { a: 2 }])).toEqual(["0", "1"]);
    expect(buildRowKeys([{ sign: "aries" }, { other: "x" }], "sign")).toEqual(["aries", "1"]);
  });

  it("stringifies non-string key values", () => {
    expect(buildRowKeys([{ n: 3 }, { n: false }], "n")).toEqual(["3", "false"]);
  });
});

describe("buildRowEntries / buildRowFlat", () => {
  it("namespaces fields under the scope and always adds index", () => {
    const row = { sign: "aries", titleKey: "zodiac_aries_title" };
    expect(buildRowEntries(row, 4, "item")).toEqual({
      "item.sign": { value: "aries" },
      "item.titleKey": { value: "zodiac_aries_title" },
      "item.index": { value: "4" },
    });
  });

  it("honours a custom scope prefix", () => {
    expect(Object.keys(buildRowEntries({ a: 1 }, 0, "girl"))).toEqual(["girl.a", "girl.index"]);
  });

  it("keeps primitive types in the flat map so numeric gates compare numerically", () => {
    // entries stringify (they feed {{interpolation}}); flat preserves type
    // (it feeds evaluateCondition, where 3 > 2 must not be "3" > "2").
    expect(buildRowEntries({ n: 3 }, 0, "item")["item.n"]).toEqual({ value: "3" });
    expect(buildRowFlat({ n: 3 }, 0, "item")["item.n"]).toBe(3);
    expect(buildRowFlat({ ok: true }, 0, "item")["item.ok"]).toBe(true);
    expect(buildRowFlat({}, 7, "item")["item.index"]).toBe(7);
  });
});

/**
 * The per-element pending key inside a `Repeat` (#191, review round 1,
 * finding 9).
 *
 * `suffixIds` rewrites every template id to `${id}__${rowKey}`, so the runtime
 * publishes `actions.pending.row-cta__yearly` while the author can only write
 * the template id — `evaluateCondition` looks the left-hand side up VERBATIM
 * (only the right-hand side interpolates), and the row scope exposes `item.*`
 * and nothing else. So `disabledWhen: actions.pending.row-cta` was unreachable
 * by any payload spelling: the row CTA never disabled and the row's pending copy
 * never rendered, while the screen-wide key fired for all rows at once.
 *
 * The row scope therefore aliases its OWN suffixed pending keys back to the
 * template id, which is the same thing `buildRowEntries` does for row fields.
 */
describe("withRowPendingAliases", () => {
  const pending = (id: string) => inFlightVariableKey(id);

  it("exposes this row's pending key under the template id", () => {
    const vars = { [pending("row-cta__yearly")]: { value: "true" } };
    expect(withRowPendingAliases(vars, "yearly")[pending("row-cta")]).toEqual({
      value: "true",
    });
  });

  it("does not expose another row's pending key", () => {
    const vars = { [pending("row-cta__yearly")]: { value: "true" } };
    expect(withRowPendingAliases(vars, "monthly")[pending("row-cta")]).toBeUndefined();
  });

  it("keeps the suffixed key and everything else untouched", () => {
    const vars = {
      [pending("row-cta__yearly")]: { value: "true" },
      [IN_FLIGHT_ANY_KEY]: { value: "true" },
      plan: { value: "yearly" },
    };
    const out = withRowPendingAliases(vars, "yearly");
    expect(out[pending("row-cta__yearly")]).toEqual({ value: "true" });
    expect(out[IN_FLIGHT_ANY_KEY]).toEqual({ value: "true" });
    expect(out.plan).toEqual({ value: "yearly" });
  });

  it("works on the flat map too, where values are primitives", () => {
    const flat = { [pending("row-cta__0")]: "true", "item.index": 0 };
    expect(withRowPendingAliases(flat, "0")[pending("row-cta")]).toBe("true");
  });

  it("aliases a nested element id, and never the screen-wide key itself", () => {
    const vars = {
      [pending("row-inner__a")]: { value: "true" },
      [`${IN_FLIGHT_ANY_KEY}__a`]: { value: "true" },
    };
    const out = withRowPendingAliases(vars, "a");
    expect(out[pending("row-inner")]).toEqual({ value: "true" });
    // `actions.pending__a` is not a per-element key; stripping its suffix would
    // overwrite the screen-wide flag with a row's state.
    expect(out[IN_FLIGHT_ANY_KEY]).toBeUndefined();
  });

  it("returns the bag unchanged when nothing in it is pending", () => {
    const vars = { plan: { value: "yearly" } };
    expect(withRowPendingAliases(vars, "yearly")).toEqual(vars);
  });

  /**
   * A `Repeat` inside a `Repeat` (review round 2, finding 2). `suffixIds`
   * COMPOSES across nesting levels — `row-cta` → `row-cta__0` → `row-cta__0__a`
   * — so each level has to strip its own suffix AND everything its ancestors
   * added, or the author-spellable `actions.pending.row-cta` is never published
   * and the row gate is silently dead.
   */
  describe("nested Repeat", () => {
    const inner = pending("row-cta__0__a");

    it("publishes the template key from the innermost row", () => {
      const out = withRowPendingAliases({ [inner]: { value: "true" } }, "a", "__0");
      expect(out[pending("row-cta")]).toEqual({ value: "true" });
    });

    it("still refuses another branch of the tree", () => {
      const vars = { [inner]: { value: "true" } };
      // Same inner row key, different OUTER row: not this subtree's press.
      expect(withRowPendingAliases(vars, "a", "__1")[pending("row-cta")]).toBeUndefined();
      // Same outer row, different inner row.
      expect(withRowPendingAliases(vars, "b", "__0")[pending("row-cta")]).toBeUndefined();
    });

    it("composes the way the renderer does, level by level", () => {
      // What the outer level hands down, then what the inner level publishes.
      const screen = { [inner]: { value: "true" }, [pending("outer-cta__0")]: { value: "true" } };
      const outerRow = withRowPendingAliases(screen, "0");
      expect(outerRow[pending("outer-cta")]).toEqual({ value: "true" });
      const innerRow = withRowPendingAliases(outerRow, "a", "__0");
      expect(innerRow[pending("row-cta")]).toEqual({ value: "true" });
      expect(innerRow[pending("outer-cta")]).toEqual({ value: "true" });
    });
  });
});

/**
 * The helper above is worthless unwired, and nothing else in this node-only
 * suite renders `RepeatElement` (review round 1, finding 2 — the same class of
 * hole that let a one-line revert of the press guard pass 382 tests).
 * Source-level, like `hostResolverWiring.test.ts`.
 */
describe("RepeatElement applies the row pending alias", () => {
  const src = readFileSync(
    join(__dirname, "../elements/RepeatElement.tsx"),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("aliases the reactive variables and the flat gate map", () => {
    expect(src).toMatch(/variables:\s*withRowPendingAliases\(/);
    expect(src).toMatch(/flatVariables:\s*withRowPendingAliases\(/);
  });

  it("aliases the press-time getVariables of the row context", () => {
    expect(src).toMatch(/getVariables:[\s\S]{0,120}?withRowPendingAliases\(/);
  });

  // The accumulated suffix is what makes a nested Repeat work (review round 2,
  // finding 2): the component must READ its parent's chain off the context and
  // PUBLISH its own for any Repeat below it.
  it("reads the parent row suffix and republishes its own", () => {
    expect(src).toMatch(/rowSuffix/);
    expect(src).toMatch(/useVariables\(\)/);
    expect(src).toMatch(/rowSuffix:\s*rowSuffixes\[i\]/);
  });
});
