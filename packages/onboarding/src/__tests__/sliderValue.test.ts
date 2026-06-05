import { describe, it, expect } from "vitest";
import {
  snapSliderValue,
  resolveSliderDefault,
  type SliderElementProps,
} from "../steps/ComposableScreen/elements/SliderElement";

const props = (p: Partial<SliderElementProps>): SliderElementProps =>
  ({ min: 0, max: 100, ...p }) as SliderElementProps;

describe("snapSliderValue", () => {
  it("snaps to the nearest step", () => {
    const p = props({ min: 0, max: 10, step: 2 });
    expect(snapSliderValue(p, 3)).toBe(4); // 3 rounds to nearest 2-step → 4
    expect(snapSliderValue(p, 2.9)).toBe(2);
    expect(snapSliderValue(p, 5)).toBe(6);
  });

  it("defaults step to 1 when unset or non-positive", () => {
    expect(snapSliderValue(props({ min: 0, max: 10 }), 4.4)).toBe(4);
    expect(snapSliderValue(props({ min: 0, max: 10, step: 0 }), 4.4)).toBe(4);
  });

  it("clamps to [min, max]", () => {
    const p = props({ min: 10, max: 20, step: 1 });
    expect(snapSliderValue(p, -5)).toBe(10);
    expect(snapSliderValue(p, 999)).toBe(20);
  });

  it("trims float accumulation noise", () => {
    const p = props({ min: 0, max: 1, step: 0.1 });
    // 0.1 * 3 = 0.30000000000000004 without trimming.
    expect(snapSliderValue(p, 0.3)).toBe(0.3);
  });

  it("respects a non-zero min as the snap origin", () => {
    const p = props({ min: 1, max: 11, step: 2 });
    expect(snapSliderValue(p, 4)).toBe(5); // origin 1 → 1,3,5,7...; 4 → 5
  });
});

describe("resolveSliderDefault", () => {
  it("returns defaultValue when set", () => {
    expect(resolveSliderDefault(props({ min: 0, max: 10, defaultValue: 7 }))).toBe(7);
  });

  it("falls back to min when defaultValue is unset", () => {
    expect(resolveSliderDefault(props({ min: 3, max: 10 }))).toBe(3);
  });
});
