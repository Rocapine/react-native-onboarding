import { describe, it, expect, vi } from "vitest";
import {
  createInFlightRegistry,
  inFlightVariableKey,
  IN_FLIGHT_ANY_KEY,
  withInFlightVariables,
} from "../inFlight";

// RNO#191 — the runtime-owned in-flight state. `ButtonElement.handlePress`
// awaits `runActions` with no guard, so a second tap during a slow LLM call
// fires the handler again. The claim is SYNCHRONOUS on purpose: React state is
// not, and two taps landing in one tick must not both win.

describe("in-flight registry — re-entrancy", () => {
  it("grants the first claim", () => {
    const registry = createInFlightRegistry(() => {});
    expect(registry.claim("cta")).toBe(true);
  });

  it("refuses a second claim while the first is still held", () => {
    const registry = createInFlightRegistry(() => {});
    registry.claim("cta");
    expect(registry.claim("cta")).toBe(false);
  });

  it("grants a claim again after release", () => {
    const registry = createInFlightRegistry(() => {});
    registry.claim("cta");
    registry.release("cta");
    expect(registry.claim("cta")).toBe(true);
  });

  it("keeps claims independent per element", () => {
    const registry = createInFlightRegistry(() => {});
    registry.claim("cta");
    expect(registry.claim("secondary")).toBe(true);
  });

  it("tolerates releasing something never claimed", () => {
    const registry = createInFlightRegistry(() => {});
    expect(() => registry.release("ghost")).not.toThrow();
  });
});

describe("in-flight registry — change notification", () => {
  // ScreenRenderer subscribes with a setState. A new Set identity each time is
  // what makes the variable projection (and every renderWhen reading it)
  // re-evaluate; mutating one in place would render nothing.
  it("publishes a new set identity on claim and on release", () => {
    const onChange = vi.fn();
    const registry = createInFlightRegistry(onChange);
    registry.claim("cta");
    registry.release("cta");
    expect(onChange).toHaveBeenCalledTimes(2);
    const [first] = onChange.mock.calls[0];
    const [second] = onChange.mock.calls[1];
    expect(first).not.toBe(second);
    expect([...first]).toEqual(["cta"]);
    expect([...second]).toEqual([]);
  });

  it("does not notify for a refused claim", () => {
    const onChange = vi.fn();
    const registry = createInFlightRegistry(onChange);
    registry.claim("cta");
    onChange.mockClear();
    registry.claim("cta");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("in-flight variables — what a payload can gate on", () => {
  it("reports no pending work when nothing is in flight", () => {
    const vars = withInFlightVariables({}, new Set());
    expect(vars[IN_FLIGHT_ANY_KEY]?.value).toBe("false");
  });

  it("reports screen-wide pending while any element is in flight", () => {
    const vars = withInFlightVariables({}, new Set(["cta"]));
    expect(vars[IN_FLIGHT_ANY_KEY]?.value).toBe("true");
  });

  it("reports per-element pending under a dotted key", () => {
    const vars = withInFlightVariables({}, new Set(["cta"]));
    expect(vars[inFlightVariableKey("cta")]?.value).toBe("true");
  });

  // Absent reads as "not pending" for `eq "true"` AND for `neq "true"`
  // (evaluateCondition stringifies), so there is no third state to author for.
  it("omits the key for an element that is not in flight", () => {
    const vars = withInFlightVariables({}, new Set(["cta"]));
    expect(vars[inFlightVariableKey("secondary")]).toBeUndefined();
  });

  // Runtime facts win, like product variables: an author variable that happened
  // to be named `actions.pending` must not be able to lie about the gate.
  it("wins over an author variable of the same name", () => {
    const vars = withInFlightVariables(
      { [IN_FLIGHT_ANY_KEY]: { value: "false" } },
      new Set(["cta"])
    );
    expect(vars[IN_FLIGHT_ANY_KEY]?.value).toBe("true");
  });

  it("leaves the base map untouched", () => {
    const base = { goal: { value: "muscle" } };
    const vars = withInFlightVariables(base, new Set(["cta"]));
    expect(vars.goal?.value).toBe("muscle");
    expect(base[IN_FLIGHT_ANY_KEY as keyof typeof base]).toBeUndefined();
  });
});
