import { describe, it, expect } from "vitest";
import { resolvePaywallStepDecision } from "../resolvePaywallStepDecision";

type FakePaywall = { id: string };

const base = {
  isProviderMounted: true,
  catalogStatus: "ready",
  moment: "onboarding_end",
};
const withMoment = { paywalls: { onboarding_end: { id: "pw-1" } as FakePaywall } };
const withoutMoment = { paywalls: {} as Record<string, FakePaywall> };

describe("resolvePaywallStepDecision", () => {
  it("shows the paywall the moment resolved to", () => {
    expect(resolvePaywallStepDecision({ ...base, catalog: withMoment })).toEqual({
      type: "show",
      paywall: { id: "pw-1" },
    });
  });

  // No provider must WIN over catalogStatus. EMPTY_PAYWALL_CONTEXT reports
  // "loading" forever, so checking status first would spin forever — the exact
  // confusion `isProviderMounted` was added to prevent.
  it("reports no-provider even though the status says loading", () => {
    expect(
      resolvePaywallStepDecision({
        ...base,
        isProviderMounted: false,
        catalogStatus: "loading",
        catalog: null,
      }),
    ).toEqual({ type: "no-provider" });
  });

  it("waits while a first load is in flight", () => {
    expect(
      resolvePaywallStepDecision({ ...base, catalogStatus: "loading", catalog: null }),
    ).toEqual({ type: "loading" });
  });

  // A background revalidation may be about to deliver this very moment.
  // Skipping here would lose a sale to a race.
  it("waits — does NOT skip — when revalidating without the moment", () => {
    expect(
      resolvePaywallStepDecision({
        ...base,
        catalogStatus: "revalidating",
        catalog: withoutMoment,
      }),
    ).toEqual({ type: "loading" });
  });

  // Conversely, a paywall already in hand renders straight away during a
  // background revalidation rather than flashing a spinner.
  it("shows an already-resolved paywall even while revalidating", () => {
    expect(
      resolvePaywallStepDecision({ ...base, catalogStatus: "revalidating", catalog: withMoment }),
    ).toEqual({ type: "show", paywall: { id: "pw-1" } });
  });

  it("reports unknown-moment once the catalog has settled without it", () => {
    expect(resolvePaywallStepDecision({ ...base, catalog: withoutMoment })).toEqual({
      type: "unknown-moment",
    });
  });

  it("reports unknown-moment on a settled error, rather than waiting forever", () => {
    expect(
      resolvePaywallStepDecision({ ...base, catalogStatus: "error", catalog: null }),
    ).toEqual({ type: "unknown-moment" });
  });

  it("treats a null catalog under a mounted provider as still loading", () => {
    expect(
      resolvePaywallStepDecision({ ...base, catalogStatus: "loading", catalog: null }),
    ).toEqual({ type: "loading" });
  });

  // The catalog is open wire data; a malformed `paywalls` must not throw on the
  // way past, for the same reason every other reader of it is total.
  it("tolerates a catalog with no paywalls object at all", () => {
    expect(
      resolvePaywallStepDecision({
        ...base,
        catalog: {} as unknown as { paywalls: Record<string, FakePaywall> },
      }),
    ).toEqual({ type: "unknown-moment" });
  });
});
