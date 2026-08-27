import { describe, it, expect } from "vitest";
import { isReservedUserPropertyKey, RESERVED_USER_PROPERTY_KEYS } from "../reserved";
import { serializeUserPropertyValue, toQueryParams, paramsHash } from "../serialize";
import { applyUserPropertyPatch } from "../applyPatch";

describe("reserved keys", () => {
  it("names every key the client itself puts on the querystring", () => {
    expect([...RESERVED_USER_PROPERTY_KEYS].sort()).toEqual(
      ["appVersion", "draft", "locale", "moment", "now", "omitNulls", "platform", "projectId"],
    );
  });

  it("is exact, not a prefix match", () => {
    expect(isReservedUserPropertyKey("projectId")).toBe(true);
    expect(isReservedUserPropertyKey("projectIdentifier")).toBe(false);
  });
});

describe("serializeUserPropertyValue", () => {
  it("stringifies each supported value type", () => {
    expect(serializeUserPropertyValue("free")).toBe("free");
    expect(serializeUserPropertyValue(3)).toBe("3");
    expect(serializeUserPropertyValue(0)).toBe("0");
    expect(serializeUserPropertyValue(true)).toBe("true");
    expect(serializeUserPropertyValue(false)).toBe("false");
  });

  it("keeps a version-shaped string intact for the server's version conversion", () => {
    expect(serializeUserPropertyValue("1.2.3")).toBe("1.2.3");
  });
});

describe("toQueryParams", () => {
  it("serializes every value", () => {
    expect(toQueryParams({ plan: "free", days: 3, trial: false })).toEqual({
      plan: "free",
      days: "3",
      trial: "false",
    });
  });
});

describe("paramsHash", () => {
  it("is stable under key reordering", () => {
    expect(paramsHash({ a: "1", b: "2" })).toBe(paramsHash({ b: "2", a: "1" }));
  });

  it("changes when any value changes", () => {
    expect(paramsHash({ a: "1" })).not.toBe(paramsHash({ a: "2" }));
  });

  it("distinguishes a moved delimiter", () => {
    // Without a delimiter per pair, {ab:"c"} and {a:"bc"} would collide.
    expect(paramsHash({ ab: "c" })).not.toBe(paramsHash({ a: "bc" }));
  });

  it("returns an empty string for no params, so the legacy cache key is unchanged", () => {
    expect(paramsHash({})).toBe("");
  });
});

describe("applyUserPropertyPatch", () => {
  it("merges shallowly rather than replacing", () => {
    const { next } = applyUserPropertyPatch({ plan: "free", days: 3 }, { days: 4 });
    expect(next).toEqual({ plan: "free", days: 4 });
  });

  it("deletes a key set to null or undefined", () => {
    expect(applyUserPropertyPatch({ plan: "free", days: 3 }, { plan: null }).next).toEqual({ days: 3 });
    expect(applyUserPropertyPatch({ plan: "free" }, { plan: undefined }).next).toEqual({});
  });

  it("rejects a reserved key, leaving it absent, and warns naming it", () => {
    const { next, warnings } = applyUserPropertyPatch({}, { projectId: "sneaky", plan: "free" });
    expect(next).toEqual({ plan: "free" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("projectId");
  });

  it("rejects a non-finite number rather than serializing NaN", () => {
    const { next, warnings } = applyUserPropertyPatch({}, { days: NaN, ok: 1 });
    expect(next).toEqual({ ok: 1 });
    expect(warnings[0]).toContain("days");
  });

  it("rejects an unsupported value type", () => {
    const { next, warnings } = applyUserPropertyPatch({}, { nested: { a: 1 } as any });
    expect(next).toEqual({});
    expect(warnings[0]).toContain("nested");
  });

  it("returns the same object when the patch changes nothing", () => {
    const current = { plan: "free" };
    expect(applyUserPropertyPatch(current, { plan: "free" }).next).toBe(current);
  });
});
