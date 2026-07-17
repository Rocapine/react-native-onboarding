import { describe, it, expect } from "vitest";
import { resolveStartStepNumber } from "../resolveStartStepNumber";
import type { BaseStepType } from "../types";

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

const steps = [makeStep("s1"), makeStep("s2"), makeStep("s3")];

describe("resolveStartStepNumber", () => {
  it("returns the 1-indexed position of the startStepId when present", () => {
    expect(resolveStartStepNumber(steps, "s2")).toBe(2);
    expect(resolveStartStepNumber(steps, "s3")).toBe(3);
  });

  it("returns 1 for the first step id", () => {
    expect(resolveStartStepNumber(steps, "s1")).toBe(1);
  });

  it("falls back to 1 when startStepId is undefined (legacy)", () => {
    expect(resolveStartStepNumber(steps)).toBe(1);
    expect(resolveStartStepNumber(steps, undefined)).toBe(1);
  });

  it("falls back to 1 when startStepId references a missing step", () => {
    expect(resolveStartStepNumber(steps, "does-not-exist")).toBe(1);
  });

  it("falls back to 1 for an empty steps array", () => {
    expect(resolveStartStepNumber([], "s1")).toBe(1);
    expect(resolveStartStepNumber([])).toBe(1);
  });
});
