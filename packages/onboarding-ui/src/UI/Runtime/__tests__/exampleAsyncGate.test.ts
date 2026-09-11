import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  GENERATE_PLAN_MAX_ATTEMPTS,
  shouldGeneratePlanFail,
} from "../../../../../../example/components/asyncGateDemo";

/**
 * The example app is this PR's only demonstration of the async gate's ERROR
 * branch, and round 1 shipped one that could never render (review round 2,
 * finding 3): the demo handler threw on every ODD attempt while the payload
 * declared `retry: { maxAttempts: 3 }`, so every press spent exactly two
 * attempts — fail, then succeed — and `onError` never ran. Nothing rendered the
 * `async-gate-error` copy, and nothing could: this suite is `environment:
 * "node"` with no component mounts, so a broken demo is the only signal an
 * error state has never been seen.
 *
 * So the schedule is a shared function rather than a modulus inlined in
 * `_layout.tsx`, and the arithmetic is pinned here against the cap the payload
 * actually declares. Source-level on both files, the precedent
 * `exampleExpressions.test.ts` sets for "the two shipped copies must agree".
 */

const EXAMPLE = new URL(
  "../../../../../../example/app/example/composable-screen.tsx",
  import.meta.url
);
const LAYOUT = new URL("../../../../../../example/app/_layout.tsx", import.meta.url);

/** One press of the CTA: attempts until the handler resolves or the cap runs out. */
const press = (state: { attempts: number }, maxAttempts: number): "resolve" | "error" => {
  for (let i = 0; i < maxAttempts; i++) {
    state.attempts += 1;
    if (!shouldGeneratePlanFail(state.attempts)) return "resolve";
  }
  return "error";
};

describe("example app — the async gate demo reaches both outcomes", () => {
  it("declares the same retry cap in the payload and the handler", () => {
    const src = readFileSync(EXAMPLE, "utf8");
    const cap = /retry:\s*\{\s*maxAttempts:\s*(\d+)/.exec(src);
    expect(cap, "async-gate payload declares no retry cap").toBeTruthy();
    expect(Number(cap![1])).toBe(GENERATE_PLAN_MAX_ATTEMPTS);
  });

  it("lands the FIRST press in onError, so the error copy renders", () => {
    const state = { attempts: 0 };
    expect(press(state, GENERATE_PLAN_MAX_ATTEMPTS)).toBe("error");
  });

  it("recovers on the next press, so the resolve copy renders too", () => {
    const state = { attempts: 0 };
    press(state, GENERATE_PLAN_MAX_ATTEMPTS);
    expect(press(state, GENERATE_PLAN_MAX_ATTEMPTS)).toBe("resolve");
  });

  it("alternates for as long as anyone keeps tapping", () => {
    const state = { attempts: 0 };
    const outcomes = Array.from({ length: 6 }, () => press(state, GENERATE_PLAN_MAX_ATTEMPTS));
    expect(outcomes).toEqual(["error", "resolve", "error", "resolve", "error", "resolve"]);
  });

  it("exercises a retry that RECOVERS within one press at a higher cap", () => {
    // The retry path is only observable when the cap outruns the failure run.
    const state = { attempts: 0 };
    expect(press(state, GENERATE_PLAN_MAX_ATTEMPTS + 1)).toBe("resolve");
    expect(state.attempts).toBeGreaterThan(1);
  });

  it("wires the handler to the shared schedule rather than its own modulus", () => {
    const src = readFileSync(LAYOUT, "utf8");
    expect(src).toContain("shouldGeneratePlanFail");
    expect(src).not.toMatch(/generatePlanAttempts\s*%/);
  });
});
