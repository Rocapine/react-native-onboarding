import { describe, it, expect } from "vitest";
import { computeProgress, type ProgressStep } from "../computeProgress";

const counted = (visible = true): ProgressStep => ({
  progressMode: "counted",
  displayProgressHeader: visible,
});
const interstitial = (visible = true): ProgressStep => ({
  progressMode: "interstitial",
  displayProgressHeader: visible,
});
const excluded = (visible = true): ProgressStep => ({
  progressMode: "excluded",
  displayProgressHeader: visible,
});
const legacy = (visible = true): ProgressStep => ({
  displayProgressHeader: visible,
}); // no progressMode → behaves as counted

describe("computeProgress", () => {
  it("back-compat: no progressMode anywhere matches legacy index/length math", () => {
    const steps = [legacy(), legacy(), legacy(), legacy()];
    // Legacy formula: round(100 * number / length)
    expect(computeProgress(1, steps).percentage).toBe(25);
    expect(computeProgress(2, steps).percentage).toBe(50);
    expect(computeProgress(3, steps).percentage).toBe(75);
    expect(computeProgress(4, steps).percentage).toBe(100);
  });

  it("back-compat: visibility follows displayProgressHeader when no excluded", () => {
    const steps = [legacy(false), legacy(true)];
    expect(computeProgress(1, steps).visible).toBe(false);
    expect(computeProgress(2, steps).visible).toBe(true);
  });

  it("drops interstitial/excluded steps from the denominator", () => {
    // 5 steps: counted, interstitial, counted, excluded, counted → 3 counted.
    const steps = [counted(), interstitial(), counted(), excluded(), counted()];
    expect(computeProgress(1, steps).percentage).toBe(33); // 1/3
    expect(computeProgress(3, steps).percentage).toBe(67); // 2/3
    expect(computeProgress(5, steps).percentage).toBe(100); // 3/3
  });

  it("freezes the bar at the prior counted position on interstitial/excluded steps", () => {
    const steps = [counted(), interstitial(), counted(), excluded(), counted()];
    // On the interstitial (index 1): 1 counted step before it, not counted itself → 1/3.
    expect(computeProgress(2, steps).percentage).toBe(33);
    // On the excluded (index 3): 2 counted before, not counted itself → 2/3.
    expect(computeProgress(4, steps).percentage).toBe(67);
  });

  it("hides the bar on excluded steps regardless of displayProgressHeader", () => {
    const steps = [counted(true), excluded(true), counted(true)];
    expect(computeProgress(2, steps).visible).toBe(false);
  });

  it("keeps the bar on interstitial steps per displayProgressHeader", () => {
    const steps = [counted(true), interstitial(true), interstitial(false)];
    expect(computeProgress(2, steps).visible).toBe(true);
    expect(computeProgress(3, steps).visible).toBe(false);
  });

  it("first counted step > 0% and last counted step = 100%", () => {
    const steps = [excluded(), counted(), counted(), excluded()];
    expect(computeProgress(2, steps).percentage).toBe(50); // first counted
    expect(computeProgress(3, steps).percentage).toBe(100); // last counted
  });

  it("returns 0% / hidden when there are no counted steps", () => {
    const steps = [excluded(), interstitial()];
    expect(computeProgress(1, steps)).toEqual({ percentage: 0, visible: false });
  });

  it("clamps an out-of-range activeNumber", () => {
    const steps = [counted(), counted()];
    expect(computeProgress(0, steps).percentage).toBe(50); // clamps to index 0
    expect(computeProgress(99, steps).percentage).toBe(100); // clamps to last
  });
});
