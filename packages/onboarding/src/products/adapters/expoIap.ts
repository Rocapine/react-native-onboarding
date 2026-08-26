import { Platform } from "react-native";
import type { ProductProvider, ProductRef, ProductPeriod, ResolvedProduct } from "../types";

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
  const map: Record<string, ProductPeriod> = { D: "week", W: "week", M: "month", Y: "year" };
  return { period: map[m[2]] ?? null, count: Number(m[1]) };
};

// expo-iap surfaces a user cancellation as a code rather than a typed error.
const isCancellation = (e: any): boolean =>
  e?.code === "E_USER_CANCELLED" || e?.code === "USER_CANCELED" || e?.userCancelled === true;

const idFor = (ref: ProductRef): string | undefined =>
  Platform.OS === "ios" ? ref.ios : ref.android;

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
 *     `subscriptionPeriodNumberIOS`) and the Android one buried in the first
 *     pricing phase of the first subscription offer
 * All three are read, newest-shape-last so an older peer keeps working.
 */
const periodIsoFrom = (s: any): string | null => {
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

  const androidPeriod =
    s?.subscriptionOffers?.[0]?.pricingPhasesAndroid?.pricingPhaseList?.[0]?.billingPeriod;
  return typeof androidPeriod === "string" && androidPeriod ? androidPeriod : null;
};

/** Direct StoreKit / Play Billing provider, no vendor in the path. */
export const expoIapProductProvider = (Iap: any = IAP): ProductProvider => {
  const required = () => {
    if (!Iap) {
      throw new Error(
        "expoIapProductProvider: expo-iap is not installed. Install it, or pass a different ProductProvider."
      );
    }
    return Iap;
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
    if (typeof M.initConnection !== "function") return; // older peer: implicit connection
    if (!connecting) {
      connecting = Promise.resolve(M.initConnection()).catch((e: unknown) => {
        connecting = null;
        throw e;
      });
    }
    await connecting;
  };

  // The raw store product per resolved productId, captured during getProducts.
  // `purchase()` needs expo-iap's own `type` discriminator ("in-app" | "subs")
  // and the full Purchase to finish, neither of which survives the trip through
  // `ResolvedProduct`. Same pattern as stripeLink's `linkByKey`.
  const rawById = new Map<string, any>();

  return {
    async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
      const M = required();
      const wanted = refs.map((r) => ({ ref: r, id: idFor(r) })).filter((x) => !!x.id);
      if (wanted.length === 0) return [];
      await connect();
      const skus = wanted.map((w) => w.id as string);

      // 5.x renamed `getProducts(skus)` to `fetchProducts({ skus, type })` — an
      // object arg, not a positional array. Calling the old name on 5.x throws
      // "M.getProducts is not a function", so probe rather than assume; `"all"`
      // because a paywall mixes subscriptions and one-off lifetime products.
      const store =
        typeof M.fetchProducts === "function"
          ? await M.fetchProducts({ skus, type: "all" })
          : await M.getProducts(skus);

      const list: any[] = Array.isArray(store) ? store : [];
      const byId = new Map<string, any>(list.map((s: any) => [s.id ?? s.productId, s]));
      rawById.clear();
      const out: ResolvedProduct[] = [];
      for (const { ref, id } of wanted) {
        const s = byId.get(id as string);
        if (!s) continue;
        const productId = s.id ?? s.productId;
        rawById.set(productId, s);
        const iso = periodIsoFrom(s);
        const { period, count } = toPeriod(iso);
        out.push({
          key: ref.key,
          productId,
          store: Platform.OS === "ios" ? "app_store" : "play_store",
          title: s.title ?? "",
          description: s.description ?? "",
          price: s.displayPrice ?? s.localizedPrice ?? "",
          priceAmount: Number(s.price ?? 0),
          currencyCode: s.currency ?? s.currencyCode ?? "",
          period,
          periodCount: count,
          periodIso: iso,
        });
      }
      return out;
    },

    async purchase(product) {
      const M = required();
      try {
        await connect();
        const raw = rawById.get(product.productId);
        // A non-null period means a subscription even when the raw product is
        // missing (a host that hydrated the runtime from elsewhere).
        const isSubs = (raw?.type ?? (product.period ? "subs" : "in-app")) === "subs";
        const sku = product.productId;

        // 5.x wants `{ request: { ios, android }, type }`. The old flat
        // `{ request: { sku } }` reaches neither platform branch, so StoreKit is
        // handed an undefined sku. `type` is required to tell a subscription
        // from a one-off — Play rejects the wrong one outright.
        const args =
          typeof M.fetchProducts === "function"
            ? {
                request: { ios: { sku }, android: { skus: [sku] } },
                type: isSubs ? "subs" : "in-app",
              }
            : { request: { sku } };

        const result = await M.requestPurchase(args as any);

        // `requestPurchase` resolves `Purchase | Purchase[] | null`. `null` is
        // the normal 5.x outcome: the transaction is delivered to
        // `purchaseUpdatedListener` instead, so at this point nothing is
        // confirmed. Reporting "purchased" there would grant access for a
        // purchase that may still fail — hence "pending", which is exactly the
        // outcome `PurchaseButtonAction.onPending` exists to handle.
        const purchase = Array.isArray(result) ? result[0] : result;
        if (!purchase) return { status: "pending" };

        // Unfinished transactions are re-delivered by StoreKit on every launch
        // until finished. Best-effort: a failure here does not un-buy anything,
        // so it must not turn a completed purchase into an error.
        if (typeof M.finishTransaction === "function") {
          try {
            await M.finishTransaction({ purchase, isConsumable: false });
          } catch {
            // ignore — reported as purchased, will be re-delivered and finished later
          }
        }
        return { status: "purchased", productKey: product.key };
      } catch (e: any) {
        if (isCancellation(e)) return { status: "cancelled" };
        return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
      }
    },

    async restore() {
      const M = required();
      try {
        await connect();
        const purchases = await M.getAvailablePurchases();
        const ids: string[] = (purchases ?? []).map((p: any) => p.id ?? p.productId).filter(Boolean);
        return ids.length > 0
          ? { status: "restored", entitlements: ids }
          : { status: "nothing_to_restore" };
      } catch (e) {
        return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  };
};
