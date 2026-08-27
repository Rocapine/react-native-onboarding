import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveEffectiveParams } from "../effectiveParams";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("resolveEffectiveParams", () => {
  it("merges the store over the prop", () => {
    expect(resolveEffectiveParams({ onboardingId: "abc", plan: "stale" }, { plan: "free" })).toEqual({
      onboardingId: "abc",
      plan: "free",
    });
  });

  it("serializes both sides to strings", () => {
    expect(resolveEffectiveParams({ build: 42 }, { days: 3, trial: true })).toEqual({
      build: "42",
      days: "3",
      trial: "true",
    });
  });

  it('drops a null or undefined baseline value rather than sending "null"', () => {
    expect(resolveEffectiveParams({ a: null, b: undefined, c: "keep" }, {})).toEqual({ c: "keep" });
  });

  it("drops a reserved key present in the baseline prop, warning once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveEffectiveParams({ projectId: "sneaky", plan: "free" }, {})).toEqual({
      plan: "free",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("projectId"));
  });

  it("returns an empty map for empty inputs", () => {
    expect(resolveEffectiveParams({}, {})).toEqual({});
  });

  it("tolerates a missing baseline", () => {
    expect(resolveEffectiveParams(undefined as any, { plan: "free" })).toEqual({ plan: "free" });
  });

  it("stringifies an unsupported baseline value rather than dropping it", () => {
    // `customAudienceParams` is typed `Record<string, any>` and predates this
    // module, so an existing host may already be passing something exotic. It
    // must keep reaching the server exactly as it did before.
    expect(resolveEffectiveParams({ ids: [1, 2] }, {})).toEqual({ ids: "1,2" });
  });
});
