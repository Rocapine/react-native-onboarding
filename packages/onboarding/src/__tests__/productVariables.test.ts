import { describe, it, expect } from "vitest";
import { productVariables } from "../products/toVariables";
import type { ProductWithDerived } from "../products/types";

const yearly: ProductWithDerived = {
  key: "yearly",
  productId: "com.app.yearly",
  store: "app_store",
  title: "Yearly Plan",
  description: "A year",
  price: "$59.99",
  priceAmount: 59.99,
  currencyCode: "USD",
  period: "year",
  periodCount: 1,
  periodIso: "P1Y",
  pricePerWeek: "$1.15",
  pricePerWeekAmount: 1.1504,
  savingsPct: 51,
  trialDays: 7,
};

// Every optional field populated, so the dotted-key test below catches both a
// typo in an emitted key and an accidentally-dropped field.
const complete: ProductWithDerived = {
  ...yearly,
  key: "complete",
  productId: "com.app.complete",
  pricePerMonth: "$4.93",
  pricePerMonthAmount: 4.9307,
  pricePerYear: "$59.99",
  pricePerYearAmount: 59.99,
  introOffer: { price: "$0.99", priceAmount: 0.99, period: "month", periodCount: 1, cycles: 1 },
};

describe("productVariables", () => {
  it("emits flat dotted keys the interpolator can resolve", () => {
    const v = productVariables({ products: { yearly }, status: "ready", purchasing: false });
    expect(v["product.yearly.price"].value).toBe("$59.99");
    expect(v["product.yearly.pricePerWeek"].value).toBe("$1.15");
    expect(v["product.yearly.savingsPct"].value).toBe("51");
    expect(v["product.yearly.trialDays"].value).toBe("7");
    expect(v["product.yearly.title"].value).toBe("Yearly Plan");
    expect(v["product.yearly.period"].value).toBe("year");
  });

  it("stringifies every value — the variable bag is string-based", () => {
    const v = productVariables({ products: { yearly }, status: "ready", purchasing: false });
    for (const entry of Object.values(v)) {
      expect(typeof entry.value).toBe("string");
    }
  });

  it("emits the complete set of dotted keys for a fully-populated product", () => {
    const v = productVariables({ products: { complete }, status: "ready", purchasing: false });
    expect(Object.keys(v).sort()).toEqual(
      [
        "product.complete.productId",
        "product.complete.title",
        "product.complete.description",
        "product.complete.price",
        "product.complete.priceAmount",
        "product.complete.currencyCode",
        "product.complete.period",
        "product.complete.periodCount",
        "product.complete.pricePerWeek",
        "product.complete.pricePerWeekAmount",
        "product.complete.pricePerMonth",
        "product.complete.pricePerMonthAmount",
        "product.complete.pricePerYear",
        "product.complete.pricePerYearAmount",
        "product.complete.savingsPct",
        "product.complete.trialDays",
        "product.complete.introPrice",
        "products.loaded",
        "products.purchasing",
        "products.error",
      ].sort()
    );
  });

  it("omits absent optional fields rather than emitting empty strings", () => {
    const bare = { ...yearly, savingsPct: undefined, trialDays: undefined };
    const v = productVariables({ products: { yearly: bare }, status: "ready", purchasing: false });
    expect(v["product.yearly.savingsPct"]).toBeUndefined();
    expect(v["product.yearly.trialDays"]).toBeUndefined();
  });

  it("publishes status flags authors gate the CTA on", () => {
    const ready = productVariables({ products: {}, status: "ready", purchasing: false });
    expect(ready["products.loaded"].value).toBe("true");
    expect(ready["products.purchasing"].value).toBe("false");
    expect(ready["products.error"].value).toBe("");

    const failed = productVariables({
      products: {},
      status: "error",
      error: "network down",
      purchasing: false,
    });
    expect(failed["products.loaded"].value).toBe("false");
    expect(failed["products.error"].value).toBe("network down");
  });

  it("reports loaded=false while still loading", () => {
    const v = productVariables({ products: {}, status: "loading", purchasing: false });
    expect(v["products.loaded"].value).toBe("false");
  });
});
