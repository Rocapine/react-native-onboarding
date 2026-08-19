import { describe, it, expect } from "vitest";
import {
  buildRowEntries,
  buildRowFlat,
  buildRowKeys,
  suffixIds,
} from "../elements/repeatScope";
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
