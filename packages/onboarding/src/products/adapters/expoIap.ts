import { Platform } from "react-native";
import type {
  ProductProvider,
  ProductRef,
  ProductPeriod,
  PurchaseResult,
  ResolvedProduct,
} from "../types";

// Optional peer: expo-iap. Same dynamic-require pattern as elements/haptics.ts.
let IAP: any;
try {
  IAP = require("expo-iap");
} catch {
  IAP = null;
}

const toPeriod = (iso: string | null | undefined): { period: ProductPeriod | null; count: number } => {
  if (!iso) return { period: null, count: 0 };
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return { period: null, count: 0 };
  // `D: "week"` is wrong for a daily plan and is deliberately left alone here:
  // `ProductPeriod` has no "day" member, all three adapters share the same
  // mapping, and widening a published union is a release-visible change rather
  // than part of this fix. Tracked in #258. Only `period` is affected —
  // `periodIso` is what `deriveProductFields` divides by, and it is exact.
  const map: Record<string, ProductPeriod> = { D: "week", W: "week", M: "month", Y: "year" };
  return { period: map[m[2]] ?? null, count: Number(m[1]) };
};

/**
 * A user cancellation, across every code shape expo-iap has used.
 *
 * 5.x normalized every code to openiap kebab-case (`ErrorCode.UserCancelled
 * === "user-cancelled"`, `types.js:41`) and dropped the `userCancelled`
 * boolean, so testing only the pre-5.x screaming-snake codes turned a dismissed
 * StoreKit sheet into `onError` on the paywall. All shapes are accepted: an
 * older peer is still a supported peer.
 */
const isCancellation = (e: any): boolean =>
  e?.code === "user-cancelled" ||
  e?.code === "E_USER_CANCELLED" ||
  e?.code === "USER_CANCELED" ||
  e?.userCancelled === true;

/**
 * Codes that mean the store connection is gone, so a READ is worth retrying
 * after reopening it.
 *
 * `endConnection` is process-wide: any other `useIAP` in the host unmounting,
 * or an Android `ServiceDisconnected`, closes the connection this adapter
 * opened. Caching a RESOLVED connect promise then made every later call fail
 * for the life of the process.
 *
 * **Reads only.** `requestPurchase` is never retried on these — see the comment
 * on `withConnection`.
 */
const CONNECTION_LOST = new Set([
  "not-prepared",
  "connection-closed",
  "service-disconnected",
  "init-connection",
  "E_NOT_PREPARED",
  "E_SERVICE_DISCONNECTED",
]);

const idFor = (ref: ProductRef): string | undefined =>
  Platform.OS === "ios" ? ref.ios : ref.android;

/**
 * Play refs are authored `productId:basePlanId` (see `ProductRef.android`) —
 * RevenueCat's convention, which the studio writes for every platform.
 *
 * expo-iap is not RevenueCat: `fetchProducts` filters the store's answer by the
 * BARE `item.id` (`build/index.js:471-477`), so passing the composite id
 * through matched nothing and the product was skipped — a blank Android paywall
 * reporting `status: "ready"`. The base plan half is not noise either: it is
 * what selects the offer, and therefore the offer token Play needs.
 */
const splitAndroidRef = (id: string): { productId: string; basePlanId?: string } => {
  const at = id.indexOf(":");
  return at < 0
    ? { productId: id }
    : { productId: id.slice(0, at), basePlanId: id.slice(at + 1) };
};

/** Play's `RecurrenceMode.INFINITE_RECURRING` — the ongoing phase of a base plan. */
const RECURRENCE_INFINITE = 1;

/**
 * The subscription offer for the base plan the ref names.
 *
 * With no base plan authored there is nothing to disambiguate, so the first
 * offer stands. With one authored and no offer carrying it, the ref points at a
 * base plan this product does not have — worth saying out loud, because the
 * purchase will be for a different plan than the price shown.
 */
const offerFor = (s: any, basePlanId: string | undefined, productId: string): any | undefined => {
  const offers: any[] = Array.isArray(s?.subscriptionOffers) ? s.subscriptionOffers : [];
  if (offers.length === 0) return undefined;
  if (!basePlanId) return offers[0];
  const matched = offers.find((o) => o?.basePlanIdAndroid === basePlanId);
  if (matched) return matched;
  console.warn(
    `expoIapProductProvider: "${productId}" has no base plan "${basePlanId}" — ` +
      `offers are [${offers.map((o) => o?.basePlanIdAndroid ?? "?").join(", ")}]. ` +
      `Falling back to the first offer; the authored ref is probably stale.`
  );
  return offers[0];
};

/**
 * The phase of an Android offer that the subscriber actually recurs on.
 *
 * `pricingPhaseList[0]` is the TRIAL or intro phase whenever one exists, so
 * reading it gave a $59.99/year plan with a one-week trial `periodIso: "P1W"` —
 * and a `pricePerYear` near $3,130, because `deriveProductFields` divides the
 * price by the period it is told. Prefer the infinite-recurring phase; failing
 * that the last priced phase, since intro phases come first.
 */
const recurringPhase = (offer: any): any | undefined => {
  const phases: any[] = offer?.pricingPhasesAndroid?.pricingPhaseList ?? [];
  if (phases.length === 0) return undefined;
  return (
    phases.find((p) => Number(p?.recurrenceMode) === RECURRENCE_INFINITE) ??
    [...phases].reverse().find((p) => Number(p?.priceAmountMicros ?? 0) > 0) ??
    phases[phases.length - 1]
  );
};

const ISO_UNIT: Record<string, string> = { day: "D", week: "W", month: "M", year: "Y" };

/**
 * The store's billing period as an ISO-8601 duration.
 *
 * Load-bearing far beyond the `period` field: `deriveProductFields` computes
 * `pricePerDay` / `pricePerWeek` / `pricePerMonth` / `pricePerYear` and
 * `savingsPct` from `periodIso` alone. A null here does not degrade those — it
 * removes them, so `{{product.yearly.pricePerWeek}}` renders EMPTY (an unknown
 * variable interpolates to nothing, not to a literal) and a per-week-framed
 * paywall silently loses its headline number.
 *
 * expo-iap has never exposed one ready-made, and the shape has moved:
 *   - ≤4.x published `subscriptionPeriodISO` / `subscriptionPeriod` on the product
 *   - 5.x publishes the iOS period SPLIT in two (`subscriptionPeriodUnitIOS`,
 *     `subscriptionPeriodNumberIOS`) and the Android one in the pricing phases
 *     of a subscription offer
 * All three are read, newest-shape-last so an older peer keeps working.
 */
const periodIsoFrom = (s: any, phase: any): string | null => {
  const direct = s?.subscriptionPeriodISO ?? s?.subscriptionPeriod;
  if (typeof direct === "string" && direct) return direct;

  const unit = ISO_UNIT[String(s?.subscriptionPeriodUnitIOS ?? "").toLowerCase()];
  if (unit) {
    // `subscriptionPeriodNumberIOS` is typed as a STRING by expo-iap. Default to
    // 1 rather than 0: StoreKit omits the count for a single-unit period, and
    // "P0M" would make every derived price divide by zero.
    const n = Number(s?.subscriptionPeriodNumberIOS ?? 1);
    return `P${Number.isFinite(n) && n > 0 ? n : 1}${unit}`;
  }

  const androidPeriod = phase?.billingPeriod;
  return typeof androidPeriod === "string" && androidPeriod ? androidPeriod : null;
};

/** Does this delivered transaction belong to the sku we asked for? */
const deliversFor = (purchase: any, sku: string): boolean =>
  purchase?.productId === sku ||
  (Array.isArray(purchase?.ids) && purchase.ids.includes(sku));

/** The products a `PurchaseError` names, if it names any (`types.d.ts:1164-1174`). */
const errorSkus = (e: any): string[] =>
  [e?.productId, ...(Array.isArray(e?.productIds) ? e.productIds : [])].filter(
    (s): s is string => typeof s === "string" && s.length > 0
  );

/** A transaction id, which is what `Purchase.id` carries (`types.d.ts:1151`). */
const txIdOf = (purchase: any): string | null =>
  typeof purchase?.id === "string" && purchase.id ? purchase.id : null;

/**
 * `purchaseState` is `'pending' | 'purchased' | 'unknown'` (`types.d.ts:1264`).
 *
 * `getAvailablePurchases` reports UNFINISHED purchases too, so an Android
 * slow-payment purchase used to entitle the user before the money moved. Grant
 * only on an explicit "purchased" — with one exception, a peer that reports no
 * state at all predates the field, and rejecting its silence would break every
 * restore on that peer rather than tightening anything.
 */
const isPaid = (p: any): boolean => p?.purchaseState == null || p.purchaseState === "purchased";

/**
 * expo-iap reports a purchase failure two different ways, and only one of them
 * is an `Error`.
 *
 * A rejection from `requestPurchase` is a real `Error` (`createPurchaseError`,
 * `utils/errorMapping.d.ts:19` — `PurchaseError extends Error`). What arrives
 * on `purchaseErrorListener` is the OTHER `PurchaseError`: the plain
 * `{ code, message }` shape from `types.d.ts:1164`, straight off the native
 * emitter. `new Error(String(plainObject))` turns that into
 * "[object Object]" — the store's diagnosis, thrown away at the one point a
 * host would read it.
 */
const asError = (e: unknown): Error => {
  if (e instanceof Error) return e;
  const message =
    typeof (e as any)?.message === "string" && (e as any).message ? (e as any).message : String(e);
  const code = (e as any)?.code;
  const error = new Error(code ? `${message} (${code})` : message);
  if (code) (error as any).code = code;
  return error;
};

const failureFor = (e: any): PurchaseResult =>
  isCancellation(e) ? { status: "cancelled" } : { status: "error", error: asError(e) };

/** What `getProducts` remembers per ref so `purchase` can dispatch correctly. */
type ResolvedMeta = {
  /** expo-iap's own discriminator: "subs" | "in-app". */
  type?: string;
  /** Play's handle on the chosen base plan. Required to buy a subscription. */
  offerToken?: string;
};

/** One caller waiting for an answer. Its lifetime is NOT the transaction's. */
type Waiter = {
  sku: string;
  productKey: string;
  settled?: PurchaseResult;
  answer: (r: PurchaseResult) => void;
  promise: Promise<PurchaseResult>;
};

export type ExpoIapProviderOptions = {
  /**
   * How long to wait for the store's verdict before answering `"pending"`.
   *
   * The verdict is an event and nothing bounds how long a user spends in the
   * store sheet — Ask to Buy, an SCA step-up, or adding a card inside the sheet
   * routinely exceed the default — so this bounds only how long the CALLER
   * waits. It does not end the transaction: the provider's listeners stay
   * attached, and a verdict arriving after the timeout is still acknowledged.
   * It resolves `"pending"`, never `"purchased"`.
   */
  purchaseTimeoutMs?: number;
  /**
   * Honour a transaction this process never asked for, so it can be finished.
   *
   * StoreKit re-delivers an unfinished transaction on **every launch**, and a
   * purchase can also arrive from an Ask to Buy approval, a promoted product,
   * or a pending Play purchase that cleared while the app was closed. None of
   * those has a caller waiting, and finishing one blind would take the money
   * while granting nothing — destroying the very replay that lets the app
   * recover. So the host decides: return `true` once entitlement is granted and
   * the transaction is finished; return `false` (or leave this unset) and it is
   * left alone to be re-delivered next launch.
   *
   * A purchase this provider DISPATCHED in this process never comes here — the
   * caller was told about it, so acknowledging it needs no second opinion.
   */
  onUnclaimedPurchase?: (purchase: any) => boolean | Promise<boolean>;
};

/**
 * `dispose()` is additive to `ProductProvider`: hosts that never call it are
 * unaffected, but a provider holds a store subscription for its lifetime, so a
 * host that rebuilds one per render should tear the old one down.
 */
export type ExpoIapProvider = ProductProvider & { dispose(): void };

const DEFAULT_PURCHASE_TIMEOUT_MS = 180_000;

/** Direct StoreKit / Play Billing provider, no vendor in the path. */
export const expoIapProductProvider = (
  Iap: any = IAP,
  options: ExpoIapProviderOptions = {}
): ExpoIapProvider => {
  const purchaseTimeoutMs = options.purchaseTimeoutMs ?? DEFAULT_PURCHASE_TIMEOUT_MS;

  const required = () => {
    if (!Iap) {
      throw new Error(
        "expoIapProductProvider: expo-iap is not installed. Install it, or pass a different ProductProvider."
      );
    }
    return Iap;
  };

  // ---------------------------------------------------------------------------
  // The finish lifetime.
  //
  // Acknowledging the money is a SEPARATE concern from answering the caller,
  // and an earlier version of this file conflated them: it guarded both on one
  // `claimed` flag and removed its listeners the moment the caller had an
  // answer. Every path that answered early — an unrelated product's error, a
  // `pending` update, the timeout — permanently lost the ability to finish the
  // charge, and Play auto-refunds an unacknowledged purchase after 3 days.
  //
  // So the listeners are opened ONCE, on first connect, and live as long as the
  // provider. That is also forced by expo-iap's iOS dedupe: each new
  // `purchaseUpdatedListener` seeds its history from a PROCESS-WIDE set
  // (`ids: new Set(purchaseUpdatedDedupeHistoryIOS.ids)`, `build/index.js`
  // :148-151, recorded into the global at :164, cleared only by a successful
  // `endConnection`). Subscribing per Buy tap therefore inherits every
  // transaction id any other listener in the process has ever seen — the host's
  // own `useIAP`, for instance — and silently drops them. One early
  // subscription sees each transaction exactly once instead.
  // ---------------------------------------------------------------------------
  let subscriptions: { remove?(): void }[] | null = null;
  /** Skus this process asked to buy. A delivery for one of these is ours. */
  const dispatchedSkus = new Set<string>();
  /** Transaction ids already acknowledged, so no delivery finishes twice. */
  const finishedTxIds = new Set<string>();
  /** Acknowledgements that threw, retried on the next store round-trip. */
  const unfinished = new Map<string, { purchase: any; isConsumable: boolean }>();
  const waiters = new Set<Waiter>();
  let warnedUnclaimed = false;
  /** Only iOS publishes a consumable discriminator; see `getProducts`. */
  const consumableBySku = new Map<string, boolean>();

  const finish = async (purchase: any, isConsumable: boolean) => {
    const M = required();
    const tx = txIdOf(purchase);
    if (tx && finishedTxIds.has(tx)) return;
    if (typeof M.finishTransaction !== "function") return;
    try {
      await M.finishTransaction({ purchase, isConsumable });
      if (tx) {
        finishedTxIds.add(tx);
        unfinished.delete(tx);
      }
    } catch (e) {
      // Best-effort: a failure here does not un-buy anything, so it must not
      // turn a completed purchase into an error. But it must not be forgotten
      // either — Play's 3-day window is still running.
      if (tx) unfinished.set(tx, { purchase, isConsumable });
      console.warn(
        `expoIapProductProvider: could not finish transaction ${tx ?? "(no id)"} ` +
          `for "${purchase?.productId}" — will retry on the next store call. ${String(e)}`
      );
    }
  };

  /** Give an earlier failed acknowledgement another go; never throws. */
  const retryUnfinished = async () => {
    for (const [, record] of [...unfinished]) {
      try {
        await finish(record.purchase, record.isConsumable);
      } catch {
        // finish() already swallows and re-queues; belt and braces
      }
    }
  };

  /** Hand a result to the one caller waiting on this transaction's sku, if any. */
  const answer = (purchase: any, result: PurchaseResult) => {
    for (const w of waiters) {
      if (w.settled || !deliversFor(purchase, w.sku)) continue;
      w.answer(result.status === "purchased" ? { ...result, productKey: w.productKey } : result);
      return;
    }
  };

  const handleUpdated = async (purchase: any) => {
    const sku: string | undefined = purchase?.productId;
    const isConsumable = (sku != null && consumableBySku.get(sku)) || false;

    // Play's slow-payment path: the user has committed but the money has not
    // moved, and Android cannot acknowledge it anyway (no `purchaseToken` yet,
    // `build/index.js:865-874`). Tell the caller — then keep listening, because
    // Play emits `purchased` for the SAME transaction once it clears. Treating
    // this as terminal is what left a cleared purchase unfinished.
    if (purchase?.purchaseState === "pending") {
      answer(purchase, { status: "pending" });
      return;
    }

    if (sku != null && dispatchedSkus.has(sku)) {
      await finish(purchase, isConsumable);
      // `productKey` is filled in by `answer` from the waiting caller's ref.
      answer(purchase, { status: "purchased", productKey: "" });
      return;
    }

    // Nobody here asked for this one: a replay from a previous process, an Ask
    // to Buy approval, a promoted product. Only the host knows whether it has
    // been honoured, so only the host can authorise finishing it.
    if (options.onUnclaimedPurchase) {
      if (await options.onUnclaimedPurchase(purchase)) await finish(purchase, isConsumable);
      return;
    }
    if (!warnedUnclaimed) {
      warnedUnclaimed = true;
      console.warn(
        `expoIapProductProvider: the store delivered a transaction nobody is waiting for ` +
          `("${sku}"). It is left unfinished, so it will be re-delivered next launch. ` +
          `Pass onUnclaimedPurchase to grant entitlement and finish it.`
      );
    }
  };

  /**
   * Attribute a store failure to the purchase it belongs to.
   *
   * The error listener is process-wide and unfiltered — expo-iap forwards the
   * event verbatim (`build/index.js:195-200`), and on Android the module emits
   * from a single listener registered per module (`ExpoIapHelper.kt`), buffering
   * events while disconnected and flushing them on the next successful
   * `initConnection` (`ExpoIapModule.kt:198-205`). Claiming unconditionally
   * therefore let another product's failure — or a stale buffered one — answer
   * this purchase, after which the real transaction arrived to a caller that
   * had already been told "error".
   */
  const handleError = (e: any) => {
    const open = [...waiters].filter((w) => !w.settled);
    if (open.length === 0) return;
    const named = errorSkus(e);
    // With no product named there is nothing to match on, so attribute it only
    // when a single purchase is in flight and it cannot be anyone else's.
    const target =
      named.length > 0
        ? open.find((w) => named.includes(w.sku))
        : open.length === 1
          ? open[0]
          : undefined;
    target?.answer(failureFor(e));
  };

  const listen = () => {
    if (subscriptions) return;
    const M = required();
    const subs: { remove?(): void }[] = [];
    if (typeof M.purchaseUpdatedListener === "function") {
      subs.push(M.purchaseUpdatedListener((p: any) => void handleUpdated(p)));
    }
    if (typeof M.purchaseErrorListener === "function") {
      subs.push(M.purchaseErrorListener((e: any) => handleError(e)));
    }
    subscriptions = subs;
  };

  // Every expo-iap query fails until the store connection is open, and nothing
  // opens it implicitly — `useIAP` does it for hook consumers, but this adapter
  // is not a hook. Cached so concurrent getProducts/purchase/restore calls share
  // one connect, and CLEARED on failure so a later call retries rather than
  // replaying a rejected promise forever (a first call during airplane mode
  // would otherwise poison the provider for the whole session).
  let connecting: Promise<unknown> | null = null;
  const connect = async () => {
    const M = required();
    if (typeof M.initConnection !== "function") {
      listen(); // older peer: implicit connection, but events still arrive
      return;
    }
    if (!connecting) {
      connecting = Promise.resolve(M.initConnection()).catch((e: unknown) => {
        connecting = null;
        throw e;
      });
    }
    await connecting;
    // As early as possible, and before any purchase: a transaction replayed at
    // launch has no caller, and a listener attached later would inherit a
    // dedupe history that hides it.
    listen();
  };

  /**
   * Run a READ, reopening the connection once if it turns out to be gone.
   *
   * `requestPurchase` is deliberately NOT run through this. An earlier version
   * did, on the stated reasoning that a CONNECTION_LOST code is thrown before
   * any billing flow starts — which the Android module disproves.
   * `requestPurchase` sets `reachedOpenIapRequest = true` BEFORE calling
   * `openIap.requestPurchase` (`ExpoIapModule.kt:435-436`), and
   * `deliverPurchaseRequestFailure` (`:63-75`) rejects the pending promise on
   * every path, mid-flight included. Worse, `service-disconnected` is the
   * catch-all code for any failure that is not an `OpenIapError` (`:60-61`), so
   * the code carries no information about whether the sheet was ever shown.
   * Retrying it can present a SECOND sheet, charge a consumable twice, and
   * discard the result.
   */
  const withConnection = async <T>(op: () => Promise<T>): Promise<T> => {
    await connect();
    try {
      return await op();
    } catch (e: any) {
      if (!CONNECTION_LOST.has(String(e?.code))) throw e;
      connecting = null;
      await connect();
      return await op();
    }
  };

  // Per REF key, not per productId: two refs routinely name the same Play
  // subscription through different base plans ("pro:annual", "pro:monthly"),
  // and they need different offer tokens. Never cleared — a second resolve used
  // to wipe the first set, leaving already-rendered products unpurchasable.
  const metaByKey = new Map<string, ResolvedMeta>();

  return {
    dispose() {
      for (const s of subscriptions ?? []) {
        try {
          s.remove?.();
        } catch {
          // a peer whose subscription has no remove(); nothing to undo
        }
      }
      subscriptions = null;
    },

    async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
      const M = required();
      const wanted = refs
        .map((ref) => {
          const authored = idFor(ref);
          if (!authored) return null;
          if (Platform.OS === "ios") return { ref, id: authored, basePlanId: undefined };
          const { productId, basePlanId } = splitAndroidRef(authored);
          return { ref, id: productId, basePlanId };
        })
        .filter((x): x is { ref: ProductRef; id: string; basePlanId: string | undefined } => !!x);
      if (wanted.length === 0) return [];

      // Deduped: two base plans of one subscription are one product query.
      const skus = Array.from(new Set(wanted.map((w) => w.id)));

      // 5.x renamed `getProducts(skus)` to `fetchProducts({ skus, type })` — an
      // object arg, not a positional array. Calling the old name on 5.x throws
      // "M.getProducts is not a function", so probe rather than assume; `"all"`
      // because a paywall mixes subscriptions and one-off lifetime products.
      const store = await withConnection(() =>
        typeof M.fetchProducts === "function"
          ? M.fetchProducts({ skus, type: "all" })
          : M.getProducts(skus)
      );

      // `FetchProductsResult` includes `null` (`types.d.ts:527`). Coercing that
      // to `[]` put the runtime in `status: "ready"` with an empty catalog, so
      // every `{{product.*}}` rendered blank and nothing said why. A failed
      // query is an error; `useProducts` has a state for it.
      if (!Array.isArray(store)) {
        throw new Error(
          `expoIapProductProvider: expo-iap did not return a product list for [${skus.join(", ")}] ` +
            `(got ${store === null ? "null" : typeof store}). The store query failed.`
        );
      }

      const byId = new Map<string, any>(store.map((s: any) => [s.id ?? s.productId, s]));
      const missing = skus.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        // Silence here is how a blank paywall reaches `status: "ready"`: an id
        // the store does not know is simply absent from the answer.
        console.warn(
          `expoIapProductProvider: the store returned no product for [${missing.join(", ")}]. ` +
            `Check the id is registered and approved for this platform.`
        );
      }

      const out: ResolvedProduct[] = [];
      for (const { ref, id, basePlanId } of wanted) {
        const s = byId.get(id);
        if (!s) continue;
        const productId = s.id ?? s.productId;
        const offer = offerFor(s, basePlanId, productId);
        const phase = recurringPhase(offer);
        const iso = periodIsoFrom(s, phase);
        const { period, count } = toPeriod(iso);

        metaByKey.set(ref.key, {
          type: s.type,
          offerToken: offer?.offerTokenAndroid ?? undefined,
        });
        // Only iOS publishes the discriminator. Android one-time products are
        // all `type: "in-app"` and consumability is the app's decision, so a
        // Play consumable still needs the host to say so — see the CHANGELOG.
        consumableBySku.set(productId, s.typeIOS === "consumable");

        out.push({
          key: ref.key,
          productId,
          store: Platform.OS === "ios" ? "app_store" : "play_store",
          title: s.title ?? "",
          description: s.description ?? "",
          // Phase fallbacks only: what the store reports at the top level stays
          // authoritative. On Android the base plan's price lives in the phase,
          // and this run had no device to confirm whether openiap fills the
          // top-level fields for a subscription.
          price: s.displayPrice ?? s.localizedPrice ?? phase?.formattedPrice ?? "",
          priceAmount:
            typeof s.price === "number"
              ? s.price
              : phase?.priceAmountMicros != null
                ? Number(phase.priceAmountMicros) / 1_000_000
                : 0,
          currencyCode: s.currency ?? s.currencyCode ?? phase?.priceCurrencyCode ?? "",
          period,
          periodCount: count,
          periodIso: iso,
        });
      }
      return out;
    },

    async purchase(product): Promise<PurchaseResult> {
      const M = required();
      const meta = metaByKey.get(product.key);
      const sku = product.productId;
      // `periodIso`, not `period`: `toPeriod` rejects a compound duration like
      // "P1Y1M", so a `period`-based test called a real subscription "in-app"
      // and Play rejects the wrong type outright.
      const isSubs = (meta?.type ?? (product.periodIso ? "subs" : "in-app")) === "subs";

      try {
        await connect();
      } catch (e) {
        return failureFor(e);
      }
      // An acknowledgement that failed earlier gets another go now that the
      // store is reachable, before anything new is dispatched.
      await retryUnfinished();

      let resolveWaiter!: (r: PurchaseResult) => void;
      const waiter: Waiter = {
        sku,
        productKey: product.key,
        answer: (r) => {
          if (waiter.settled) return;
          waiter.settled = r;
          resolveWaiter(r);
        },
        promise: new Promise<PurchaseResult>((resolve) => {
          resolveWaiter = resolve;
        }),
      };
      waiters.add(waiter);
      // Recorded BEFORE dispatch: on a fast store the transaction can be
      // delivered before `requestPurchase` resolves.
      dispatchedSkus.add(sku);

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const apple = { sku };
        const google: Record<string, unknown> = { skus: [sku] };
        if (isSubs) {
          // Play needs an offer token to know WHICH base plan is being bought;
          // without one it cannot start the billing flow. `in-app` must NOT
          // carry the field — expo-iap rejects the mismatch outright
          // (`validateAndroidPurchaseBranchOptions`, `build/index.js:659-676`).
          if (meta?.offerToken) {
            google.subscriptionOffers = [{ sku, offerToken: meta.offerToken }];
          } else if (Platform.OS === "android") {
            console.warn(
              `expoIapProductProvider: no Play offer token for "${sku}" — the base plan cannot ` +
                `be selected and the purchase will fail. Author the ref as "productId:basePlanId".`
            );
          }
        }

        // ONE shape for every supported peer. `normalizeRequestProps` reads
        // `request.apple` / `request.google` in 5.x (`build/index.js:650-656`);
        // 4.x reads the same keys first and only warns when it falls back to
        // `request.ios` / `request.android` (4.7.2 `build/index.js:666-679`).
        // So there is nothing to version-probe here — and probing on
        // `fetchProducts` never worked anyway, since 4.4+ has it too.
        //
        // NOT wrapped in `withConnection`: see its comment. A retry here can
        // present a second store sheet.
        const dispatched = await M.requestPurchase({
          request: { apple, google },
          type: isSubs ? "subs" : "in-app",
        });

        // iOS resolves the transaction directly when StoreKit hands one back,
        // and `[]` / `null` otherwise (`build/index.js:745-751`). Route it
        // through the same handler — including the sku check, which the
        // listener path applies and this one used to skip.
        const direct = Array.isArray(dispatched) ? dispatched[0] : dispatched;
        if (direct && deliversFor(direct, sku)) await handleUpdated(direct);
        if (waiter.settled) return waiter.settled;

        // A peer too old to have `purchaseUpdatedListener` has no way to tell us
        // how this ended, so there is nothing to wait for.
        if (typeof M.purchaseUpdatedListener !== "function") return { status: "pending" };

        return await Promise.race([
          waiter.promise,
          new Promise<PurchaseResult>((resolve) => {
            timer = setTimeout(() => resolve({ status: "pending" }), purchaseTimeoutMs);
          }),
        ]);
      } catch (e: any) {
        // The store's own event is more specific than a rejection that may only
        // say `service-disconnected`, so an answer already delivered wins.
        return waiter.settled ?? failureFor(e);
      } finally {
        if (timer) clearTimeout(timer);
        // Only the ANSWER slot closes here. The listeners stay attached and the
        // sku stays in `dispatchedSkus`, so a verdict arriving after this call
        // has returned is still acknowledged.
        waiters.delete(waiter);
      }
    },

    async restore() {
      const M = required();
      try {
        const purchases = await withConnection(async () => {
          // `restorePurchases()` performs the iOS StoreKit sync first and then
          // refreshes, but deliberately returns nothing — "consumers should
          // call `getAvailablePurchases`" (`build/index.js:886-899`). Behind a
          // user-facing Restore button that sync is the point.
          if (typeof M.restorePurchases === "function") {
            await M.restorePurchases();
          }
          return M.getAvailablePurchases();
        });
        // `productId`, not `id`: `Purchase.id` is the TRANSACTION id and is
        // always set (`types.d.ts:1151`), so `p.id ?? p.productId` never fell
        // through and restore handed the host transaction ids to match against
        // its entitlements. `?? p.id` stays for a peer that only has the one.
        const ids = Array.from(
          new Set(
            (Array.isArray(purchases) ? purchases : [])
              .filter(isPaid)
              .map((p: any) => p.productId ?? p.id)
              .filter(Boolean)
          )
        ) as string[];
        return ids.length > 0
          ? { status: "restored" as const, entitlements: ids }
          : { status: "nothing_to_restore" as const };
      } catch (e) {
        return { status: "error" as const, error: asError(e) };
      }
    },
  };
};
