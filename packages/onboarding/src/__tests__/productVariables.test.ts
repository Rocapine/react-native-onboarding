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
