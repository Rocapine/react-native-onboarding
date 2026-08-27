import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRegisterDecision, shouldRunFeature, runRegister } from "../register";
import type { RegisterDeps } from "../register";
import type { PaywallCatalog } from "../types";

const paywall = {
  id: "pw1",
  name: "Main",
  moment: "unlock_stats",
  products: [],
  billing: "store",
} as any;
const catalog = { paywalls: { unlock_stats: paywall } } as unknown as PaywallCatalog;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("resolveRegisterDecision", () => {
  it("presents when the catalog holds the moment", () => {
    expect(resolveRegisterDecision(catalog, "ready", "unlock_stats")).toEqual({
      type: "present",
      paywall,
    });
  });

  it("runs the feature when a resolved catalog has no such moment", () => {
    expect(resolveRegisterDecision(catalog, "ready", "not_authored")).toEqual({
      type: "run",
      reason: "no-paywall",
    });
  });

  it("waits while the catalog is still loading", () => {
    expect(resolveRegisterDecision(null, "loading", "unlock_stats")).toEqual({ type: "wait" });
  });

  it("fails open when the catalog failed to load", () => {
    expect(resolveRegisterDecision(null, "error", "unlock_stats")).toEqual({
      type: "run",
      reason: "catalog-unavailable",
    });
  });

  it("treats a revalidating catalog as usable", () => {
    // Safe only because the disk cache key is now params-scoped: a served
    // catalog always matches the current params.
    expect(resolveRegisterDecision(catalog, "revalidating", "unlock_stats")).toEqual({
      type: "present",
      paywall,
    });
    expect(resolveRegisterDecision(catalog, "revalidating", "not_authored")).toEqual({
      type: "run",
      reason: "no-paywall",
    });
  });

  it("never returns wait once a catalog exists", () => {
    for (const status of ["loading", "ready", "revalidating", "error"] as const) {
      expect(resolveRegisterDecision(catalog, status, "unlock_stats").type).not.toBe("wait");
    }
  });
});

describe("shouldRunFeature", () => {
  it("runs only on a purchase", () => {
    expect(shouldRunFeature({ status: "purchased" })).toBe(true);
  });

  it("does not run on anything else", () => {
    // Also the Stripe case: a Payment Link purchase never resolves "purchased"
    // (the entitlement arrives out-of-band through RevenueCat), so the
    // presentation reports "dismissed" via its onPending branch.
    expect(shouldRunFeature({ status: "dismissed" })).toBe(false);
    expect(shouldRunFeature({ status: "cancelled" })).toBe(false);
    expect(shouldRunFeature({ status: "error", reason: "unknown-moment" })).toBe(false);
    expect(
      shouldRunFeature({ status: "error", reason: "already-presenting", activeMoment: "x" }),
    ).toBe(false);
  });
});

const deps = (over: Partial<RegisterDeps> = {}): RegisterDeps => ({
  getCatalog: () => catalog,
  getCatalogStatus: () => "ready",
  waitForCatalogSettled: async () => {},
  present: async () => ({ status: "dismissed" }),
  timeoutMs: 3000,
  ...over,
});

describe("runRegister", () => {
  it("runs the feature and never presents when the moment has no paywall", async () => {
    const present = vi.fn();
    const feature = vi.fn();
    const result = await runRegister(deps({ present }), "not_authored", feature);
    expect(present).not.toHaveBeenCalled();
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, presented: false, reason: "no-paywall" });
  });

  it("does not warn about a moment that simply is not monetised", async () => {
    await runRegister(deps(), "not_authored", vi.fn());
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("fails open when there is no catalog and it is not loading", async () => {
    const feature = vi.fn();
    const result = await runRegister(
      deps({ getCatalog: () => null, getCatalogStatus: () => "error" }),
      "unlock_stats",
      feature,
    );
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, presented: false, reason: "catalog-unavailable" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("unlock_stats"));
  });

  it("waits once, then decides against the settled catalog", async () => {
    let status: "loading" | "ready" = "loading";
    let current: PaywallCatalog | null = null;
    const waited = vi.fn();
    const present = vi.fn(async () => ({ status: "purchased" }) as const);
    const feature = vi.fn();

    const result = await runRegister(
      deps({
        getCatalog: () => current,
        getCatalogStatus: () => status,
        waitForCatalogSettled: async () => {
          waited();
          status = "ready";
          current = catalog;
        },
        present,
      }),
      "unlock_stats",
      feature,
    );

    expect(waited).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledWith("unlock_stats");
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ran: true,
      presented: true,
      reason: "purchased",
      outcome: { status: "purchased" },
    });
  });

  it("passes the configured timeout to the waiter", async () => {
    const waitForCatalogSettled = vi.fn(async () => {});
    await runRegister(
      deps({
        getCatalog: () => null,
        getCatalogStatus: () => "loading",
        waitForCatalogSettled,
        timeoutMs: 1234,
      }),
      "unlock_stats",
    );
    expect(waitForCatalogSettled).toHaveBeenCalledWith(1234);
  });

  it("fails open — and does not wait twice — when the wait times out still loading", async () => {
    const waitForCatalogSettled = vi.fn(async () => {});
    const feature = vi.fn();
    const result = await runRegister(
      deps({ getCatalog: () => null, getCatalogStatus: () => "loading", waitForCatalogSettled }),
      "unlock_stats",
      feature,
    );
    expect(waitForCatalogSettled).toHaveBeenCalledTimes(1);
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, presented: false, reason: "catalog-unavailable" });
  });

  it("presents and withholds the feature when the user does not buy", async () => {
    const feature = vi.fn();
    const result = await runRegister(
      deps({ present: async () => ({ status: "dismissed" }) }),
      "unlock_stats",
      feature,
    );
    expect(feature).not.toHaveBeenCalled();
    expect(result).toEqual({
      ran: false,
      presented: true,
      reason: "not-purchased",
      outcome: { status: "dismissed" },
    });
  });

  it("withholds the feature when another paywall is already presenting", async () => {
    const feature = vi.fn();
    const result = await runRegister(
      deps({
        present: async () => ({
          status: "error",
          reason: "already-presenting",
          activeMoment: "other",
        }),
      }),
      "unlock_stats",
      feature,
    );
    expect(feature).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
  });

  it("warns before presenting a Stripe paywall, whose purchase never unlocks", async () => {
    const stripeCatalog = {
      paywalls: { unlock_stats: { ...paywall, billing: "stripe" } },
    } as unknown as PaywallCatalog;
    const feature = vi.fn();
    const result = await runRegister(
      deps({
        getCatalog: () => stripeCatalog,
        // A Stripe checkout resolves the PURCHASE as "pending"; the
        // presentation itself closes as "dismissed" through its onPending
        // branch, so the feature is correctly withheld.
        present: async () => ({ status: "dismissed" }),
      }),
      "unlock_stats",
      feature,
    );
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Stripe"));
    expect(feature).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
  });

  it("does not warn about Stripe for a store-billed paywall", async () => {
    await runRegister(deps(), "unlock_stats", vi.fn());
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("awaits an async feature before resolving", async () => {
    const order: string[] = [];
    const result = await runRegister(
      deps({ present: async () => ({ status: "purchased" }) }),
      "unlock_stats",
      async () => {
        await new Promise((r) => setTimeout(r, 0));
        order.push("feature");
      },
    );
    order.push("resolved");
    expect(order).toEqual(["feature", "resolved"]);
    expect(result.ran).toBe(true);
  });

  it("works with no feature at all — register is also a plain gate check", async () => {
    const result = await runRegister(
      deps({ present: async () => ({ status: "purchased" }) }),
      "unlock_stats",
    );
    expect(result).toEqual({
      ran: true,
      presented: true,
      reason: "purchased",
      outcome: { status: "purchased" },
    });
  });
});
