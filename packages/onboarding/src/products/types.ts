/** A product slot declared by the author: a stable key plus per-store ids. */
export type ProductRef = {
  /** Author-chosen slot name used in variables, e.g. "yearly" → product.yearly.price */
  key: string;
  /** App Store product identifier. */
  ios?: string;
  /** Play product identifier. `productId:basePlanId` — RevenueCat's convention. */
  android?: string;
  /** Another slot's key; savingsPct is computed against it. */
  compareTo?: string;
};

export type ProductPeriod = "week" | "month" | "year" | "lifetime";

/** A product as the store reports it. Prices here are authoritative. */
export type ResolvedProduct = {
  key: string;
  /** The identifier resolved for THIS platform. */
  productId: string;
  store: "app_store" | "play_store";
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
