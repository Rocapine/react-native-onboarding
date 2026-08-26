import { describe, expect, it } from "vitest";
import { productRefIdentity } from "../refIdentity";
import type { ProductRef } from "../types";

const STRIPE = {
  paymentLink: "https://buy.stripe.com/test_a",
  amount: 79,
  currency: "USD",
} as const;

describe("productRefIdentity", () => {
  it("distinguishes two refs that differ ONLY in their stripe block", () => {
    const a: ProductRef = { key: "yearly", stripe: { ...STRIPE } };
    const b: ProductRef = { key: "yearly", stripe: { ...STRIPE, paymentLink: "https://buy.stripe.com/test_b" } };
    expect(productRefIdentity(a)).not.toBe(productRefIdentity(b));
  });

  it("distinguishes a store-only ref from the same key with a stripe block", () => {
    expect(productRefIdentity({ key: "yearly", ios: "y_ios" })).not.toBe(
      productRefIdentity({ key: "yearly", ios: "y_ios", stripe: { ...STRIPE } }),
    );
  });

  it("is stable for two structurally equal refs", () => {
    expect(productRefIdentity({ key: "yearly", ios: "y_ios", stripe: { ...STRIPE } })).toBe(
      productRefIdentity({ key: "yearly", ios: "y_ios", stripe: { ...STRIPE } }),
    );
  });

  it("still separates the pre-existing store fields", () => {
    expect(productRefIdentity({ key: "k", ios: "a" })).not.toBe(productRefIdentity({ key: "k", ios: "b" }));
    expect(productRefIdentity({ key: "k", android: "a" })).not.toBe(productRefIdentity({ key: "k", android: "b" }));
    expect(productRefIdentity({ key: "k", compareTo: "a" })).not.toBe(
      productRefIdentity({ key: "k", compareTo: "b" }),
    );
  });

  it("does not collide across field boundaries", () => {
    // "a|b" split across two fields must not equal "a|b" in one.
    expect(productRefIdentity({ key: "k", ios: "a", android: "b" })).not.toBe(
      productRefIdentity({ key: "k", ios: "a|b" }),
    );
  });
});
