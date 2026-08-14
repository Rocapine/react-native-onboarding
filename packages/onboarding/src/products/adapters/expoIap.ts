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

  return {
    async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
      const M = required();
      const wanted = refs.map((r) => ({ ref: r, id: idFor(r) })).filter((x) => !!x.id);
      if (wanted.length === 0) return [];
      const skus = wanted.map((w) => w.id as string);
      const store = await M.getProducts(skus);
      const byId = new Map<string, any>(store.map((s: any) => [s.id ?? s.productId, s]));
      const out: ResolvedProduct[] = [];
      for (const { ref, id } of wanted) {
        const s = byId.get(id as string);
        if (!s) continue;
        const iso = s.subscriptionPeriodISO ?? s.subscriptionPeriod ?? null;
        const { period, count } = toPeriod(iso);
        out.push({
          key: ref.key,
          productId: s.id ?? s.productId,
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
        await M.requestPurchase({ request: { sku: product.productId } });
        return { status: "purchased", productKey: product.key };
      } catch (e: any) {
        if (isCancellation(e)) return { status: "cancelled" };
        return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
      }
    },

    async restore() {
      const M = required();
      try {
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
