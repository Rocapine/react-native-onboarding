import { describe, expect, it } from "vitest";
import { stripeLinkProductProvider } from "../stripeLink";
import type { ProductRef } from "../../types";

const YEARLY: ProductRef = {
  key: "yearly",
  ios: "pro_yearly_ios",
  stripe: {
    paymentLink: "https://buy.stripe.com/test_yearly",
    priceId: "price_123",
    amount: 79,
    currency: "USD",
    periodIso: "P1Y",
    trialDays: 7,
  },
};

const STORE_ONLY: ProductRef = { key: "monthly", ios: "pro_monthly_ios" };

const harness = (over: Partial<Parameters<typeof stripeLinkProductProvider>[0]> = {}) => {
  const opened: string[] = [];
  const provider = stripeLinkProductProvider({
    clientReferenceId: () => "rc_user_1",
    openUrl: (url) => void opened.push(url),
    ...over,
  });
  return { provider, opened };
};

describe("stripeLinkProductProvider.getProducts", () => {
  it("synthesises a ResolvedProduct from the ref, with no network call", async () => {
    const { provider } = harness();
    const [p] = await provider.getProducts([YEARLY]);
    expect(p.key).toBe("yearly");
    expect(p.store).toBe("stripe");
    expect(p.productId).toBe("price_123");
    expect(p.priceAmount).toBe(79);
    expect(p.currencyCode).toBe("USD");
    expect(p.periodIso).toBe("P1Y");
    expect(p.period).toBe("year");
    expect(p.periodCount).toBe(1);
    expect(p.trial).toEqual({ period: "week", periodCount: 1, days: 7 });
  });

  it("formats price in the product's currency", async () => {
    const { provider } = harness();
    const [p] = await provider.getProducts([YEARLY]);
    // Exact glyph placement is Intl's business; assert the part we control.
    expect(p.price).toContain("79");
  });

  it("falls back to the payment link as productId when priceId is absent", async () => {
    const { provider } = harness();
    const ref: ProductRef = { key: "k", stripe: { paymentLink: "https://buy.stripe.com/x", amount: 1, currency: "USD" } };
    const [p] = await provider.getProducts([ref]);
    expect(p.productId).toBe("https://buy.stripe.com/x");
  });

  it("drops refs with no stripe block, exactly as the store adapters drop refs with no platform id", async () => {
    const { provider } = harness();
    expect(await provider.getProducts([STORE_ONLY])).toEqual([]);
    expect((await provider.getProducts([YEARLY, STORE_ONLY])).map((p) => p.key)).toEqual(["yearly"]);
  });

  it("omits trial when trialDays is absent or zero", async () => {
    const { provider } = harness();
    const [p] = await provider.getProducts([
      { key: "k", stripe: { paymentLink: "https://buy.stripe.com/x", amount: 1, currency: "USD", trialDays: 0 } },
    ]);
    expect(p.trial).toBeUndefined();
  });
});

describe("stripeLinkProductProvider.purchase", () => {
  it("opens the link with client_reference_id and resolves pending", async () => {
    const { provider, opened } = harness();
    const [p] = await provider.getProducts([YEARLY]);
    const result = await provider.purchase(p);
    expect(result).toEqual({ status: "pending" });
    expect(opened).toHaveLength(1);
    const url = new URL(opened[0]);
    expect(url.origin + url.pathname).toBe("https://buy.stripe.com/test_yearly");
    expect(url.searchParams.get("client_reference_id")).toBe("rc_user_1");
  });

  it("adds prefilled_email when configured", async () => {
    const { provider, opened } = harness({ prefilledEmail: () => "a@b.com" });
    const [p] = await provider.getProducts([YEARLY]);
    await provider.purchase(p);
    expect(new URL(opened[0]).searchParams.get("prefilled_email")).toBe("a@b.com");
  });

  it("omits client_reference_id rather than sending the string 'null'", async () => {
    const { provider, opened } = harness({ clientReferenceId: () => null });
    const [p] = await provider.getProducts([YEARLY]);
    await provider.purchase(p);
    expect(new URL(opened[0]).searchParams.has("client_reference_id")).toBe(false);
  });

  it("preserves query parameters already on the payment link", async () => {
    const { provider, opened } = harness();
    const [p] = await provider.getProducts([
      { key: "k", stripe: { paymentLink: "https://buy.stripe.com/x?locale=fr", amount: 1, currency: "USD" } },
    ]);
    await provider.purchase(p);
    const url = new URL(opened[0]);
    expect(url.searchParams.get("locale")).toBe("fr");
    expect(url.searchParams.get("client_reference_id")).toBe("rc_user_1");
  });

  it("errors for a product it never resolved, instead of opening nothing silently", async () => {
    const { provider, opened } = harness();
    const result = await provider.purchase({
      key: "ghost", productId: "x", store: "stripe", title: "", description: "",
      price: "", priceAmount: 0, currencyCode: "USD", period: null, periodCount: 0, periodIso: null,
    });
    expect(result.status).toBe("error");
    expect(opened).toHaveLength(0);
  });

  it("resolves status: error (never rejects) for a malformed payment link", async () => {
    const { provider, opened } = harness();
    const [p] = await provider.getProducts([
      { key: "k", stripe: { paymentLink: "not a url", amount: 1, currency: "USD" } },
    ]);
    const result = await provider.purchase(p);
    expect(result.status).toBe("error");
    expect(opened).toHaveLength(0);
  });

  it("does not serve a stale link once a key's stripe block is dropped from the catalog", async () => {
    const { provider, opened } = harness();
    const ref: ProductRef = { key: "k", stripe: { paymentLink: "https://buy.stripe.com/x", amount: 1, currency: "USD" } };
    const [p] = await provider.getProducts([ref]);
    // Re-authored off Stripe billing: the same key, now with no stripe block.
    await provider.getProducts([{ key: "k" }]);
    const result = await provider.purchase(p);
    expect(result.status).toBe("error");
    expect(opened).toHaveLength(0);
  });
});

describe("stripeLinkProductProvider.restore", () => {
  it("errors by default rather than reporting nothing_to_restore", async () => {
    const { provider } = harness();
    const result = await provider.restore();
    // `nothing_to_restore` would make a Restore button silently do nothing.
    expect(result.status).toBe("error");
  });

  it("delegates when the host supplies a restore implementation", async () => {
    const { provider } = harness({ restore: async () => ({ status: "restored", entitlements: ["pro"] }) });
    expect(await provider.restore()).toEqual({ status: "restored", entitlements: ["pro"] });
  });
});
