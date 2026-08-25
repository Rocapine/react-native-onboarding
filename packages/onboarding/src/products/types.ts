/**
 * A Stripe Payment Link and the price to render beside it.
 *
 * Unlike `ios`/`android` — which are ids a store resolves at runtime — this
 * block is the RESOLVED product. There is no Stripe runtime to ask: listing a
 * price needs a secret key, and by design nobody in this system holds one
 * (not the host, not Onboarding Studio). So the studio copies the authored
 * price onto the ref, and `stripeLinkProductProvider` synthesises a
 * `ResolvedProduct` from it without any network call.
 *
 * Consequence the author owns: this price can DRIFT from Stripe. Nothing
 * reconciles them.
 */
export type StripeProductRef = {
  /** `https://buy.stripe.com/...`, pre-created in Stripe. Required — nothing to open without it. */
  paymentLink: string;
  /** `price_...`. Informational in this version; kept for reconciliation and a future proxy mode. */
  priceId?: string;
  /** Major units (79, not 7900), matching `project_products.stripe_price.amount`. */
  amount: number;
  /** ISO-4217, e.g. "USD". */
  currency: string;
  /** ISO-8601, e.g. "P1Y". Drives `pricePerWeek` and friends via `deriveProductFields`. */
  periodIso?: string | null;
  trialDays?: number;
};

/** A product slot declared by the author: a stable key plus per-store ids. */
export type ProductRef = {
  /** Author-chosen slot name used in variables, e.g. "yearly" → product.yearly.price */
  key: string;
  /** App Store product identifier. */
  ios?: string;
  /** Play product identifier. `productId:basePlanId` — RevenueCat's convention. */
  android?: string;
  /** Stripe Payment Link + authored price. Present only on a `billing: "stripe"` paywall's refs. */
  stripe?: StripeProductRef;
  /** Another slot's key; savingsPct is computed against it. */
  compareTo?: string;
};

export type ProductPeriod = "week" | "month" | "year" | "lifetime";

/** A product as the store reports it. Prices here are authoritative. */
export type ResolvedProduct = {
  key: string;
  /** The identifier resolved for THIS platform. */
  productId: string;
  store: "app_store" | "play_store" | "stripe";
  title: string;
  description: string;
  /** Store-localized, pre-formatted, e.g. "$59.99". Display this. */
  price: string;
  priceAmount: number;
  currencyCode: string;
  period: ProductPeriod | null;
  periodCount: number;
  /** ISO-8601 duration, e.g. "P1Y". null for non-subscriptions. */
  periodIso: string | null;
  introOffer?: {
    price: string;
    priceAmount: number;
    period: ProductPeriod;
    periodCount: number;
    cycles: number;
  };
  trial?: { period: ProductPeriod; periodCount: number; days: number };
};

/**
 * Computed by the SDK, never by an adapter — so every provider produces
 * identical semantics and formatting.
 */
export type DerivedProductFields = {
  /**
   * Per-day price. The value the other three are derived FROM — it was computed
   * and discarded before 1.68.0, so the per-day framing that anchors most trial
   * paywalls ("$0.43 / day" beside "$39.99 / quarter") could not be authored at
   * all. Absent whenever the period is unparseable, exactly like its siblings.
   */
  pricePerDay?: string;
  pricePerDayAmount?: number;
  pricePerWeek?: string;
  pricePerWeekAmount?: number;
  pricePerMonth?: string;
  pricePerMonthAmount?: number;
  pricePerYear?: string;
  pricePerYearAmount?: number;
  /** Whole percent cheaper than `compareTo`, normalized per day. Absent if not cheaper. */
  savingsPct?: number;
  trialDays?: number;
};

export type ProductWithDerived = ResolvedProduct & DerivedProductFields;

export type PurchaseResult =
  | { status: "purchased"; productKey: string; entitlements?: string[] }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error"; error: Error };

export type RestoreResult =
  | { status: "restored"; entitlements: string[] }
  | { status: "nothing_to_restore" }
  | { status: "error"; error: Error };

/** The vendor seam. Implement this to back paywalls with any billing SDK. */
export interface ProductProvider {
  getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]>;
  purchase(product: ResolvedProduct): Promise<PurchaseResult>;
  restore(): Promise<RestoreResult>;
}

export type ProductStatus = "idle" | "loading" | "ready" | "error";

/** What a host puts on ScreenHost.products; what press actions dispatch through. */
export type ProductRuntime = {
  products: Record<string, ProductWithDerived>;
  status: ProductStatus;
  error?: string;
  /** In-flight purchase guard, surfaced as the `products.purchasing` variable. */
  purchasing: boolean;
  purchase: (key: string) => Promise<PurchaseResult>;
  restore: () => Promise<RestoreResult>;
};
