import { Platform } from "react-native";
import type { ProductProvider, ProductRef, ProductPeriod, ResolvedProduct } from "../types";

// Optional peer: expo-superwall (its `compat` entry, which mirrors the legacy
// React Native SDK's API). Same dynamic-require pattern as the other adapters:
// absent is not a crash, it is a clear error at call time.
//
// Only expo-superwall can do this. The legacy `@superwall/react-native-superwall`
// (2.x) has no public purchase/restore outside its own paywalls, so it cannot
// back a ProductProvider.
let SW: any;
try {
  SW = require("expo-superwall/compat");
} catch {
  SW = null;
}

// Same convention as revenueCat.ts: a day-based period is reported as "week".
const PERIOD: Record<string, ProductPeriod> = { D: "week", W: "week", M: "month", Y: "year" };

const idFor = (ref: ProductRef): string | undefined =>
  Platform.OS === "ios" ? ref.ios : ref.android;

const wholePositive = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0;

/**
 * ISO-8601 period from an expo-superwall `ProductResponse`. Prefers the
 * structured `subscriptionPeriod`, else the largest whole per-unit count
 * (a yearly product also reports `periodMonths: 12`). null = not a subscription.
 */
const toIso = (p: any): string | null => {
  const sp = p?.subscriptionPeriod;
  if (wholePositive(sp?.value) && typeof sp?.unit === "string") {
    const u = sp.unit.trim().charAt(0).toUpperCase();
    if (u in PERIOD) return `P${sp.value}${u}`;
  }
  const units: [unknown, string][] = [
    [p?.periodYears, "Y"],
    [p?.periodMonths, "M"],
    [p?.periodWeeks, "W"],
    [p?.periodDays, "D"],
  ];
  for (const [n, u] of units) if (wholePositive(n)) return `P${n}${u}`;
  return null;
};

const toTrial = (p: any): ResolvedProduct["trial"] => {
  if (!p?.hasFreeTrial || !wholePositive(p.trialPeriodDays)) return undefined;
  const days = p.trialPeriodDays;
  if (wholePositive(p.trialPeriodYears)) return { period: "year", periodCount: p.trialPeriodYears, days };
  if (wholePositive(p.trialPeriodMonths)) return { period: "month", periodCount: p.trialPeriodMonths, days };
  return { period: "week", periodCount: Math.max(1, Math.round(days / 7)), days };
};

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/**
 * Superwall-backed provider (expo-superwall >= 1.7, Expo SDK 53+). For an app
 * that keeps Superwall as the library that buys and finishes transactions while
 * Onboarding Studio decides and shows the paywalls.
 *
 * - `purchase` resolves `pending` (iOS Ask to Buy, Play slow payments): give the
 *   authored buy button an `onPending` branch, and never grant access from it.
 * - The purchase result carries no entitlements; read access from your source of
 *   truth (RevenueCat `CustomerInfo`, or `Superwall.shared.getEntitlements()`).
 * - Do NOT configure a Superwall `purchaseController` with this adapter: the
 *   purchase would route back through it and Superwall would no longer be the buyer.
 *
 * Pass the `expo-superwall/compat` module explicitly if you import it yourself;
 * otherwise the installed one is used.
 */
export const superwallProductProvider = (
  Superwall: any = SW?.default ?? SW,
): ProductProvider => {
  const required = () => {
    if (!Superwall) {
      throw new Error(
        "superwallProductProvider: expo-superwall is not installed. Install it (Expo SDK 53+), or pass a different ProductProvider.",
      );
    }
    return Superwall;
  };

  return {
    async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
      const S = required();
      const wanted = refs.map((ref) => ({ ref, id: idFor(ref) })).filter((w) => !!w.id);
      if (wanted.length === 0) return [];
      const found: any[] = (await S.products(wanted.map((w) => w.id as string))) ?? [];
      const byId = new Map<string, any>();
      for (const p of found) {
        if (p?.fullIdentifier) byId.set(p.fullIdentifier, p);
        if (p?.productIdentifier && !byId.has(p.productIdentifier)) byId.set(p.productIdentifier, p);
      }
      const out: ResolvedProduct[] = [];
      for (const { ref, id } of wanted) {
        const p = byId.get(id as string);
        if (!p) continue;
        const periodIso = toIso(p);
        const m = periodIso ? /^P(\d+)([DWMY])$/.exec(periodIso) : null;
        out.push({
          key: ref.key,
          // The id as authored, so purchase() sends Superwall back exactly what
          // the Studio holds (a full Android `productId:basePlanId[:offerId]` included).
          productId: id as string,
          store: Platform.OS === "ios" ? "app_store" : "play_store",
          title: "",
          description: "",
          price: p.localizedPrice ?? "",
          priceAmount: typeof p.price === "number" ? p.price : 0,
          currencyCode: p.currencyCode ?? "",
          period: m ? PERIOD[m[2]] : null,
          periodCount: m ? Number(m[1]) : 0,
          periodIso,
          trial: toTrial(p),
        });
      }
      return out;
    },

    async purchase(product) {
      const S = required();
      try {
        const r = await S.purchase(product.productId);
        switch (r?.type) {
          case "purchased":
            return { status: "purchased", productKey: product.key };
          case "cancelled":
            return { status: "cancelled" };
          case "pending":
            return { status: "pending" };
          default:
            return { status: "error", error: new Error(r?.error ?? "Superwall purchase failed") };
        }
      } catch (e) {
        return { status: "error", error: asError(e) };
      }
    },

    async restore() {
      const S = required();
      try {
        const r = await S.shared.restorePurchases();
        if (r?.result !== "restored") {
          return { status: "error", error: new Error(r?.errorMessage ?? "Superwall restore failed") };
        }
        const info = await S.shared.getEntitlements();
        const ents: string[] = (info?.active ?? []).map((e: any) => e.id).filter(Boolean);
        return ents.length > 0 ? { status: "restored", entitlements: ents } : { status: "nothing_to_restore" };
      } catch (e) {
        return { status: "error", error: asError(e) };
      }
    },
  };
};
