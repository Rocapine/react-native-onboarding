import { describe, it, expect } from "vitest";
import { parseIsoDuration } from "../products/duration";
import { formatCurrency, deriveProductFields, deriveAll } from "../products/derive";
import type { ResolvedProduct, ProductRef } from "../products/types";

const make = (over: Partial<ResolvedProduct> = {}): ResolvedProduct => ({
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
  ...over,
});

describe("parseIsoDuration", () => {
  it("parses the store-standard periods to days", () => {
    expect(parseIsoDuration("P1W")).toBe(7);
    expect(parseIsoDuration("P1M")).toBe(30);
    expect(parseIsoDuration("P3M")).toBe(90);
    expect(parseIsoDuration("P6M")).toBe(180);
    expect(parseIsoDuration("P1Y")).toBe(365);
    expect(parseIsoDuration("P7D")).toBe(7);
  });

  it("returns null for junk rather than guessing", () => {
    expect(parseIsoDuration("")).toBeNull();
    expect(parseIsoDuration("1Y")).toBeNull();
    expect(parseIsoDuration("PT1H")).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("formats in the product's currency, not the device's", () => {
    expect(formatCurrency(1.15, "USD", "en-US")).toBe("$1.15");
  });

  it("falls back to a plain amount+code string when Intl rejects the currency code", () => {
    // "XYZ" is syntactically valid (3 letters) and Intl accepts it even though it's
    // not a real currency, so it never exercises the catch branch. "ZZZZZZ" is the
    // wrong shape and Intl genuinely throws on it.
    expect(formatCurrency(5, "ZZZZZZ", "en-US")).toBe("5.00 ZZZZZZ");
  });
});

describe("deriveProductFields", () => {
  it("computes per-period prices from the ISO period", () => {
    const d = deriveProductFields(make(), { locale: "en-US" });
    // 59.99 / (365/7) weeks
    expect(d.pricePerWeekAmount).toBeCloseTo(1.1504, 3);
    expect(d.pricePerWeek).toBe("$1.15");
    expect(d.pricePerMonthAmount).toBeCloseTo(4.9307, 3);
  });

  it("leaves savingsPct undefined without a compareTo", () => {
    expect(deriveProductFields(make(), { locale: "en-US" }).savingsPct).toBeUndefined();
  });

  it("computes savingsPct against a normalized per-day comparison", () => {
    const yearly = make();                                     // 59.99 / 365d
    const monthly = make({ key: "monthly", priceAmount: 9.99, periodIso: "P1M" }); // 9.99 / 30d
    const d = deriveProductFields(yearly, { compareTo: monthly, locale: "en-US" });
    // yearly/day = 0.16436, monthly/day = 0.333 → ~51% cheaper
    expect(d.savingsPct).toBe(51);
  });

  it("omits savingsPct when the comparison is not cheaper", () => {
    const a = make({ priceAmount: 400 });
    const b = make({ key: "monthly", priceAmount: 9.99, periodIso: "P1M" });
    expect(deriveProductFields(a, { compareTo: b }).savingsPct).toBeUndefined();
  });

  it("derives trialDays from the trial period", () => {
    const p = make({ trial: { period: "week", periodCount: 1, days: 0 } });
    expect(deriveProductFields(p).trialDays).toBe(7);
  });

  it("returns no per-period prices when the period is unparseable", () => {
    const d = deriveProductFields(make({ periodIso: null, period: null }));
    expect(d.pricePerWeek).toBeUndefined();
    expect(d.pricePerWeekAmount).toBeUndefined();
  });
});

describe("deriveAll", () => {
  const refs: ProductRef[] = [
    { key: "yearly", ios: "com.app.yearly", compareTo: "monthly" },
    { key: "monthly", ios: "com.app.monthly" },
  ];

  it("keys results by ref key and resolves compareTo between them", () => {
    const products = [
      make(),
      make({ key: "monthly", priceAmount: 9.99, periodIso: "P1M", period: "month" }),
    ];
    const out = deriveAll(products, refs, "en-US");
    expect(Object.keys(out).sort()).toEqual(["monthly", "yearly"]);
    expect(out.yearly.savingsPct).toBe(51);
    expect(out.monthly.savingsPct).toBeUndefined();
  });

  it("ignores a compareTo pointing at a missing key", () => {
    const out = deriveAll([make()], [{ key: "yearly", compareTo: "nope" }], "en-US");
    expect(out.yearly.savingsPct).toBeUndefined();
  });
});
