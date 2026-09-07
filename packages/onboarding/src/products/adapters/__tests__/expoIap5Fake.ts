/**
 * A behavioural fake of expo-iap 5.x, transcribed from the INSTALLED package
 * rather than written from the adapter's expectations.
 *
 * Why a fake instead of `expect(requestPurchase).toHaveBeenCalledWith(...)`:
 * the hand-written expectation is what let #241 ship. The old suite asserted
 * `{ request: { ios, android } }` was correct, so it passed while every real
 * purchase threw — the test and the bug agreed with each other. A fake that
 * *behaves* like the store cannot agree with a wrong payload: it rejects it,
 * exactly as the device does.
 *
 * Provenance — expo-iap 5.3.2, `build/index.js`. Every rule below is a
 * transcription of a line there, not an inference:
 *
 *   :650-656  normalizeRequestProps() reads `request.apple` (ios) /
 *             `request.google` (android). No `ios`/`android` keys: 5.0 removed
 *             the deprecation shim that 4.x still had (4.7.2 `build/index.js`
 *             :666-674 warns and accepts them; 5.3.2 does not).
 *   :712-728  iOS with no `request.apple.sku` throws ErrorCode.EmptySkuList.
 *   :745-751  iOS resolves the native purchase when there is one, else `[]`
 *             for `subs` and `null` for `in-app`.
 *   :756-766  Android with no `request.google.skus[]` throws EmptySkuList.
 *   :453-477  fetchProducts() throws EmptySkuList on an empty `skus`, and
 *             filters the store's answer by `item.id ∈ new Set(skus)` — an id
 *             the store does not know simply does not come back.
 *   :676-679  "The result is delivered through `purchaseUpdatedListener` — NOT
 *             the return value."
 *   :145,:195 purchaseUpdatedListener / purchaseErrorListener return an
 *             EmitterSubscription with `.remove()`.
 *   types.js:41 ErrorCode.UserCancelled === "user-cancelled" — kebab-case,
 *             and PurchaseError carries no `userCancelled` boolean.
 *
 * Deliberately NOT modelled: Play's requirement that a subscription purchase
 * carry an `offerToken`. That rule lives in openiap-google's native layer, and
 * this run could not verify which error code surfaces — so the suite asserts
 * the payload the adapter sends instead of a failure it invented.
 */

export type FakePurchase = {
  id: string;
  productId: string;
  purchaseState?: "purchased" | "pending" | "unknown";
  purchaseToken?: string;
};

export type FakeOptions = {
  /** Products the store knows, keyed by the bare id it would report. */
  catalog?: any[];
  /**
   * Which platform branch the store is running. Read lazily, so one fake can
   * serve a suite that flips `Platform.OS` between tests.
   */
  platform?: () => "ios" | "android";
  /**
   * What the store does when a purchase is dispatched. Default: deliver a
   * purchased transaction through purchaseUpdatedListener — the normal 5.x
   * outcome. Return `null` to model a store that emits nothing.
   */
  onDispatch?: (sku: string, type: string) => FakePurchase | { error: any } | null;
  /** What `getAvailablePurchases` reports — unfinished purchases included. */
  purchases?: FakePurchase[];
  /** Stand in for a store that answers the product query with `null`. */
  fetchProductsResult?: null;
};

const err = (code: string, message: string) => Object.assign(new Error(message), { code });

export const makeExpoIap5 = (options: FakeOptions = {}) => {
  const catalog = options.catalog ?? [];
  const updatedListeners: ((p: FakePurchase) => void)[] = [];
  const errorListeners: ((e: any) => void)[] = [];

  const calls = {
    initConnection: 0,
    endConnection: 0,
    requestPurchase: [] as any[],
    fetchProducts: [] as any[],
    finishTransaction: [] as any[],
    /** Subscriptions taken out minus subscriptions removed. Must land back on 0. */
    liveListeners: 0,
  };

  let prepared = false;

  const api = {
    calls,
    /** Force the "another useIAP unmounted" case the adapter has to survive. */
    dropConnection() {
      prepared = false;
    },
    emitUpdated(p: FakePurchase) {
      updatedListeners.forEach((l) => l(p));
    },
    emitError(e: any) {
      errorListeners.forEach((l) => l(e));
    },

    async initConnection() {
      calls.initConnection += 1;
      prepared = true;
      return true;
    },
    async endConnection() {
      calls.endConnection += 1;
      prepared = false;
      return true;
    },

    purchaseUpdatedListener(listener: (p: FakePurchase) => void) {
      updatedListeners.push(listener);
      calls.liveListeners += 1;
      return {
        remove() {
          const i = updatedListeners.indexOf(listener);
          if (i >= 0) updatedListeners.splice(i, 1);
          calls.liveListeners -= 1;
        },
      };
    },
    purchaseErrorListener(listener: (e: any) => void) {
      errorListeners.push(listener);
      calls.liveListeners += 1;
      return {
        remove() {
          const i = errorListeners.indexOf(listener);
          if (i >= 0) errorListeners.splice(i, 1);
          calls.liveListeners -= 1;
        },
      };
    },

    // :453-477
    async fetchProducts(request: { skus?: string[]; type?: string }) {
      calls.fetchProducts.push(request);
      const skus = request?.skus;
      if (!Array.isArray(skus) || skus.length === 0) {
        throw err("empty-sku-list", "No SKUs provided");
      }
      if (!prepared) throw err("not-prepared", "IAP not prepared");
      // FetchProductsResult is `Product[] | ... | null` (types.d.ts:527).
      if (options.fetchProductsResult === null && "fetchProductsResult" in options) return null;
      const wanted = new Set(skus);
      return catalog.filter((p) => wanted.has(p.id));
    },

    // :702-830
    async requestPurchase(args: any) {
      calls.requestPurchase.push(args);
      if (!prepared) throw err("not-prepared", "IAP not prepared");
      const { request, type } = args ?? {};
      if (type === "all") {
        throw err("developer-error", "Product type all is only supported for product queries.");
      }

      const platform = options.platform?.() ?? "ios";
      let sku: string;
      if (platform === "ios") {
        const apple = request?.apple; // :652
        if (!apple?.sku) {
          throw err(
            "empty-sku-list",
            "Invalid request for Apple. The `sku` property is required and must be a string."
          );
        }
        sku = apple.sku;
      } else {
        const google = request?.google; // :655
        if (!google?.skus?.length) {
          throw err(
            "empty-sku-list",
            "Invalid request for Google. The `skus` property is required and must be a non-empty array."
          );
        }
        sku = google.skus[0];
      }

      const outcome = options.onDispatch
        ? options.onDispatch(sku, type)
        : ({ id: `tx-${sku}`, productId: sku, purchaseState: "purchased" } as FakePurchase);

      // The store answers on its own turn of the event loop, never inside the
      // dispatch call — which is why an adapter reading the return value sees
      // nothing. :676-679
      if (outcome && "error" in outcome) {
        setTimeout(() => api.emitError(outcome.error), 0);
      } else if (outcome) {
        setTimeout(() => api.emitUpdated(outcome), 0);
      }

      // :745-751 — nothing useful comes back on the normal path.
      return type === "subs" ? [] : null;
    },

    async finishTransaction(args: { purchase: any; isConsumable?: boolean }) {
      calls.finishTransaction.push(args);
      if (!args?.purchase) throw err("developer-error", "purchase is required");
      return undefined;
    },

    async getAvailablePurchases(): Promise<FakePurchase[]> {
      if (!prepared) throw err("not-prepared", "IAP not prepared");
      return options.purchases ?? [];
    },
  };

  return api;
};
