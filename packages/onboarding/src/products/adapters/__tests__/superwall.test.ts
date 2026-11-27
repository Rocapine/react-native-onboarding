import { describe, expect, it, vi } from "vitest";

// The adapter imports `Platform` from react-native, whose entry point is Flow
// and cannot be parsed by vitest's transformer. Same stub as the other adapters.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { superwallProductProvider } from "../superwall";
import type { ProductRef } from "../../types";

const YEARLY: ProductRef = { key: "yearly", ios: "pro_yearly" };
const MONTHLY: ProductRef = { key: "monthly", ios: "pro_monthly" };
const LIFETIME: ProductRef = { key: "lifetime", ios: "pro_lifetime" };

// Shapes follow expo-superwall's `ProductResponse` (src/SuperwallExpoModule.types.ts, v1.9.0).
const swYearly = {
  productIdentifier: "pro_yearly",
  localizedPrice: "$59.99",
  price: 59.99,
  currencyCode: "USD",
  subscriptionPeriod: { value: 1, unit: "year" },
  periodYears: 1,
  periodMonths: 12,
  periodWeeks: 52,
  periodDays: 365,
  hasFreeTrial: true,
  trialPeriodPrice: 0,
  trialPeriodDays: 7,
  trialPeriodWeeks: 1,
  trialPeriodMonths: 0,
  trialPeriodYears: 0,
};
// No `subscriptionPeriod` object: the adapter falls back to the per-unit counts.
const swMonthly = {
  productIdentifier: "pro_monthly",
  localizedPrice: "$9.99",
  price: 9.99,
  currencyCode: "USD",
  subscriptionPeriod: null,
  periodYears: 0,
  periodMonths: 1,
  periodWeeks: 4,
  periodDays: 30,
  hasFreeTrial: false,
  trialPeriodDays: 0,
};
const swLifetime = {
  productIdentifier: "pro_lifetime",
  localizedPrice: "$119.99",
  price: 119.99,
  currencyCode: "USD",
  subscriptionPeriod: null,
  periodYears: 0,
  periodMonths: 0,
  periodWeeks: 0,
  periodDays: 0,
  hasFreeTrial: false,
  trialPeriodDays: 0,
};

const fakeSuperwall = (over: Record<string, any> = {}, shared: Record<string, any> = {}) => {
  const instance = {
    restorePurchases: vi.fn().mockResolvedValue({ result: "restored" }),
    getEntitlements: vi.fn().mockResolvedValue({ active: [{ id: "pro" }], inactive: [] }),
    ...shared,
  };
  return {
    products: vi.fn().mockResolvedValue([swYearly, swMonthly, swLifetime]),
    purchase: vi.fn().mockResolvedValue({ type: "purchased" }),
    shared: instance,
    ...over,
  };
};

describe("superwallProductProvider — getProducts", () => {
  it("asks Superwall for the platform ids and maps price, period and trial", async () => {
    const SW = fakeSuperwall();
    const [yearly] = await superwallProductProvider(SW).getProducts([YEARLY]);

    expect(SW.products).toHaveBeenCalledWith(["pro_yearly"]);
    expect(yearly).toMatchObject({
      key: "yearly",
      productId: "pro_yearly",
      store: "app_store",
      price: "$59.99",
      priceAmount: 59.99,
      currencyCode: "USD",
      period: "year",
      periodCount: 1,
      periodIso: "P1Y",
      trial: { period: "week", periodCount: 1, days: 7 },
    });
  });

  it("does not report a PAID intro offer as a free trial", async () => {
    // Superwall sets hasFreeTrial for any intro offer; only the price tells them apart.
    const paidIntro = { ...swYearly, hasFreeTrial: true, trialPeriodPrice: 0.99, trialPeriodDays: 30, trialPeriodMonths: 1 };
    const SW = fakeSuperwall({ products: vi.fn().mockResolvedValue([paidIntro]) });
    const [yearly] = await superwallProductProvider(SW).getProducts([YEARLY]);
    expect(yearly.trial).toBeUndefined();
  });

  it("falls back to the per-unit counts when subscriptionPeriod is absent", async () => {
    const [monthly] = await superwallProductProvider(fakeSuperwall()).getProducts([MONTHLY]);
    expect(monthly).toMatchObject({ period: "month", periodCount: 1, periodIso: "P1M" });
    expect(monthly.trial).toBeUndefined();
  });

  it("reports a non-subscription with no period", async () => {
    const [lifetime] = await superwallProductProvider(fakeSuperwall()).getProducts([LIFETIME]);
    expect(lifetime).toMatchObject({ period: null, periodCount: 0, periodIso: null });
  });

  it("drops refs with no id for this platform or unknown to the store", async () => {
    const SW = fakeSuperwall();
    const out = await superwallProductProvider(SW).getProducts([
      { key: "android_only", android: "x:y" },
      { key: "ghost", ios: "nope" },
      YEARLY,
    ]);
    expect(SW.products).toHaveBeenCalledWith(["nope", "pro_yearly"]);
    expect(out.map((p) => p.key)).toEqual(["yearly"]);
  });

  it("matches a product reported under its full identifier", async () => {
    const SW = fakeSuperwall({
      products: vi.fn().mockResolvedValue([{ ...swYearly, productIdentifier: "pro", fullIdentifier: "pro_yearly" }]),
    });
    const out = await superwallProductProvider(SW).getProducts([YEARLY]);
    expect(out[0]?.productId).toBe("pro_yearly");
  });

  it("makes no call when no ref has an id", async () => {
    const SW = fakeSuperwall();
    expect(await superwallProductProvider(SW).getProducts([{ key: "a" }])).toEqual([]);
    expect(SW.products).not.toHaveBeenCalled();
  });
});

describe("superwallProductProvider — purchase", () => {
  const product = { key: "yearly", productId: "pro_yearly" } as any;

  it.each([
    [{ type: "purchased" }, { status: "purchased", productKey: "yearly" }],
    [{ type: "cancelled" }, { status: "cancelled" }],
    [{ type: "pending" }, { status: "pending" }],
  ])("maps %o", async (sw, expected) => {
    const SW = fakeSuperwall({ purchase: vi.fn().mockResolvedValue(sw) });
    expect(await superwallProductProvider(SW).purchase(product)).toEqual(expected);
    expect(SW.purchase).toHaveBeenCalledWith("pro_yearly");
  });

  it("maps failed to an error carrying Superwall's message", async () => {
    const SW = fakeSuperwall({ purchase: vi.fn().mockResolvedValue({ type: "failed", error: "boom" }) });
    const r = await superwallProductProvider(SW).purchase(product);
    expect(r.status).toBe("error");
    expect(r.status === "error" && r.error.message).toBe("boom");
  });

  it("resolves an error rather than throwing when the bridge rejects", async () => {
    const SW = fakeSuperwall({ purchase: vi.fn().mockRejectedValue(new Error("bridge")) });
    const r = await superwallProductProvider(SW).purchase(product);
    expect(r).toMatchObject({ status: "error" });
  });
});

describe("superwallProductProvider — restore", () => {
  it("returns the active entitlements after a restore", async () => {
    expect(await superwallProductProvider(fakeSuperwall()).restore()).toEqual({
      status: "restored",
      entitlements: ["pro"],
    });
  });

  it("reports nothing_to_restore when no entitlement is active", async () => {
    const SW = fakeSuperwall({}, { getEntitlements: vi.fn().mockResolvedValue({ active: [], inactive: [] }) });
    expect(await superwallProductProvider(SW).restore()).toEqual({ status: "nothing_to_restore" });
  });

  it("maps a failed restore to an error", async () => {
    const SW = fakeSuperwall({}, {
      restorePurchases: vi.fn().mockResolvedValue({ result: "failed", errorMessage: "no network" }),
    });
    const r = await superwallProductProvider(SW).restore();
    expect(r.status === "error" && r.error.message).toBe("no network");
  });
});

describe("superwallProductProvider — expo-superwall missing", () => {
  it("throws a clear error at call time, not at import", async () => {
    const provider = superwallProductProvider(null);
    await expect(provider.getProducts([YEARLY])).rejects.toThrow(/expo-superwall/);
  });
});
