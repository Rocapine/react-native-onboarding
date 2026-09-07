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
 *   :145-176  purchaseUpdatedListener's iOS DEDUPE — see below, it is the whole
 *             reason this fake exists in its current form.
 *   :195-200  purchaseErrorListener forwards the event verbatim: no product
 *             filtering of any kind, so attribution is the caller's problem.
 *   :886-899  restorePurchases() syncs and refreshes, and returns nothing.
 *   types.js:41 ErrorCode.UserCancelled === "user-cancelled" — kebab-case,
 *             and PurchaseError carries no `userCancelled` boolean.
 *
 * ## The dedupe, which the first version of this fake got wrong
 *
 * That version modelled listeners as plain push/splice. Real 5.3.2 keeps a
 * **process-wide** history of iOS transaction ids and seeds every NEW listener
 * from it:
 *
 *     const listenerDedupeHistoryIOS = {
 *       ids: new Set(purchaseUpdatedDedupeHistoryIOS.ids),   // :148
 *       ...
 *     };
 *     // on each event, recorded into BOTH (:163-164):
 *     rememberPurchaseUpdatedTransactionIOS(transactionId, listenerDedupeHistoryIOS);
 *     rememberPurchaseUpdatedTransactionIOS(transactionId, purchaseUpdatedDedupeHistoryIOS);
 *     if (!receiveDuplicateTransactionUpdatesIOS && isDuplicateForListener) return;  // :165-167
 *
 * So a listener subscribed *after* a transaction has been seen anywhere in the
 * process — by the host's own `useIAP`, for instance — never receives it.
 * Modelling this without the dedupe made a subscribe-per-Buy-tap adapter look
 * correct. It is iOS-only (`if (Platform.OS === 'ios')`, :155), and the global
 * history is cleared only by a successful `endConnection`.
 *
 * Two other divergences were checked and left unmodelled on purpose, because
 * nothing in this adapter can reach them: `validateAndroidPurchaseBranchOptions`
 * (the adapter never sends subscription-only fields on an `in-app` request) and
 * the `isProductIOS`/`isProductAndroid` platform filter inside `fetchProducts`
 * (the catalogs here are single-platform).
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
  ids?: string[];
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
   * outcome. Return `null` to model a store that emits nothing yet.
   */
  onDispatch?: (sku: string, type: string) => FakePurchase | { error: any } | null;
  /** What `getAvailablePurchases` reports — unfinished purchases included. */
  purchases?: FakePurchase[];
  /** Stand in for a store that answers the product query with `null`. */
  fetchProductsResult?: null;
  /** Make `finishTransaction` throw, to exercise the retry path. */
  finishFails?: () => boolean;
};

const err = (code: string, message: string) => Object.assign(new Error(message), { code });

export const makeExpoIap5 = (options: FakeOptions = {}) => {
  const catalog = options.catalog ?? [];
  const platformOf = () => options.platform?.() ?? "ios";

  // The process-wide dedupe history (`purchaseUpdatedDedupeHistoryIOS`).
  const globalSeenIOS = new Set<string>();

  type Registered = { listener: (p: FakePurchase) => void; seen: Set<string> };
  const updatedListeners: Registered[] = [];
  const errorListeners: ((e: any) => void)[] = [];

  const calls = {
    initConnection: 0,
    endConnection: 0,
    restorePurchases: 0,
    requestPurchase: [] as any[],
    fetchProducts: [] as any[],
    finishTransaction: [] as any[],
    /** Subscriptions taken out minus subscriptions removed. */
    liveListeners: 0,
    /** How many times purchaseUpdatedListener was ever called. */
    updatedSubscribes: 0,
  };

  let prepared = false;
  // A real store issues a NEW transaction id per purchase, and the dedupe above
  // makes that load-bearing: reusing one id would make the second Buy tap look
  // like a duplicate and be dropped.
  let txSeq = 0;

  const api = {
    calls,
    /** Force the "another useIAP unmounted" case the adapter has to survive. */
    dropConnection() {
      prepared = false;
    },
    /**
     * Attach a listener that is not the adapter's — the host's own `useIAP`.
     * Its only job in a test is to populate the process-wide dedupe history.
     */
    attachForeignListener() {
      return api.purchaseUpdatedListener(() => {});
    },
    emitUpdated(p: FakePurchase) {
      // :153-171, in order: check this listener's own history, record into both
      // it and the global, then drop if it was already there for THIS listener.
      for (const reg of [...updatedListeners]) {
        if (platformOf() === "ios") {
          const tx = typeof p.id === "string" && p.id ? p.id : null;
          if (tx != null) {
            const duplicateForListener = reg.seen.has(tx);
            reg.seen.add(tx);
            globalSeenIOS.add(tx);
            if (duplicateForListener) continue;
          }
        }
        reg.listener(p);
      }
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
      globalSeenIOS.clear(); // :568-571
      return true;
    },

    purchaseUpdatedListener(listener: (p: FakePurchase) => void) {
      // :147-151 — seeded from the PROCESS-WIDE set, not from nothing.
      const reg: Registered = { listener, seen: new Set(globalSeenIOS) };
      updatedListeners.push(reg);
      calls.liveListeners += 1;
      calls.updatedSubscribes += 1;
      return {
        remove() {
          const i = updatedListeners.indexOf(reg);
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
      if ("fetchProductsResult" in options && options.fetchProductsResult === null) return null;
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

      let sku: string;
      if (platformOf() === "ios") {
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
        : ({
            id: `tx-${sku}-${(txSeq += 1)}`,
            productId: sku,
            purchaseState: "purchased",
          } as FakePurchase);

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
      if (options.finishFails?.()) throw err("network-error", "could not finish");
      return undefined;
    },

    // :886-899 — syncs, then refreshes, and returns nothing itself.
    async restorePurchases() {
      calls.restorePurchases += 1;
      if (!prepared) throw err("not-prepared", "IAP not prepared");
      return undefined;
    },

    async getAvailablePurchases(): Promise<FakePurchase[]> {
      if (!prepared) throw err("not-prepared", "IAP not prepared");
      return options.purchases ?? [];
    },
  };

  return api;
};
