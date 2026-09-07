import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpoIap5 } from "./expoIap5Fake";
import type { ProductRef } from "../../types";

// `Platform` is read at CALL time by the adapter (`idFor`), so one mutable
// object serves both platform branches. Every test in the old suite ran under
// iOS only — including the one named "reads the Android billing period" — which
// is why the Android request branch was never exercised.
const rn = vi.hoisted(() => ({ Platform: { OS: "ios" as "ios" | "android" } }));
vi.mock("react-native", () => rn);

import { expoIapProductProvider } from "../expoIap";

const YEARLY_IOS: ProductRef = { key: "yearly", ios: "pro_yearly" };
const LIFETIME_IOS: ProductRef = { key: "lifetime", ios: "pro_lifetime" };
/** Play refs are authored `productId:basePlanId` — see ProductRef.android. */
const YEARLY_PLAY: ProductRef = { key: "yearly", android: "pro_yearly:annual" };

const iosYearly = {
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

const iosLifetime = {
  id: "pro_lifetime",
  type: "in-app",
  typeIOS: "non-consumable",
  title: "Lifetime",
  description: "One time",
  displayPrice: "$119.99",
  price: 119.99,
  currency: "USD",
};

/**
 * A Play subscription with a 1-week free trial in front of a yearly base plan —
 * the shape that made the old adapter report `periodIso: "P1W"` and a
 * `pricePerYear` of about $3,130 for a $59.99/year plan.
 */
const playYearly = {
  id: "pro_yearly",
  type: "subs",
  title: "Pro Yearly",
  description: "Best value",
  displayPrice: "$59.99",
  price: 59.99,
  currency: "USD",
  subscriptionOffers: [
    {
      id: "free-trial",
      basePlanIdAndroid: "annual",
      offerTokenAndroid: "tok-annual-trial",
      pricingPhasesAndroid: {
        pricingPhaseList: [
          // recurrenceMode 2 = FINITE_RECURRING (the trial), 1 = INFINITE_RECURRING
          { billingPeriod: "P1W", priceAmountMicros: "0", formattedPrice: "Free", recurrenceMode: 2 },
          {
            billingPeriod: "P1Y",
            priceAmountMicros: "59990000",
            formattedPrice: "$59.99",
            recurrenceMode: 1,
          },
        ],
      },
    },
    {
      id: "monthly-base",
      basePlanIdAndroid: "monthly",
      offerTokenAndroid: "tok-monthly",
      pricingPhasesAndroid: {
        pricingPhaseList: [
          {
            billingPeriod: "P1M",
            priceAmountMicros: "9990000",
            formattedPrice: "$9.99",
            recurrenceMode: 1,
          },
        ],
      },
    },
  ],
};

const platform = () => rn.Platform.OS;

beforeEach(() => {
  rn.Platform.OS = "ios";
  vi.restoreAllMocks();
});

describe("expoIapProductProvider — the payload expo-iap 5.x accepts", () => {
  it("completes an iOS purchase instead of throwing EmptySkuList", async () => {
    // #241 finding 1. `request: { ios, android }` reaches neither branch of
    // normalizeRequestProps, so 5.x rejects before the store is ever asked and
    // the user's Buy tap can only ever produce onError.
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(await provider.purchase(product)).toEqual({
      status: "purchased",
      productKey: "yearly",
    });
  });

  it("completes an Android purchase", async () => {
    rn.Platform.OS = "android";
    const M = makeExpoIap5({ catalog: [playYearly], platform });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_PLAY]);
    expect(await provider.purchase(product)).toEqual({
      status: "purchased",
      productKey: "yearly",
    });
  });

  it("sends apple/google and never the removed ios/android keys", async () => {
    // 4.x accepted `request.ios` with a deprecation warning; 5.0 deleted the
    // shim. One shape works on both, so there is nothing to version-probe.
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    await provider.purchase(product);
    const { request, type } = M.calls.requestPurchase[0];
    expect(request.apple).toEqual({ sku: "pro_yearly" });
    expect(request.google.skus).toEqual(["pro_yearly"]);
    expect(request).not.toHaveProperty("ios");
    expect(request).not.toHaveProperty("android");
    expect(type).toBe("subs");
  });

  it("labels a compound-period subscription subs, not in-app", async () => {
    // `toPeriod` rejects "P1Y1M", so a `period`-based discriminator called a
    // real subscription in-app and Play would reject the purchase outright.
    const M = makeExpoIap5({
      catalog: [{ ...iosYearly, type: undefined, subscriptionPeriodISO: "P1Y1M" }],
      platform,
    });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(product.period).toBeNull(); // unparseable by design
    await provider.purchase(product);
    expect(M.calls.requestPurchase[0].type).toBe("subs");
  });
});

describe("expoIapProductProvider — a purchase gets finished", () => {
  it("finishes the transaction the store delivers through the listener", async () => {
    // #241 finding 2. `requestPurchase` resolves null on the normal path, so
    // the old adapter returned "pending" and finished nothing: iOS re-delivers
    // the transaction on every launch and Play auto-refunds it after 3 days.
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    const result = await provider.purchase(product);
    expect(result).toEqual({ status: "purchased", productKey: "yearly" });
    expect(M.calls.finishTransaction).toHaveLength(1);
    expect(M.calls.finishTransaction[0].purchase).toMatchObject({
      id: "tx-pro_yearly",
      productId: "pro_yearly",
    });
  });

  it("consumes a consumable rather than acknowledging it", async () => {
    // An acknowledged Android consumable can never be re-bought. Only iOS
    // publishes the discriminator (`typeIOS`), which is why this asserts the
    // flag rather than the platform call.
    const M = makeExpoIap5({
      catalog: [{ ...iosLifetime, typeIOS: "consumable" }],
      platform,
    });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([LIFETIME_IOS]);
    await provider.purchase(product);
    expect(M.calls.finishTransaction[0].isConsumable).toBe(true);
  });

  it("acknowledges a non-consumable", async () => {
    const M = makeExpoIap5({ catalog: [iosLifetime], platform });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([LIFETIME_IOS]);
    await provider.purchase(product);
    expect(M.calls.finishTransaction[0].isConsumable).toBe(false);
  });

  it("reports pending and finishes nothing for an unpaid Android purchase", async () => {
    // purchaseState "pending" is Play's slow-payment path — the money has not
    // moved, and acknowledging it would entitle a user who may never pay.
    rn.Platform.OS = "android";
    const M = makeExpoIap5({
      catalog: [playYearly],
      platform,
      onDispatch: (sku) => ({ id: "tx-1", productId: sku, purchaseState: "pending" }),
    });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_PLAY]);
    expect(await provider.purchase(product)).toEqual({ status: "pending" });
    expect(M.calls.finishTransaction).toHaveLength(0);
  });

  it("still reports purchased when finishing throws", async () => {
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    M.finishTransaction = vi.fn().mockRejectedValue(new Error("finish failed")) as any;
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(await provider.purchase(product)).toEqual({
      status: "purchased",
      productKey: "yearly",
    });
  });

  it("ignores a transaction for a different product", async () => {
    // StoreKit replays unfinished transactions on the same emitter. Resolving
    // this purchase from someone else's transaction would grant the wrong key.
    const M = makeExpoIap5({
      catalog: [iosYearly, iosLifetime],
      platform,
      onDispatch: () => null,
    });
    const provider = expoIapProductProvider(M);
    const products = await provider.getProducts([YEARLY_IOS, LIFETIME_IOS]);
    const pending = provider.purchase(products[0]);
    setTimeout(() => M.emitUpdated({ id: "tx-old", productId: "some_other_product" }), 0);
    setTimeout(() => M.emitUpdated({ id: "tx-new", productId: "pro_yearly" }), 5);
    expect(await pending).toEqual({ status: "purchased", productKey: "yearly" });
    expect(M.calls.finishTransaction).toHaveLength(1);
    expect(M.calls.finishTransaction[0].purchase.id).toBe("tx-new");
  });
});

describe("expoIapProductProvider — cancellation is not an error", () => {
  it("maps the 5.x kebab-case code delivered through the error listener", async () => {
    // 5.x normalized every code to openiap kebab-case (types.js:41) and dropped
    // the `userCancelled` boolean, so dismissing the StoreKit sheet fired
    // onError on a paywall.
    const M = makeExpoIap5({
      catalog: [iosYearly],
      platform,
      onDispatch: () => ({ error: { code: "user-cancelled", message: "cancelled" } }),
    });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(await provider.purchase(product)).toEqual({ status: "cancelled" });
  });

  it("maps a thrown kebab-case cancellation too", async () => {
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    M.requestPurchase = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("cancelled"), { code: "user-cancelled" })) as any;
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(await provider.purchase(product)).toEqual({ status: "cancelled" });
  });

  it("still maps the pre-5.x codes", async () => {
    const M = makeExpoIap5({
      catalog: [iosYearly],
      platform,
      onDispatch: () => ({ error: { code: "E_USER_CANCELLED" } }),
    });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(await provider.purchase(product)).toEqual({ status: "cancelled" });
  });

  it("reports a real store failure as an error, keeping the store's diagnosis", async () => {
    // The listener delivers the PLAIN `{ code, message }` PurchaseError from
    // types.d.ts:1164, not the Error subclass `requestPurchase` rejects with.
    // `new Error(String(obj))` would hand the host "[object Object]".
    const M = makeExpoIap5({
      catalog: [iosYearly],
      platform,
      onDispatch: () => ({ error: { code: "network-error", message: "offline" } }),
    });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    const result = await provider.purchase(product);
    expect(result.status).toBe("error");
    expect((result as any).error.message).toContain("offline");
    expect((result as any).error.code).toBe("network-error");
  });
});

describe("expoIapProductProvider — a store that answers nothing", () => {
  it("reports pending rather than hanging forever", async () => {
    // The store's verdict is an event, so a promise waiting on one that never
    // arrives never settles — and `products.purchasing` would stay true, with
    // the buy button dead for the life of the process. "pending" is the honest
    // answer for an unconfirmed purchase; it is never reported as purchased.
    const M = makeExpoIap5({ catalog: [iosYearly], platform, onDispatch: () => null });
    const provider = expoIapProductProvider(M, { purchaseTimeoutMs: 10 });
    const [product] = await provider.getProducts([YEARLY_IOS]);
    expect(await provider.purchase(product)).toEqual({ status: "pending" });
    expect(M.calls.finishTransaction).toHaveLength(0);
    expect(M.calls.liveListeners).toBe(0);
  });
});

describe("expoIapProductProvider — listener lifetime", () => {
  const outcomes = [
    ["a completed purchase", undefined],
    ["a cancellation", () => ({ error: { code: "user-cancelled" } })],
    ["a store failure", () => ({ error: { code: "network-error" } })],
  ] as const;

  it.each(outcomes)("removes both subscriptions after %s", async (_label, onDispatch) => {
    // A subscription left behind on every Buy tap accumulates for the life of
    // the process, and each stale one would finish transactions twice.
    const M = makeExpoIap5({ catalog: [iosYearly], platform, onDispatch: onDispatch as any });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_IOS]);
    await provider.purchase(product);
    expect(M.calls.liveListeners).toBe(0);
  });
});

describe("expoIapProductProvider — Android base plans", () => {
  beforeEach(() => {
    rn.Platform.OS = "android";
  });

  it("queries the bare product id, not productId:basePlanId", async () => {
    // fetchProducts filters on `item.id` (index.js:471-477), so the authored
    // "pro_yearly:annual" matched nothing: a blank Android paywall reporting
    // status "ready".
    const M = makeExpoIap5({ catalog: [playYearly], platform });
    const products = await expoIapProductProvider(M).getProducts([YEARLY_PLAY]);
    expect(M.calls.fetchProducts[0].skus).toEqual(["pro_yearly"]);
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe("pro_yearly");
  });

  it("sends the base plan's offer token so Play can select it", async () => {
    // Play Billing needs an offerToken to know WHICH base plan is being bought;
    // 5.x forwards `subscriptionOffers` straight through (index.js:806-819).
    const M = makeExpoIap5({ catalog: [playYearly], platform });
    const provider = expoIapProductProvider(M);
    const [product] = await provider.getProducts([YEARLY_PLAY]);
    await provider.purchase(product);
    expect(M.calls.requestPurchase[0].request.google.subscriptionOffers).toEqual([
      { sku: "pro_yearly", offerToken: "tok-annual-trial" },
    ]);
  });

  it("takes the period from the recurring phase, not the free trial", async () => {
    // pricingPhaseList[0] is the trial when one exists, so a $59.99/year plan
    // with a 1-week trial reported "P1W" — and pricePerYear near $3,130.
    const M = makeExpoIap5({ catalog: [playYearly], platform });
    const [product] = await expoIapProductProvider(M).getProducts([YEARLY_PLAY]);
    expect(product.periodIso).toBe("P1Y");
    expect(product.period).toBe("year");
    expect(product.periodCount).toBe(1);
  });

  it("reads the base plan named by the ref, not merely the first offer", async () => {
    const M = makeExpoIap5({ catalog: [playYearly], platform });
    const [product] = await expoIapProductProvider(M).getProducts([
      { key: "monthly", android: "pro_yearly:monthly" },
    ]);
    expect(product.periodIso).toBe("P1M");
  });
});

describe("expoIapProductProvider — restore", () => {
  it("returns product ids and skips unpaid purchases", async () => {
    // `Purchase.id` is the TRANSACTION id and is always set, so `p.id ??
    // p.productId` never fell through — restore handed the host transaction
    // ids. And `getAvailablePurchases` includes unfinished purchases, so an
    // Android slow payment entitled before the money moved.
    const M = makeExpoIap5({
      platform,
      purchases: [
        { id: "tx-1", productId: "pro_yearly", purchaseState: "purchased" },
        { id: "tx-2", productId: "pro_pending", purchaseState: "pending" },
        { id: "tx-3", productId: "pro_yearly", purchaseState: "purchased" },
      ],
    });
    expect(await expoIapProductProvider(M).restore()).toEqual({
      status: "restored",
      entitlements: ["pro_yearly"],
    });
  });

  it("reports nothing_to_restore when every purchase is unpaid", async () => {
    const M = makeExpoIap5({
      platform,
      purchases: [{ id: "tx-2", productId: "pro_pending", purchaseState: "pending" }],
    });
    expect(await expoIapProductProvider(M).restore()).toEqual({ status: "nothing_to_restore" });
  });
});

describe("expoIapProductProvider — the store connection", () => {
  it("recovers when the connection is closed under it", async () => {
    // endConnection is process-wide: any other useIAP unmounting, or an Android
    // ServiceDisconnected, closed it. A cached resolved connect promise meant
    // every later call failed not-prepared for the life of the process.
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    const provider = expoIapProductProvider(M);
    await provider.getProducts([YEARLY_IOS]);
    M.dropConnection();
    await expect(provider.getProducts([YEARLY_IOS])).resolves.toHaveLength(1);
    expect(M.calls.initConnection).toBe(2);
  });
});

describe("expoIapProductProvider — a catalog that did not resolve", () => {
  it("fails rather than reporting an empty catalog as ready", async () => {
    // FetchProductsResult includes `null` (types.d.ts:527). Coercing it to []
    // put the runtime in `status: "ready"` with every {{product.*}} empty.
    const M = makeExpoIap5({ catalog: [iosYearly], platform, fetchProductsResult: null });
    await expect(expoIapProductProvider(M).getProducts([YEARLY_IOS])).rejects.toThrow(
      /did not return a product list/i
    );
  });

  it("warns by name when a ref resolves to nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const M = makeExpoIap5({ catalog: [iosYearly], platform });
    const products = await expoIapProductProvider(M).getProducts([YEARLY_IOS, LIFETIME_IOS]);
    expect(products).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("pro_lifetime"));
  });

  it("keeps earlier products purchasable after a second resolve", async () => {
    // `rawById.clear()` on every getProducts wiped the offer tokens and type
    // discriminators of the first set, so purchasing from it fell back to
    // guesswork.
    const M = makeExpoIap5({ catalog: [iosYearly, iosLifetime], platform });
    const provider = expoIapProductProvider(M);
    const [yearly] = await provider.getProducts([YEARLY_IOS]);
    await provider.getProducts([LIFETIME_IOS]);
    await provider.purchase(yearly);
    expect(M.calls.requestPurchase[0].type).toBe("subs");
  });
});
