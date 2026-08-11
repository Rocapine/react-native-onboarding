import { describe, it, expect } from "vitest";
import { mergeVariables, flattenVariables } from "../variables";

describe("mergeVariables", () => {
  it("overlays host values on top of element defaults", () => {
    const defaults = { plan: { value: "monthly" }, seen: { value: "no" } };
    const host = { plan: { value: "yearly", label: "Yearly" } };
    expect(mergeVariables(defaults, host)).toEqual({
      plan: { value: "yearly", label: "Yearly" },
      seen: { value: "no" },
    });
  });

  it("keeps defaults the host has not overridden", () => {
    expect(mergeVariables({ a: { value: "1" } }, {})).toEqual({ a: { value: "1" } });
  });

  // Inverting this spread is the classic regression: user-driven writes get
  // clobbered by element defaults on every render.
  it("never lets a default win over a host value", () => {
    const merged = mergeVariables({ k: { value: "default" } }, { k: { value: "user" } });
    expect(merged.k.value).toBe("user");
  });
});

describe("flattenVariables", () => {
  it("unwraps each entry to its primitive value", () => {
    expect(flattenVariables({ a: { value: "1" }, b: { value: "x", label: "X" } }))
      .toEqual({ a: "1", b: "x" });
  });

  it("tolerates an undefined entry", () => {
    const input = { a: undefined } as unknown as Record<string, { value: string }>;
    expect(flattenVariables(input)).toEqual({ a: undefined });
  });

  it("returns an empty object for no variables", () => {
    expect(flattenVariables({})).toEqual({});
  });
});
