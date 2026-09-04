import { describe, it, expect, vi } from "vitest";
import { evaluateSetVariableExpression } from "../../elements/expression";

const vars = (o: Record<string, any>) => o;

describe("PROBE: review findings still live at HEAD", () => {
  it("F1: arithmetic on a clamp bound erases the missing sentinel", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = evaluateSetVariableExpression(
      "clamp({{score}}, 0, {{maxScore}} * 0.9)",
      { score: { value: 42 } } as any,
    );
    console.log("F1 clamp with computed absent bound =>", JSON.stringify(out), "warnings:", warn.mock.calls.length);
    warn.mockRestore();
  });
  it("F1b: same clamp with a BARE absent bound (guard should fire)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = evaluateSetVariableExpression(
      "clamp({{score}}, 0, {{maxScore}})",
      { score: { value: 42 } } as any,
    );
    console.log("F1b clamp with bare absent bound =>", JSON.stringify(out), "warnings:", warn.mock.calls.length);
    warn.mockRestore();
  });
  it("F2: min/max with an absent bound", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = evaluateSetVariableExpression(
      "min({{count}}, {{maxGoals}})",
      { count: { value: 7 } } as any,
    );
    console.log("F2 min with absent bound =>", JSON.stringify(out), "warnings:", warn.mock.calls.length);
    warn.mockRestore();
  });
});
