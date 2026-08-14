import { Platform } from "react-native";
import type { ProductProvider, ProductRef, ProductPeriod, ResolvedProduct } from "../types";

// Optional peer: react-native-purchases. Same dynamic-require pattern as
// elements/haptics.ts — absent is not a crash, it is a clear error at call time.
let RC: any;
try {
  RC = require("react-native-purchases");
} catch {
  RC = null;
}

const PERIOD_UNIT: Record<string, ProductPeriod> = {
  DAY: "week", WEEK: "week", MONTH: "month", YEAR: "year",
};

const toPeriod = (iso: string | null | undefined): { period: ProductPeriod | null; count: number } => {
  if (!iso) return { period: null, count: 0 };
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return { period: null, count: 0 };
  const unit = { D: "DAY", W: "WEEK", M: "MONTH", Y: "YEAR" }[m[2]]!;
  return { period: PERIOD_UNIT[unit] ?? null, count: Number(m[1]) };
};

const idFor = (ref: ProductRef): string | undefined =>
  Platform.OS === "ios" ? ref.ios : ref.android;

/**
 * RevenueCat-backed provider. Pass the `Purchases` module explicitly if you have
 * a custom instance; otherwise the installed one is used.
 */
export const revenueCatProductProvider = (Purchases: any = RC?.default ?? RC): ProductProvider => {
  const required = () => {
    if (!Purchases) {
      throw new Error(
        "revenueCatProductProvider: react-native-purchases is not installed. Install it, or pass a different ProductProvider."
      );
    }
    return Purchases;
  };

  return {
    async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
      const P = required();
      const wanted = refs.map((r) => ({ ref: r, id: idFor(r) })).filter((x) => !!x.id);
      if (wanted.length === 0) return [];
      const store = await P.getProducts(wanted.map((w) => w.id as string));
      const byId = new Map<string, any>(store.map((s: any) => [s.identifier, s]));
      const out: ResolvedProduct[] = [];
      for (const { ref, id } of wanted) {
        const s = byId.get(id as string);
        if (!s) continue;
        const { period, count } = toPeriod(s.subscriptionPeriod);
        out.push({
          key: ref.key,
          productId: s.identifier,
          store: Platform.OS === "ios" ? "app_store" : "play_store",
          title: s.title ?? "",
          description: s.description ?? "",
          price: s.priceString,
          priceAmount: s.price,
          currencyCode: s.currencyCode,
          period,
          periodCount: count,
          periodIso: s.subscriptionPeriod ?? null,
          trial: s.introPrice && s.introPrice.price === 0
            ? {
                period: toPeriod(s.introPrice.periodISO).period ?? "week",
                periodCount: toPeriod(s.introPrice.periodISO).count,
                days: 0,
              }
            : undefined,
        });
      }
      return out;
    },

    async purchase(product) {
      const P = required();
      try {
        const store = await P.getProducts([product.productId]);
        if (!store[0]) return { status: "error", error: new Error(`Unknown product ${product.productId}`) };
        const res = await P.purchaseStoreProduct(store[0]);
        return {
          status: "purchased",
          productKey: product.key,
          entitlements: Object.keys(res?.customerInfo?.entitlements?.active ?? {}),
        };
      } catch (e: any) {
        if (e?.userCancelled) return { status: "cancelled" };
        return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
      }
    },

    async restore() {
      const P = required();
      try {
        const info = await P.restorePurchases();
        const ents = Object.keys(info?.entitlements?.active ?? {});
        return ents.length > 0
          ? { status: "restored", entitlements: ents }
          : { status: "nothing_to_restore" };
      } catch (e) {
        return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  };
};
