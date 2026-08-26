import { describe, expect, it, vi } from "vitest";

// The adapter imports `Platform` from react-native, whose entry point is Flow
// and cannot be parsed by vitest's transformer. Same one-line stub every other
// react-native-touching test in this package uses.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { expoIapProductProvider } from "../expoIap";
import type { ProductRef } from "../../types";

// The adapter resolves ids by platform and vitest runs the iOS branch of the
// `react-native` Platform shim, so every ref here carries `ios`.
const YEARLY: ProductRef = { key: "yearly", ios: "pro_yearly" };
const LIFETIME: ProductRef = { key: "lifetime", ios: "pro_lifetime" };

// A subscription as expo-iap 5.x actually reports it: the period is SPLIT into
// a unit and a stringly count, and there is no `subscriptionPeriodISO` at all.
const iap5Yearly = {
  id: "pro_yearly",
  type: "subs",
  title: "Pro Yearly",
  description: "Best value",
  displayPrice: "$59.99",
  price: 59.99,
  currency: "USD",
  subscriptionPeriodUnitIOS: "year",
  subscriptionPeriodNumberIOS: "1",
};

const iap5Lifetime = {
  id: "pro_lifetime",
  type: "in-app",
  title: "Lifetime",
  description: "One time",
  displayPrice: "$119.99",
  price: 119.99,
  currency: "USD",
};

const mock5 = (over: Record<string, any> = {}) => ({
  initConnection: vi.fn().mockResolvedValue(true),
  fetchProducts: vi.fn().mockResolvedValue([iap5Yearly, iap5Lifetime]),
  requestPurchase: vi.fn().mockResolvedValue(null),
  finishTransaction: vi.fn().mockResolvedValue(undefined),
  getAvailablePurchases: vi.fn().mockResolvedValue([]),
  ...over,
});

describe("expoIapProductProvider — expo-iap 5.x API", () => {
  it("calls fetchProducts, not the removed getProducts", async () => {
    // 5.x deleted `getProducts`; calling it threw "M.getProducts is not a
    // function" and every product silently failed to resolve. A mock with NO
    // getProducts is what pins that.
    const M = mock5();
    const products = await expoIapProductProvider(M).getProducts([YEARLY, LIFETIME]);
    expect(M.fetchProducts).toHaveBeenCalledWith({ skus: ["pro_yearly", "pro_lifetime"], type: "all" });
    expect(products.map((p) => p.key)).toEqual(["yearly", "lifetime"]);
    expect(products[0].price).toBe("$59.99");
  });

  it("opens the store connection before querying, exactly once", async () => {
    const M = mock5();
    const provider = expoIapProductProvider(M);
    await provider.getProducts([YEARLY]);
    await provider.getProducts([YEARLY]);
    await provider.restore();
    expect(M.initConnection).toHaveBeenCalledTimes(1);
  });

  it("retries the connection after a failed one instead of replaying the rejection", async () => {
    // A first call while offline must not poison the provider for the session.
    const initConnection = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(true);
    const M = mock5({ initConnection });
    const provider = expoIapProductProvider(M);
    await expect(provider.getProducts([YEARLY])).rejects.toThrow("offline");
    await expect(provider.getProducts([YEARLY])).resolves.toHaveLength(1);
    expect(initConnection).toHaveBeenCalledTimes(2);
  });

  it("derives periodIso from the split iOS fields", async () => {
    // The whole point: `periodIso` feeds deriveProductFields, so a null here
    // removes pricePerWeek/pricePerMonth/savingsPct rather than degrading them.
    const [yearly, lifetime] = await expoIapProductProvider(mock5()).getProducts([YEARLY, LIFETIME]);
    expect(yearly.periodIso).toBe("P1Y");
    expect(yearly.period).toBe("year");
    expect(yearly.periodCount).toBe(1);
    // A one-off product has no period at all — not "P1Y" by accident.
    expect(lifetime.periodIso).toBeNull();
    expect(lifetime.period).toBeNull();
  });

  it("defaults a missing period count to 1, never 0", async () => {
    // StoreKit omits the count for a single-unit period. "P0M" would make every
    // derived per-unit price divide by zero.
    const M = mock5({
      fetchProducts: vi.fn().mockResolvedValue([
        { ...iap5Yearly, subscriptionPeriodUnitIOS: "month", subscriptionPeriodNumberIOS: undefined },
      ]),
    });
    const [p] = await expoIapProductProvider(M).getProducts([YEARLY]);
    expect(p.periodIso).toBe("P1M");
  });

  it("reads the Android billing period out of the first pricing phase", async () => {
    const M = mock5({
      fetchProducts: vi.fn().mockResolvedValue([
        {
          id: "pro_yearly",
          type: "subs",
          displayPrice: "$59.99",
          price: 59.99,
          currency: "USD",
          subscriptionOffers: [
            { pricingPhasesAndroid: { pricingPhaseList: [{ billingPeriod: "P1Y" }] } },
          ],
        },
      ]),
    });
    const [p] = await expoIapProductProvider(M).getProducts([YEARLY]);
    expect(p.periodIso).toBe("P1Y");
  });

  it("still honours a pre-5.x product that publishes the ISO period directly", async () => {
    const M = mock5({
      fetchProducts: vi
        .fn()
        .mockResolvedValue([{ ...iap5Yearly, subscriptionPeriodISO: "P6M", subscriptionPeriodUnitIOS: "year" }]),
    });
    const [p] = await expoIapProductProvider(M).getProducts([YEARLY]);
    expect(p.periodIso).toBe("P6M");
  });

  it("falls back to the legacy getProducts when fetchProducts is absent", async () => {
    // A host pinned to expo-iap ≤4 must keep working.
    const getProducts = vi.fn().mockResolvedValue([{ ...iap5Yearly, subscriptionPeriodISO: "P1Y" }]);
    const M = { getProducts, requestPurchase: vi.fn(), getAvailablePurchases: vi.fn() };
    const [p] = await expoIapProductProvider(M).getProducts([YEARLY]);
    expect(getProducts).toHaveBeenCalledWith(["pro_yearly"]);
    expect(p.periodIso).toBe("P1Y");
  });
});

describe("expoIapProductProvider — purchase", () => {
  const resolved = async (M: any) => (await expoIapProductProvider(M).getProducts([YEARLY]))[0];

  it("sends the per-platform request shape with the subscription type", async () => {
    // The old flat `{ request: { sku } }` reached neither platform branch, so
    // StoreKit received an undefined sku.
    const M = mock5({ requestPurchase: vi.fn().mockResolvedValue({ id: "tx" }) });
    const provider = expoIapProductProvider(M);
    const product = (await provider.getProducts([YEARLY]))[0];
    await provider.purchase(product);
    expect(M.requestPurchase).toHaveBeenCalledWith({
      request: { ios: { sku: "pro_yearly" }, android: { skus: ["pro_yearly"] } },
      type: "subs",
    });
  });

  it("sends type in-app for a one-off product", async () => {
    const M = mock5({ requestPurchase: vi.fn().mockResolvedValue({ id: "tx" }) });
    const provider = expoIapProductProvider(M);
    const product = (await provider.getProducts([LIFETIME]))[0];
    await provider.purchase(product);
    expect(M.requestPurchase.mock.calls[0][0].type).toBe("in-app");
  });

  it("resolves pending — not purchased — when requestPurchase resolves null", async () => {
    // The normal 5.x outcome: the transaction arrives via purchaseUpdatedListener,
    // so nothing is confirmed yet. Reporting "purchased" granted access for a
    // purchase that may still fail.
    const M = mock5({ requestPurchase: vi.fn().mockResolvedValue(null) });
    const provider = expoIapProductProvider(M);
    const product = (await provider.getProducts([YEARLY]))[0];
    expect(await provider.purchase(product)).toEqual({ status: "pending" });
    expect(M.finishTransaction).not.toHaveBeenCalled();
  });

  it("finishes the transaction when one comes back", async () => {
    // Unfinished transactions are re-delivered by StoreKit on every launch.
    const purchase = { id: "tx-1" };
    const M = mock5({ requestPurchase: vi.fn().mockResolvedValue(purchase) });
    const provider = expoIapProductProvider(M);
    const product = (await provider.getProducts([YEARLY]))[0];
    expect(await provider.purchase(product)).toEqual({ status: "purchased", productKey: "yearly" });
    expect(M.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: false });
  });

  it("still reports purchased when finishing throws", async () => {
    // A finish failure does not un-buy anything; it must not become an error.
    const M = mock5({
      requestPurchase: vi.fn().mockResolvedValue({ id: "tx-1" }),
      finishTransaction: vi.fn().mockRejectedValue(new Error("finish failed")),
    });
    const provider = expoIapProductProvider(M);
    const product = (await provider.getProducts([YEARLY]))[0];
    expect(await provider.purchase(product)).toEqual({ status: "purchased", productKey: "yearly" });
  });

  it("maps a user cancellation to cancelled, not error", async () => {
    const M = mock5({
      requestPurchase: vi.fn().mockRejectedValue({ code: "E_USER_CANCELLED" }),
    });
    const provider = expoIapProductProvider(M);
    const product = (await provider.getProducts([YEARLY]))[0];
    expect(await provider.purchase(product)).toEqual({ status: "cancelled" });
  });
});
