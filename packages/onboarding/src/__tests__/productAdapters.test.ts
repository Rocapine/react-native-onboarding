import { describe, it, expect, vi } from "vitest";
import type { ProductRef, ResolvedProduct } from "../products/types";

// Neither react-native-purchases nor expo-iap is a dependency of this repo —
// their absence IS the condition under test (not simulated). Mirrors the
// `react-native` mock getOnboarding.query.test.ts already uses for the same
// import, so `Platform` resolves without pulling in real react-native.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

const REF: ProductRef = { key: "yearly", ios: "com.app.yearly" };

const FAKE_PRODUCT: ResolvedProduct = {
  key: "yearly",
  productId: "com.app.yearly",
  store: "app_store",
  title: "Yearly",
  description: "",
  price: "$59.99",
  priceAmount: 59.99,
  currencyCode: "USD",
  period: "year",
  periodCount: 1,
  periodIso: "P1Y",
};

describe("revenueCatProductProvider — degrades cleanly when react-native-purchases is absent", () => {
  it("importing the module and calling the factory do not throw", async () => {
    const { revenueCatProductProvider } = await import("../products/adapters/revenueCat");
    expect(() => revenueCatProductProvider()).not.toThrow();
  });

  it("defers the missing-dependency error to call time, and names the missing package", async () => {
    const { revenueCatProductProvider } = await import("../products/adapters/revenueCat");
    const provider = revenueCatProductProvider();
    await expect(provider.getProducts([REF])).rejects.toThrow(
      /react-native-purchases is not installed/
    );
    await expect(provider.purchase(FAKE_PRODUCT)).rejects.toThrow(
      /react-native-purchases is not installed/
    );
    await expect(provider.restore()).rejects.toThrow(/react-native-purchases is not installed/);
  });
});

describe("expoIapProductProvider — degrades cleanly when expo-iap is absent", () => {
  it("importing the module and calling the factory do not throw", async () => {
    const { expoIapProductProvider } = await import("../products/adapters/expoIap");
    expect(() => expoIapProductProvider()).not.toThrow();
  });

  it("defers the missing-dependency error to call time, and names the missing package", async () => {
    const { expoIapProductProvider } = await import("../products/adapters/expoIap");
    const provider = expoIapProductProvider();
    await expect(provider.getProducts([REF])).rejects.toThrow(/expo-iap is not installed/);
    await expect(provider.purchase(FAKE_PRODUCT)).rejects.toThrow(/expo-iap is not installed/);
    await expect(provider.restore()).rejects.toThrow(/expo-iap is not installed/);
  });
});
