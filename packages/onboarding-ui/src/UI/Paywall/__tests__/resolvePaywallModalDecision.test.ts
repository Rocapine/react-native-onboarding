import { describe, it, expect } from "vitest";
import { resolvePaywallModalDecision } from "../resolvePaywallModalDecision";

type FakeElements = { ok: true };

const succeed = (elements: unknown) => ({ success: true as const, data: elements as FakeElements });
const fail = () => ({ success: false as const });

describe("resolvePaywallModalDecision", () => {
  it("is 'hidden' when there is no active paywall", () => {
    const decision = resolvePaywallModalDecision(null, succeed);
    expect(decision).toEqual({ type: "hidden" });
  });

  it("is 'show' with the parsed elements when parsing succeeds", () => {
    const paywall = { elements: [{ type: "Text" }] };
    const decision = resolvePaywallModalDecision(paywall, succeed);
    expect(decision).toEqual({ type: "show", elements: paywall.elements });
  });

  it("is 'parse-error' — never 'show' — when parsing fails", () => {
    // Finding 2: a malformed payload must never reach the Modal/ErrorBoundary
    // path, which has no interactive control and would trap an iOS user.
    const paywall = { elements: [{ type: "NotAnElement" }] };
    const decision = resolvePaywallModalDecision(paywall, fail);
    expect(decision).toEqual({ type: "parse-error" });
  });

  it("calls parse with the active paywall's own elements", () => {
    const paywall = { elements: ["marker"] };
    let received: unknown;
    resolvePaywallModalDecision(paywall, (elements) => {
      received = elements;
      return succeed(elements);
    });
    expect(received).toBe(paywall.elements);
  });
});
