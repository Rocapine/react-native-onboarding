import { describe, it, expect } from "vitest";
import { shouldAdvanceOnComplete } from "../shouldAdvanceOnComplete";

describe("shouldAdvanceOnComplete", () => {
  // A bare `{type:"continue"}` action calls complete() with nothing at all.
  it("advances on an absent outcome", () => {
    expect(shouldAdvanceOnComplete()).toBe(true);
    expect(shouldAdvanceOnComplete({})).toBe(true);
  });

  it("advances on a purchase", () => {
    expect(shouldAdvanceOnComplete({ status: "purchased" })).toBe(true);
  });

  it("does NOT advance on dismiss or cancel — this is a hard gate", () => {
    expect(shouldAdvanceOnComplete({ status: "dismissed" })).toBe(false);
    expect(shouldAdvanceOnComplete({ status: "cancelled" })).toBe(false);
  });

  // CompleteOutcome is an open `{ status: string }`, so this is reachable.
  // Staying is the safe default: advancing on an outcome nobody can name would
  // let the user past the gate for an unknown reason.
  it("does NOT advance on an unrecognised status", () => {
    expect(shouldAdvanceOnComplete({ status: "error" })).toBe(false);
    expect(shouldAdvanceOnComplete({ status: "something-new" })).toBe(false);
  });

  // A Stripe Payment Link purchase resolves "pending", which means
  // UNCONFIRMED. Advancing would grant access for a payment that may never
  // complete — which is also why the Studio editor warns that a Stripe paywall
  // on a gated step needs an `onPending` branch.
  it("does NOT advance on pending — unconfirmed is not paid", () => {
    expect(shouldAdvanceOnComplete({ status: "pending" })).toBe(false);
  });
});
