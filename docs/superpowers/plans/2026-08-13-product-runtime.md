# Product Runtime Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve real store products at runtime behind a vendor-neutral `ProductProvider`, project them into the existing variable bag as flat dotted keys, and add `purchase` / `restore` press actions — so a screen can display live prices and sell.

**Architecture:** A `ProductProvider` interface is dependency-injected (same precedent as `OnboardingNavigationAdapter` and the Phase 1 `ScreenHost`). The SDK — not the adapter — computes derived fields (`pricePerWeek`, `savingsPct`, …) so every provider yields identical semantics. Resolved products are projected to **flat dotted variable keys** (`product.yearly.price`), which the existing `interpolate()` and `evaluateCondition` consume with **zero engine changes**. Two optional adapters ship (RevenueCat, expo-iap) via the `try { require() } catch` pattern already used by `haptics.ts`.

**Tech Stack:** TypeScript, Zod v4, React 19, React Native 0.85, vitest (both packages, added in Phase 1).

**Spec:** `docs/superpowers/specs/2026-08-11-paywall-rendering-engine-design.md` (§4 Product runtime; §2 decisions)

## Global Constraints

- **No new npm packages and no new peer dependencies.** Both adapters load their vendor SDK through `try { require(...) } catch` and degrade to a clear error when absent — precedent: `packages/onboarding-ui/src/UI/Runtime/elements/haptics.ts`.
- **Never render a price that came from the CMS.** Every displayed price originates from the provider (i.e. the store). Spec §2.2: App Review rejects paywalls whose displayed price differs from StoreKit.
- **Existing import paths keep working.** Both packages ship `src` **and** `dist`; `onboarding-studio` pins a published version and imports from the package root. New exports only — no removals or renames.
- **Preserve the element memoization architecture.** `RenderContext` must stay referentially stable across variable writes; volatile maps travel through `VariablesContext`. Anything added to `RenderContext` must be referentially stable, or memoized `ElementHost`s re-render on every write. No type error and no test catches this.
- **The headless schema validates the payload.** A UI-only action arm still fails parsing with `invalid_union`. Every schema change lands in `packages/onboarding/src/steps/common.types.ts` **and** its UI mirror `packages/onboarding-ui/src/UI/Runtime/elements/actions.ts`, with identical field sets.
- **Do not bump any package version.** Versions are enforced across five files by `scripts/check-versions.mjs`; the bump belongs to the release, via the `bump-version` skill.
- Run all commands from the repo root unless a task says otherwise.

## Scope

Implements spec §4 **except** the `dismiss` and `presentPaywall` actions, which are deferred to Phase 5 along with the `PaywallProvider` / `PaywallHost` that give them meaning. Shipping them now would add schema arms that validate and then no-op — the same silent-failure mode as the existing unregistered-`custom` warning.

**One spec field intentionally dropped.** Spec §4.3 lists `totalPrice` among the derived fields. It would equal `priceAmount` for the full period — i.e. exactly what `product.<key>.price` already reports — so it is omitted rather than shipped as a confusing alias. If a genuine "total across N periods" need appears, add it then with a defined meaning.

**Where product refs are declared.** The `ComposableScreen` payload schema has no `products` field, and adding one would touch the 4-way schema mirror plus onboarding-studio — Phase 4 territory. So in Phase 3 the **host app declares its refs on `OnboardingProvider`**, they resolve once, and they are visible to every screen. Per-paywall declaration arrives with the paywall entity in Phase 4. This keeps Phase 3 SDK-only and schema-free.

---

## File Structure

**Headless — `packages/onboarding/src/products/` (new module)**

| Path | Responsibility |
|---|---|
| `types.ts` | `ProductRef`, `ResolvedProduct`, `PurchaseResult`, `RestoreResult`, `ProductProvider`, `ProductRuntime`, `ProductWithDerived`. Types only, no logic. |
| `duration.ts` | `parseIsoDuration` — ISO-8601 period → days. Pure. |
| `derive.ts` | `formatCurrency`, `deriveProductFields`, `deriveAll`. Pure; the per-provider-consistency guarantee lives here. |
| `toVariables.ts` | `productVariables` — resolved products → flat dotted `ComposableVariableEntry` map. Pure. |
| `useProducts.ts` | React hook owning resolution state; returns `ProductRuntime`. |
| `adapters/revenueCat.ts` | `revenueCatProductProvider` — optional `react-native-purchases`. |
| `adapters/expoIap.ts` | `expoIapProductProvider` — optional `expo-iap`. |
| `index.ts` | Public surface of the module. |

**Headless — modified**

| Path | Change |
|---|---|
| `src/steps/common.types.ts` | `PurchaseButtonAction` + `RestoreButtonAction` types & schemas; widen `ButtonAction` / `ButtonActionSchema`. |
| `src/infra/provider/OnboardingProvider.tsx` | Optional `productProvider` + `products` props; resolve via `useProducts`; publish `ProductRuntime` on context. |
| `src/index.ts` | Export the products module. |

**UI — modified**

| Path | Change |
|---|---|
| `src/UI/Runtime/ScreenHost.ts` | `products?: ProductRuntime`. |
| `src/UI/Runtime/elements/shared.ts` | `RenderContext.products?: ProductRuntime`. |
| `src/UI/Runtime/ScreenRenderer.tsx` | Overlay product variables; pass `products` into `ctx`. |
| `src/UI/Runtime/variables.ts` | `withProductVariables` — pure overlay. |
| `src/UI/Runtime/elements/actions.ts` | UI mirror of the two new action arms. |
| `src/UI/Runtime/elements/runActions.ts` | `purchase` / `restore` dispatch. |
| `src/UI/Pages/ComposableScreen/Renderer.tsx` | Put the headless `ProductRuntime` on the host. |

---

### Task 1: Headless — product types and derived fields

**Files:**
- Create: `packages/onboarding/src/products/types.ts`
- Create: `packages/onboarding/src/products/duration.ts`
- Create: `packages/onboarding/src/products/derive.ts`
- Test: `packages/onboarding/src/__tests__/productDerive.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `parseIsoDuration(iso: string): number | null` — days, `null` when unparseable.
  - `formatCurrency(amount: number, currencyCode: string, locale?: string): string`
  - `deriveProductFields(p: ResolvedProduct, opts?: { compareTo?: ResolvedProduct; locale?: string }): DerivedProductFields`
  - `deriveAll(products: ResolvedProduct[], refs: ProductRef[], locale?: string): Record<string, ProductWithDerived>` — keyed by `ProductRef.key`.
  - Types: `ProductRef`, `ResolvedProduct`, `PurchaseResult`, `RestoreResult`, `ProductProvider`, `ProductRuntime`, `DerivedProductFields`, `ProductWithDerived`.

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/__tests__/productDerive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseIsoDuration } from "../products/duration";
import { formatCurrency, deriveProductFields, deriveAll } from "../products/derive";
import type { ResolvedProduct, ProductRef } from "../products/types";

const make = (over: Partial<ResolvedProduct> = {}): ResolvedProduct => ({
  key: "yearly",
  productId: "com.app.yearly",
  store: "app_store",
  title: "Yearly",
  description: "",
  price: "$59.99",
  priceAmount: 59.99,
  currencyCode: "USD",
  period: "year",
  periodCount: 1,
  periodIso: "P1Y",
  ...over,
});

describe("parseIsoDuration", () => {
  it("parses the store-standard periods to days", () => {
    expect(parseIsoDuration("P1W")).toBe(7);
    expect(parseIsoDuration("P1M")).toBe(30);
    expect(parseIsoDuration("P3M")).toBe(90);
    expect(parseIsoDuration("P6M")).toBe(180);
    expect(parseIsoDuration("P1Y")).toBe(365);
    expect(parseIsoDuration("P7D")).toBe(7);
  });

  it("returns null for junk rather than guessing", () => {
    expect(parseIsoDuration("")).toBeNull();
    expect(parseIsoDuration("1Y")).toBeNull();
    expect(parseIsoDuration("PT1H")).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("formats in the product's currency, not the device's", () => {
    expect(formatCurrency(1.15, "USD", "en-US")).toBe("$1.15");
  });

  it("does not throw on an unknown currency code", () => {
    expect(() => formatCurrency(5, "XYZ", "en-US")).not.toThrow();
  });
});

describe("deriveProductFields", () => {
  it("computes per-period prices from the ISO period", () => {
    const d = deriveProductFields(make(), { locale: "en-US" });
    // 59.99 / (365/7) weeks
    expect(d.pricePerWeekAmount).toBeCloseTo(1.1504, 3);
    expect(d.pricePerWeek).toBe("$1.15");
    expect(d.pricePerMonthAmount).toBeCloseTo(4.9307, 3);
  });

  it("leaves savingsPct undefined without a compareTo", () => {
    expect(deriveProductFields(make(), { locale: "en-US" }).savingsPct).toBeUndefined();
  });

  it("computes savingsPct against a normalized per-day comparison", () => {
    const yearly = make();                                     // 59.99 / 365d
    const monthly = make({ key: "monthly", priceAmount: 9.99, periodIso: "P1M" }); // 9.99 / 30d
    const d = deriveProductFields(yearly, { compareTo: monthly, locale: "en-US" });
    // yearly/day = 0.16436, monthly/day = 0.333 → ~51% cheaper
    expect(d.savingsPct).toBe(51);
  });

  it("omits savingsPct when the comparison is not cheaper", () => {
    const a = make({ priceAmount: 400 });
    const b = make({ key: "monthly", priceAmount: 9.99, periodIso: "P1M" });
    expect(deriveProductFields(a, { compareTo: b }).savingsPct).toBeUndefined();
  });

  it("derives trialDays from the trial period", () => {
    const p = make({ trial: { period: "week", periodCount: 1, days: 0 } });
    expect(deriveProductFields(p).trialDays).toBe(7);
  });

  it("returns no per-period prices when the period is unparseable", () => {
    const d = deriveProductFields(make({ periodIso: null, period: null }));
    expect(d.pricePerWeek).toBeUndefined();
    expect(d.pricePerWeekAmount).toBeUndefined();
  });
});

describe("deriveAll", () => {
  const refs: ProductRef[] = [
    { key: "yearly", ios: "com.app.yearly", compareTo: "monthly" },
    { key: "monthly", ios: "com.app.monthly" },
  ];

  it("keys results by ref key and resolves compareTo between them", () => {
    const products = [
      make(),
      make({ key: "monthly", priceAmount: 9.99, periodIso: "P1M", period: "month" }),
    ];
    const out = deriveAll(products, refs, "en-US");
    expect(Object.keys(out).sort()).toEqual(["monthly", "yearly"]);
    expect(out.yearly.savingsPct).toBe(51);
    expect(out.monthly.savingsPct).toBeUndefined();
  });

  it("ignores a compareTo pointing at a missing key", () => {
    const out = deriveAll([make()], [{ key: "yearly", compareTo: "nope" }], "en-US");
    expect(out.yearly.savingsPct).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=packages/onboarding -- productDerive`
Expected: FAIL — `Cannot find module '../products/duration'`.

- [ ] **Step 3: Write `types.ts`**

Create `packages/onboarding/src/products/types.ts`:

```ts
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
```

- [ ] **Step 4: Write `duration.ts`**

Create `packages/onboarding/src/products/duration.ts`:

```ts
// Store-standard ISO-8601 subscription periods only: P1W / P1M / P3M / P1Y / P7D.
// Time components (PT1H) are not subscription periods and are rejected rather
// than silently coerced — a wrong period would corrupt every per-period price.
const ISO_PERIOD = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/;

const DAYS_PER = { year: 365, month: 30, week: 7, day: 1 } as const;

/** ISO-8601 period → whole days. `null` when unparseable or empty (bare "P"). */
export const parseIsoDuration = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const m = ISO_PERIOD.exec(iso);
  if (!m) return null;
  const [, y, mo, w, d] = m;
  if (!y && !mo && !w && !d) return null;
  return (
    Number(y ?? 0) * DAYS_PER.year +
    Number(mo ?? 0) * DAYS_PER.month +
    Number(w ?? 0) * DAYS_PER.week +
    Number(d ?? 0) * DAYS_PER.day
  );
};
```

- [ ] **Step 5: Write `derive.ts`**

Create `packages/onboarding/src/products/derive.ts`:

```ts
import { parseIsoDuration } from "./duration";
import type {
  DerivedProductFields,
  ProductRef,
  ProductWithDerived,
  ResolvedProduct,
} from "./types";

/**
 * Format in the PRODUCT's currency, not the device's. Falls back to a plain
 * `amount currencyCode` string if Intl rejects the code, so a bad code degrades
 * to something readable instead of throwing mid-render.
 */
export const formatCurrency = (
  amount: number,
  currencyCode: string,
  locale?: string
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
};

const perDay = (p: ResolvedProduct): number | null => {
  const days = parseIsoDuration(p.periodIso);
  if (!days || days <= 0) return null;
  return p.priceAmount / days;
};

/**
 * Derived fields for one product. `compareTo` enables `savingsPct`, computed on
 * a normalized per-day basis so a yearly plan can be compared to a monthly one.
 * These are FRAMING values ("$1.15/week"), never presented as the charged amount.
 */
export const deriveProductFields = (
  p: ResolvedProduct,
  opts: { compareTo?: ResolvedProduct; locale?: string } = {}
): DerivedProductFields => {
  const { compareTo, locale } = opts;
  const out: DerivedProductFields = {};

  const daily = perDay(p);
  if (daily != null) {
    const week = daily * 7;
    const month = daily * 30;
    const year = daily * 365;
    out.pricePerWeekAmount = week;
    out.pricePerWeek = formatCurrency(week, p.currencyCode, locale);
    out.pricePerMonthAmount = month;
    out.pricePerMonth = formatCurrency(month, p.currencyCode, locale);
    out.pricePerYearAmount = year;
    out.pricePerYear = formatCurrency(year, p.currencyCode, locale);
  }

  if (compareTo) {
    const otherDaily = perDay(compareTo);
    if (daily != null && otherDaily != null && otherDaily > 0 && daily < otherDaily) {
      out.savingsPct = Math.round((1 - daily / otherDaily) * 100);
    }
  }

  if (p.trial) {
    const days =
      p.trial.days > 0
        ? p.trial.days
        : (parseIsoDuration(`P${p.trial.periodCount}${p.trial.period === "week" ? "W" : p.trial.period === "month" ? "M" : p.trial.period === "year" ? "Y" : "D"}`) ?? 0);
    if (days > 0) out.trialDays = days;
  }

  return out;
};

/** Derive every product, keyed by its ref key, resolving `compareTo` between them. */
export const deriveAll = (
  products: ResolvedProduct[],
  refs: ProductRef[],
  locale?: string
): Record<string, ProductWithDerived> => {
  const byKey = new Map(products.map((p) => [p.key, p]));
  const out: Record<string, ProductWithDerived> = {};
  for (const ref of refs) {
    const p = byKey.get(ref.key);
    if (!p) continue;
    const compareTo = ref.compareTo ? byKey.get(ref.compareTo) : undefined;
    out[ref.key] = { ...p, ...deriveProductFields(p, { compareTo, locale }) };
  }
  return out;
};
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test --workspace=packages/onboarding -- productDerive`
Expected: PASS.

- [ ] **Step 7: Build and commit**

```bash
npm run build:headless
git add packages/onboarding/src/products packages/onboarding/src/__tests__/productDerive.test.ts
git commit -m "✨ feat(headless): product types + derived price fields"
```

---

### Task 2: Headless — project products into variables

**Files:**
- Create: `packages/onboarding/src/products/toVariables.ts`
- Test: `packages/onboarding/src/__tests__/productVariables.test.ts`

**Interfaces:**
- Consumes: `ProductWithDerived`, `ProductRuntime` from Task 1's `products/types.ts`.
- Produces: `productVariables(runtime: Pick<ProductRuntime, "products" | "status" | "error" | "purchasing">): Record<string, ComposableVariableEntry>` — flat dotted keys.

Flat dotted keys are the whole trick: `interpolate()` resolves `{{key}}` with a flat `variables[key]` lookup and `evaluateCondition` reads `flatVariables` the same way, so `{{product.yearly.price}}` and `renderWhen: { variable: "products.loaded", operator: "eq", value: "true" }` work with **no engine change**.

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/__tests__/productVariables.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { productVariables } from "../products/toVariables";
import type { ProductWithDerived } from "../products/types";

const yearly: ProductWithDerived = {
  key: "yearly",
  productId: "com.app.yearly",
  store: "app_store",
  title: "Yearly Plan",
  description: "A year",
  price: "$59.99",
  priceAmount: 59.99,
  currencyCode: "USD",
  period: "year",
  periodCount: 1,
  periodIso: "P1Y",
  pricePerWeek: "$1.15",
  pricePerWeekAmount: 1.1504,
  savingsPct: 51,
  trialDays: 7,
};

describe("productVariables", () => {
  it("emits flat dotted keys the interpolator can resolve", () => {
    const v = productVariables({ products: { yearly }, status: "ready", purchasing: false });
    expect(v["product.yearly.price"].value).toBe("$59.99");
    expect(v["product.yearly.pricePerWeek"].value).toBe("$1.15");
    expect(v["product.yearly.savingsPct"].value).toBe("51");
    expect(v["product.yearly.trialDays"].value).toBe("7");
    expect(v["product.yearly.title"].value).toBe("Yearly Plan");
    expect(v["product.yearly.period"].value).toBe("year");
  });

  it("stringifies every value — the variable bag is string-based", () => {
    const v = productVariables({ products: { yearly }, status: "ready", purchasing: false });
    for (const entry of Object.values(v)) {
      expect(typeof entry.value).toBe("string");
    }
  });

  it("omits absent optional fields rather than emitting empty strings", () => {
    const bare = { ...yearly, savingsPct: undefined, trialDays: undefined };
    const v = productVariables({ products: { yearly: bare }, status: "ready", purchasing: false });
    expect(v["product.yearly.savingsPct"]).toBeUndefined();
    expect(v["product.yearly.trialDays"]).toBeUndefined();
  });

  it("publishes status flags authors gate the CTA on", () => {
    const ready = productVariables({ products: {}, status: "ready", purchasing: false });
    expect(ready["products.loaded"].value).toBe("true");
    expect(ready["products.purchasing"].value).toBe("false");

    const failed = productVariables({
      products: {},
      status: "error",
      error: "network down",
      purchasing: false,
    });
    expect(failed["products.loaded"].value).toBe("false");
    expect(failed["products.error"].value).toBe("network down");
  });

  it("reports loaded=false while still loading", () => {
    const v = productVariables({ products: {}, status: "loading", purchasing: false });
    expect(v["products.loaded"].value).toBe("false");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=packages/onboarding -- productVariables`
Expected: FAIL — `Cannot find module '../products/toVariables'`.

- [ ] **Step 3: Write `toVariables.ts`**

Create `packages/onboarding/src/products/toVariables.ts`:

```ts
import type { ComposableVariableEntry } from "../steps/ComposableScreen/types";
import type { ProductRuntime } from "./types";

/**
 * Resolved products → the variable bag, as FLAT DOTTED KEYS
 * (`product.yearly.pricePerWeek`). `interpolate()` resolves `{{key}}` with a
 * flat `variables[key]` lookup and `evaluateCondition` reads `flatVariables`
 * the same way, so this needs no engine change.
 *
 * Optional fields are OMITTED when absent rather than emitted empty: a missing
 * key interpolates to "" anyway, but an absent key also makes
 * `renderWhen: { "product.x.savingsPct": { is_not_empty: true } }` behave.
 */
export const productVariables = (
  runtime: Pick<ProductRuntime, "products" | "status" | "error" | "purchasing">
): Record<string, ComposableVariableEntry> => {
  const out: Record<string, ComposableVariableEntry> = {};

  const put = (key: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null) return;
    out[key] = { value: String(value) };
  };

  for (const [key, p] of Object.entries(runtime.products)) {
    const b = `product.${key}`;
    put(`${b}.productId`, p.productId);
    put(`${b}.title`, p.title);
    put(`${b}.description`, p.description);
    put(`${b}.price`, p.price);
    put(`${b}.priceAmount`, p.priceAmount);
    put(`${b}.currencyCode`, p.currencyCode);
    put(`${b}.period`, p.period);
    put(`${b}.periodCount`, p.periodCount);
    put(`${b}.pricePerWeek`, p.pricePerWeek);
    put(`${b}.pricePerWeekAmount`, p.pricePerWeekAmount);
    put(`${b}.pricePerMonth`, p.pricePerMonth);
    put(`${b}.pricePerMonthAmount`, p.pricePerMonthAmount);
    put(`${b}.pricePerYear`, p.pricePerYear);
    put(`${b}.pricePerYearAmount`, p.pricePerYearAmount);
    put(`${b}.savingsPct`, p.savingsPct);
    put(`${b}.trialDays`, p.trialDays);
    put(`${b}.introPrice`, p.introOffer?.price);
  }

  out["products.loaded"] = { value: runtime.status === "ready" ? "true" : "false" };
  out["products.purchasing"] = { value: runtime.purchasing ? "true" : "false" };
  out["products.error"] = { value: runtime.error ?? "" };

  return out;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test --workspace=packages/onboarding -- productVariables`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run build:headless
git add packages/onboarding/src/products/toVariables.ts packages/onboarding/src/__tests__/productVariables.test.ts
git commit -m "✨ feat(headless): project resolved products into flat dotted variables"
```

---

### Task 3: Plumb `ProductRuntime` through the engine

**Files:**
- Modify: `packages/onboarding-ui/src/UI/Runtime/ScreenHost.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/elements/shared.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/variables.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/ScreenRenderer.tsx`
- Test: `packages/onboarding-ui/src/UI/Runtime/__tests__/variables.test.ts` (extend)

**Interfaces:**
- Consumes: `ProductRuntime` + `productVariables` from Tasks 1–2, imported from `@rocapine/react-native-onboarding`.
- Produces: `ScreenHost.products?: ProductRuntime`; `RenderContext.products?: ProductRuntime`; `withProductVariables(base, productVars)`.

**Memoization warning.** `RenderContext` gains `products`. `ProductRuntime` MUST therefore be referentially stable across variable writes, or every memoized `ElementHost` re-renders on every write and the Phase 1 work is undone. Task 5's `useProducts` is responsible for that stability; this task just adds the field and the `ctx` dependency.

- [ ] **Step 1: Write the failing test — append to `variables.test.ts`**

```ts
import { withProductVariables } from "../variables";

describe("withProductVariables", () => {
  it("overlays product variables on top of the merged bag", () => {
    const base = { plan: { value: "yearly" } };
    const products = { "product.yearly.price": { value: "$59.99" } };
    expect(withProductVariables(base, products)).toEqual({
      plan: { value: "yearly" },
      "product.yearly.price": { value: "$59.99" },
    });
  });

  // Products are resolved facts from the store, not user state. If an author
  // ever writes a colliding key, the store value must still win — otherwise a
  // stale or spoofed price could render, which is an App Review problem.
  it("lets product values win over a colliding author variable", () => {
    const base = { "product.yearly.price": { value: "$0.00" } };
    const products = { "product.yearly.price": { value: "$59.99" } };
    expect(withProductVariables(base, products)["product.yearly.price"].value).toBe("$59.99");
  });

  it("returns the base unchanged when there are no product variables", () => {
    const base = { plan: { value: "yearly" } };
    expect(withProductVariables(base, undefined)).toEqual(base);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=packages/onboarding-ui -- variables`
Expected: FAIL — `withProductVariables` is not exported.

- [ ] **Step 3: Add `withProductVariables` to `variables.ts`**

Append to `packages/onboarding-ui/src/UI/Runtime/variables.ts`:

```ts
/**
 * Overlay resolved-product variables on top of the merged bag. Products WIN over
 * author variables: they are facts read from the store, and a displayed price
 * must match what StoreKit charges (spec §2.2).
 */
export const withProductVariables = (
  base: Record<string, ComposableVariableEntry>,
  productVariables: Record<string, ComposableVariableEntry> | undefined
): Record<string, ComposableVariableEntry> =>
  productVariables ? { ...base, ...productVariables } : base;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test --workspace=packages/onboarding-ui -- variables`
Expected: PASS.

- [ ] **Step 5: Add `products` to `ScreenHost`**

In `packages/onboarding-ui/src/UI/Runtime/ScreenHost.ts`, add the import and the field, and extend `noopScreenHost`:

```ts
import type {
  ComposableVariableEntry,
  CustomActions,
  ProductRuntime,
} from "@rocapine/react-native-onboarding";
```

Add to the `ScreenHost` type, after `customActions`:

```ts
  /**
   * Resolved store products + purchase/restore, when the host provides them.
   * Undefined on a host with no billing. MUST be referentially stable across
   * variable writes — it lands in RenderContext, and an unstable value
   * re-renders every memoized element on every write.
   */
  products?: ProductRuntime;
```

`noopScreenHost` needs no change — `products` is optional and absent is correct for a no-op host.

- [ ] **Step 6: Add `products` to `RenderContext`**

In `packages/onboarding-ui/src/UI/Runtime/elements/shared.ts`, add to the `RenderContext` type after `customActions`:

```ts
  /** Product runtime for `purchase` / `restore` actions. Undefined without billing. */
  products?: ProductRuntime;
```

and import the type:

```ts
import type { CustomActions, ProductRuntime } from "@rocapine/react-native-onboarding";
```

(The file already imports `CustomActions` from that module — extend the existing import rather than adding a second one.)

- [ ] **Step 7: Wire it through `ScreenRenderer`**

In `packages/onboarding-ui/src/UI/Runtime/ScreenRenderer.tsx`:

1. Extend the destructure on the `host` line to include `products`.
2. Import the projection and the overlay:

```ts
import { productVariables } from "@rocapine/react-native-onboarding";
import { mergeVariables, flattenVariables, withProductVariables } from "./variables";
```

3. Replace the `effectiveVariables` memo with one that overlays products:

```ts
  const productVars = useMemo(
    () => (products ? productVariables(products) : undefined),
    [products]
  );
  const effectiveVariables = useMemo(
    () => withProductVariables(mergeVariables(elementDefaults, hostVariables), productVars),
    [elementDefaults, hostVariables, productVars]
  );
```

4. Add `products` to the `ctx` object literal and to its dependency array:

```ts
  const ctx: RenderContext = useMemo(
    () => ({
      theme,
      getVariables,
      setVariable,
      onContinue: stableOnContinue,
      customActions,
      products,
      renderChildren,
    }),
    [theme, getVariables, setVariable, stableOnContinue, customActions, products, renderChildren]
  );
```

- [ ] **Step 8: Build both packages and run both suites**

```bash
npm run build:headless && npm run build:ui
npm test --workspace=packages/onboarding
npm test --workspace=packages/onboarding-ui
```

Expected: clean build; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/onboarding-ui/src/UI/Runtime
git commit -m "✨ feat(ui): thread ProductRuntime through ScreenHost and RenderContext"
```

---

### Task 4: `purchase` and `restore` press actions

**Files:**
- Modify: `packages/onboarding/src/steps/common.types.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/elements/actions.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/elements/runActions.ts`
- Test: `packages/onboarding-ui/src/UI/Runtime/__tests__/runActions.test.ts` (extend)

**Interfaces:**
- Consumes: `ctx.products` from Task 3.
- Produces: `PurchaseButtonAction`, `RestoreButtonAction` and their schemas in both packages; `ButtonAction` widened to 5 arms.

Both schema files must change together with identical field sets — the headless schema validates the payload, so a UI-only arm throws `invalid_union` even though the renderer handles it.

- [ ] **Step 1: Write the failing tests — append to `runActions.test.ts`**

```ts
const makeProducts = (over: Partial<any> = {}) => ({
  products: {
    yearly: { key: "yearly", productId: "com.app.yearly", price: "$59.99" },
  },
  status: "ready" as const,
  purchasing: false,
  purchase: vi.fn(async () => ({ status: "purchased" as const, productKey: "yearly" })),
  restore: vi.fn(async () => ({ status: "restored" as const, entitlements: ["pro"] })),
  ...over,
});

describe("runActions — purchase", () => {
  it("purchases the named product key", async () => {
    const products = makeProducts();
    await runActions([{ type: "purchase", product: "yearly" }], makeCtx({ products } as any));
    expect(products.purchase).toHaveBeenCalledWith("yearly");
  });

  it("interpolates the product key so a RadioGroup can drive it", async () => {
    const products = makeProducts();
    const ctx = makeCtx({ products } as any);
    ctx.setVariable("plan", { value: "yearly" });
    await runActions([{ type: "purchase", product: "{{plan}}" }], ctx);
    expect(products.purchase).toHaveBeenCalledWith("yearly");
  });

  it("runs onSuccess actions after a purchase", async () => {
    const ctx = makeCtx({ products: makeProducts() } as any);
    await runActions(
      [{ type: "purchase", product: "yearly", onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }] }],
      ctx
    );
    expect(ctx.getVariables().bought.value).toBe("yes");
  });

  it("runs onCancel — not onSuccess — when the user cancels", async () => {
    const products = makeProducts({ purchase: vi.fn(async () => ({ status: "cancelled" as const })) });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{
        type: "purchase", product: "yearly",
        onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }],
        onCancel: [{ type: "setVariable", name: "bailed", value: "yes" }],
      }],
      ctx
    );
    expect(ctx.getVariables().bought).toBeUndefined();
    expect(ctx.getVariables().bailed.value).toBe("yes");
  });

  // Without a provider the action must be inert and loud, never a silent no-op
  // that looks like a working buy button.
  it("warns and does not throw when no product runtime is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      runActions([{ type: "purchase", product: "yearly" }], makeCtx())
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns when the product key is not among the resolved products", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const products = makeProducts();
    await runActions([{ type: "purchase", product: "nope" }], makeCtx({ products } as any));
    expect(products.purchase).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("runActions — restore", () => {
  it("restores and runs onSuccess", async () => {
    const products = makeProducts();
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{ type: "restore", onSuccess: [{ type: "setVariable", name: "restored", value: "yes" }] }],
      ctx
    );
    expect(products.restore).toHaveBeenCalled();
    expect(ctx.getVariables().restored.value).toBe("yes");
  });

  it("runs onNothingToRestore when there was nothing to restore", async () => {
    const products = makeProducts({
      restore: vi.fn(async () => ({ status: "nothing_to_restore" as const })),
    });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{
        type: "restore",
        onSuccess: [{ type: "setVariable", name: "restored", value: "yes" }],
        onNothingToRestore: [{ type: "setVariable", name: "none", value: "yes" }],
      }],
      ctx
    );
    expect(ctx.getVariables().restored).toBeUndefined();
    expect(ctx.getVariables().none.value).toBe("yes");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=packages/onboarding-ui -- runActions`
Expected: FAIL — the `purchase` arm is unhandled, so `products.purchase` is never called.

- [ ] **Step 3: Add the headless schema arms**

In `packages/onboarding/src/steps/common.types.ts`, before the `ButtonAction` union, add:

```ts
export type PurchaseButtonAction = {
  type: "purchase";
  /** A product slot key, or an interpolable ref like "{{plan}}". */
  product: string;
  onSuccess?: ButtonAction[];
  onCancel?: ButtonAction[];
  onError?: ButtonAction[];
};

export type RestoreButtonAction = {
  type: "restore";
  onSuccess?: ButtonAction[];
  onNothingToRestore?: ButtonAction[];
  onError?: ButtonAction[];
};
```

Then widen the union and schema. The nested action arrays make the schema recursive, so they need `z.lazy`:

```ts
export type ButtonAction =
  | "continue"
  | CustomButtonAction
  | SetVariableButtonAction
  | PurchaseButtonAction
  | RestoreButtonAction;

export const PurchaseButtonActionSchema: z.ZodType<PurchaseButtonAction> = z.lazy(() =>
  z.object({
    type: z.literal("purchase"),
    product: z.string().min(1, "product must not be empty"),
    onSuccess: z.array(ButtonActionSchema).optional(),
    onCancel: z.array(ButtonActionSchema).optional(),
    onError: z.array(ButtonActionSchema).optional(),
  })
);

export const RestoreButtonActionSchema: z.ZodType<RestoreButtonAction> = z.lazy(() =>
  z.object({
    type: z.literal("restore"),
    onSuccess: z.array(ButtonActionSchema).optional(),
    onNothingToRestore: z.array(ButtonActionSchema).optional(),
    onError: z.array(ButtonActionSchema).optional(),
  })
);

export const ButtonActionSchema: z.ZodType<ButtonAction> = z.lazy(() =>
  z.union([
    z.literal("continue"),
    CustomButtonActionSchema,
    SetVariableButtonActionSchema,
    PurchaseButtonActionSchema,
    RestoreButtonActionSchema,
  ])
);
```

- [ ] **Step 4: Mirror them in the UI actions module**

Apply the **same** additions verbatim to `packages/onboarding-ui/src/UI/Runtime/elements/actions.ts` — same type names, same field names, same schema shape. That file is a self-contained mirror importing only `zod`; do not import from headless.

- [ ] **Step 5: Dispatch them in `runActions`**

In `packages/onboarding-ui/src/UI/Runtime/elements/runActions.ts`, add these arms inside the loop, before the trailing `custom` handling. Import `interpolate` from `./shared` alongside the existing imports.

```ts
    if (act.type === "purchase") {
      const runtime = ctx.products;
      if (!runtime) {
        console.warn(
          "[ComposableScreen] `purchase` action with no ProductProvider — pass one to OnboardingProvider."
        );
        continue;
      }
      const key = interpolate(act.product, variables).trim();
      if (!runtime.products[key]) {
        console.warn(
          `[ComposableScreen] `purchase` action: no resolved product for key "${key}".`
        );
        continue;
      }
      const result = await runtime.purchase(key);
      if (result.status === "purchased" && act.onSuccess) await runActions(act.onSuccess, ctx);
      else if (result.status === "cancelled" && act.onCancel) await runActions(act.onCancel, ctx);
      else if (result.status === "error" && act.onError) await runActions(act.onError, ctx);
      continue;
    }

    if (act.type === "restore") {
      const runtime = ctx.products;
      if (!runtime) {
        console.warn(
          "[ComposableScreen] `restore` action with no ProductProvider — pass one to OnboardingProvider."
        );
        continue;
      }
      const result = await runtime.restore();
      if (result.status === "restored" && act.onSuccess) await runActions(act.onSuccess, ctx);
      else if (result.status === "nothing_to_restore" && act.onNothingToRestore)
        await runActions(act.onNothingToRestore, ctx);
      else if (result.status === "error" && act.onError) await runActions(act.onError, ctx);
      continue;
    }
```

Note the nested `await runActions(...)` recursion — the follow-up arrays are full `ButtonAction[]`, so `"continue"` inside `onSuccess` still works and is still terminal for that nested run.

- [ ] **Step 6: Run to verify it passes**

Run: `npm test --workspace=packages/onboarding-ui -- runActions`
Expected: PASS, including the two warn-and-continue cases.

- [ ] **Step 7: Verify the schemas agree**

```bash
npm run build:headless && npm run build:ui
node -e "
const m = require('./packages/onboarding/dist/steps/common.types.js');
const ok = m.ButtonActionSchema.safeParse({ type:'purchase', product:'{{plan}}', onSuccess:['continue'] });
if (!ok.success) { console.error(JSON.stringify(ok.error.issues,null,2)); process.exit(1); }
console.log('OK: purchase action parses, nested onSuccess accepted');
"
```

Expected: `OK: ...`.

- [ ] **Step 8: Commit**

```bash
git add packages/onboarding/src/steps/common.types.ts packages/onboarding-ui/src/UI/Runtime/elements
git commit -m "✨ feat: purchase and restore press actions"
```

---

### Task 5: `useProducts` hook and `OnboardingProvider` wiring

**Files:**
- Create: `packages/onboarding/src/products/useProducts.ts`
- Create: `packages/onboarding/src/products/index.ts`
- Modify: `packages/onboarding/src/infra/provider/OnboardingProvider.tsx`
- Modify: `packages/onboarding/src/index.ts`
- Modify: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx`

**Interfaces:**
- Consumes: `deriveAll` (Task 1), `ProductProvider` / `ProductRuntime` / `ProductRef` (Task 1), `ScreenHost.products` (Task 3).
- Produces: `useProducts(refs, provider, locale?): ProductRuntime`; `OnboardingProvider` props `productProvider?: ProductProvider` and `products?: ProductRef[]`; `OnboardingProgressContext.products?: ProductRuntime`.

**The stability requirement.** `ProductRuntime` lands in `RenderContext`'s dependency array. It must change identity only when its contents genuinely change — not on every render, and not on every variable write. `useProducts` therefore memoizes the returned object on `[products, status, error, purchasing]`, and `purchase` / `restore` are `useCallback`-stable.

- [ ] **Step 1: Write `useProducts.ts`**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveAll } from "./derive";
import type {
  ProductProvider,
  ProductRef,
  ProductRuntime,
  ProductStatus,
  ProductWithDerived,
  PurchaseResult,
  RestoreResult,
} from "./types";

const EMPTY_PRODUCTS: Record<string, ProductWithDerived> = {};

/**
 * Resolves `refs` through `provider` once per (refs, provider) pair and exposes
 * a referentially stable ProductRuntime.
 *
 * Stability matters: this object lands in RenderContext's dependency array, so
 * an identity change on every render would re-render every memoized element on
 * every variable write — undoing the Phase 1 memoization work. It is memoized on
 * its actual contents, and purchase/restore are useCallback-stable.
 */
export const useProducts = (
  refs: ProductRef[] | undefined,
  provider: ProductProvider | undefined,
  locale?: string
): ProductRuntime => {
  const [products, setProducts] = useState<Record<string, ProductWithDerived>>(EMPTY_PRODUCTS);
  const [status, setStatus] = useState<ProductStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [purchasing, setPurchasing] = useState(false);

  // Refs so the callbacks below never need to be re-created.
  const productsRef = useRef(products);
  productsRef.current = products;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  // Key the effect on the refs' identity CONTENT, not the array identity — a
  // host passing an inline array literal would otherwise refetch every render.
  const refsKey = useMemo(
    () => (refs ?? []).map((r) => `${r.key}|${r.ios ?? ""}|${r.android ?? ""}|${r.compareTo ?? ""}`).join(","),
    [refs]
  );
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    const current = refsRef.current;
    const prov = providerRef.current;
    if (!prov || !current || current.length === 0) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(undefined);
    prov
      .getProducts(current)
      .then((resolved) => {
        if (cancelled) return;
        setProducts(deriveAll(resolved, current, locale));
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refsKey, locale]);

  const purchase = useCallback(async (key: string): Promise<PurchaseResult> => {
    const prov = providerRef.current;
    const product = productsRef.current[key];
    if (!prov || !product) {
      return { status: "error", error: new Error(`No resolved product for key "${key}"`) };
    }
    setPurchasing(true);
    try {
      return await prov.purchase(product);
    } catch (e) {
      return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<RestoreResult> => {
    const prov = providerRef.current;
    if (!prov) return { status: "error", error: new Error("No ProductProvider") };
    try {
      return await prov.restore();
    } catch (e) {
      return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  return useMemo(
    () => ({ products, status, error, purchasing, purchase, restore }),
    [products, status, error, purchasing, purchase, restore]
  );
};
```

- [ ] **Step 2: Write the module index**

Create `packages/onboarding/src/products/index.ts`:

```ts
export type {
  ProductRef,
  ProductPeriod,
  ResolvedProduct,
  DerivedProductFields,
  ProductWithDerived,
  PurchaseResult,
  RestoreResult,
  ProductProvider,
  ProductStatus,
  ProductRuntime,
} from "./types";
export { parseIsoDuration } from "./duration";
export { formatCurrency, deriveProductFields, deriveAll } from "./derive";
export { productVariables } from "./toVariables";
export { useProducts } from "./useProducts";
```

- [ ] **Step 3: Export from the package root**

Append to `packages/onboarding/src/index.ts`:

```ts
// Product runtime (paywall phase 3) — vendor-neutral store products
export * from "./products";
```

- [ ] **Step 4: Wire `OnboardingProvider`**

In `packages/onboarding/src/infra/provider/OnboardingProvider.tsx`:

1. Import `useProducts` and the types.
2. Add two optional props to `OnboardingProviderProps`:

```ts
  /**
   * Billing adapter. Omit for an app with no paywall. Must be a stable reference.
   */
  productProvider?: ProductProvider;
  /**
   * Product slots to resolve at mount, e.g.
   * `[{ key: "yearly", ios: "com.app.yr", android: "com.app.yr:p1y", compareTo: "monthly" }]`.
   */
  products?: ProductRef[];
```

3. Inside the component, resolve them and publish on context:

```ts
  const productRuntime = useProducts(products, productProvider, locale);
```

4. Add `products: productRuntime` to the `OnboardingProgressContext.Provider` value and to the context type + its default value (the default is `useProducts`-shaped; use a module-scope constant so the default is stable):

```ts
const EMPTY_PRODUCT_RUNTIME: ProductRuntime = {
  products: {},
  status: "idle",
  purchasing: false,
  purchase: async () => ({ status: "error", error: new Error("No ProductProvider") }),
  restore: async () => ({ status: "error", error: new Error("No ProductProvider") }),
};
```

Name the context field `products` and type it `ProductRuntime`.

- [ ] **Step 5: Put it on the host in the ComposableScreen adapter**

In `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx`, read `products` from the headless context alongside `setVariable` / `customActions`, and add it to the `host` memo and its dependency array:

```ts
  const { setVariable: setHeadlessVariable, customActions, products } = useContext(HeadlessProgressContext);
```

```ts
  const host: ScreenHost = useMemo(
    () => ({
      variables: composableVariables,
      setVariable: setVariableAndSync,
      complete: onContinue,
      customActions,
      products,
      keyboardVerticalOffset: keyboardVerticalOffset ?? headerHeight,
    }),
    [composableVariables, setVariableAndSync, onContinue, customActions, products, keyboardVerticalOffset, headerHeight]
  );
```

- [ ] **Step 6: Build both packages and run both suites**

```bash
npm run build:headless && npm run build:ui
npm test --workspace=packages/onboarding
npm test --workspace=packages/onboarding-ui
```

Expected: clean build; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/onboarding/src packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx
git commit -m "✨ feat(headless): useProducts hook + OnboardingProvider product wiring"
```

---

### Task 6: Adapters, example screen, and docs

**Files:**
- Create: `packages/onboarding/src/products/adapters/revenueCat.ts`
- Create: `packages/onboarding/src/products/adapters/expoIap.ts`
- Create: `example/app/example/composable-screen-products.tsx`
- Modify: `example/app/example/index.tsx`
- Modify: `.claude/rules/composable-screen-runtime.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `revenueCatProductProvider(Purchases?): ProductProvider`, `expoIapProductProvider(): ProductProvider`, and a `stubProductProvider(products)` test/demo helper exported from the products module.

- [ ] **Step 1: Write the stub provider (used by the example, and by anyone without billing)**

Create `packages/onboarding/src/products/adapters/stub.ts`:

```ts
import type { ProductProvider, ProductRef, ResolvedProduct } from "../types";

/**
 * In-memory provider for demos, tests, and studio previews. NEVER ship a paywall
 * backed by this — its prices are invented, and App Review rejects a paywall
 * whose displayed price does not match the store.
 */
export const stubProductProvider = (
  catalog: Record<string, Omit<ResolvedProduct, "key">>
): ProductProvider => ({
  async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
    return refs.filter((r) => catalog[r.key]).map((r) => ({ key: r.key, ...catalog[r.key] }));
  },
  async purchase(product) {
    return { status: "purchased", productKey: product.key };
  },
  async restore() {
    return { status: "nothing_to_restore" };
  },
});
```

Add `export { stubProductProvider } from "./adapters/stub";` to `packages/onboarding/src/products/index.ts`.

- [ ] **Step 2: Write the RevenueCat adapter**

Create `packages/onboarding/src/products/adapters/revenueCat.ts`:

```ts
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
```

- [ ] **Step 3: Write the expo-iap adapter**

Create `packages/onboarding/src/products/adapters/expoIap.ts`:

```ts
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
```

Add both to `packages/onboarding/src/products/index.ts`:

```ts
export { revenueCatProductProvider } from "./adapters/revenueCat";
export { expoIapProductProvider } from "./adapters/expoIap";
```

- [ ] **Step 4: Add the example screen**

Create `example/app/example/composable-screen-products.tsx`:

```tsx
import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { stubProductProvider, type ProductRef } from '@rocapine/react-native-onboarding';
import { useRouter } from 'expo-router';

export const unstable_settings = { anchor: '(tabs)' };

// Stub catalog — invented prices, demo only. A real paywall MUST resolve prices
// from the store (App Review rejects a mismatch); see spec §2.2.
const CATALOG = {
  yearly: {
    productId: 'com.app.yearly', store: 'app_store' as const,
    title: 'Yearly', description: 'Best value',
    price: '$59.99', priceAmount: 59.99, currencyCode: 'USD',
    period: 'year' as const, periodCount: 1, periodIso: 'P1Y',
    trial: { period: 'week' as const, periodCount: 1, days: 7 },
  },
  monthly: {
    productId: 'com.app.monthly', store: 'app_store' as const,
    title: 'Monthly', description: 'Flexible',
    price: '$9.99', priceAmount: 9.99, currencyCode: 'USD',
    period: 'month' as const, periodCount: 1, periodIso: 'P1M',
  },
};

const REFS: ProductRef[] = [
  { key: 'yearly', ios: 'com.app.yearly', compareTo: 'monthly' },
  { key: 'monthly', ios: 'com.app.monthly' },
];

const provider = stubProductProvider(CATALOG);

export default function ComposableScreenProductsExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-products',
    type: 'ComposableScreen',
    name: 'Products',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'safe-root',
          type: 'SafeAreaView' as const,
          props: { flex: 1, edges: ['top', 'bottom'] as ('top' | 'right' | 'bottom' | 'left')[] },
          children: [
            {
              id: 'root',
              type: 'YStack' as const,
              props: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' as const },
              children: [
                {
                  id: 'title', type: 'Text' as const,
                  props: { content: 'Go Premium', fontSize: 30, fontWeight: '700' as const, textAlign: 'center' as const },
                },
                {
                  id: 'per-week', type: 'Text' as const,
                  props: {
                    content: 'Just {{product.yearly.pricePerWeek}} per week',
                    fontSize: 16, textAlign: 'center' as const, opacity: 0.7,
                  },
                },
                {
                  id: 'savings', type: 'Text' as const,
                  props: {
                    content: 'Save {{product.yearly.savingsPct}}% vs monthly',
                    fontSize: 14, textAlign: 'center' as const, color: '#0A7C3A',
                    renderWhen: { 'product.yearly.savingsPct': { is_not_empty: true } },
                  },
                },
                {
                  id: 'trial', type: 'Text' as const,
                  props: {
                    content: '{{product.yearly.trialDays}}-day free trial',
                    fontSize: 14, textAlign: 'center' as const, opacity: 0.6,
                    renderWhen: { 'product.yearly.trialDays': { is_not_empty: true } },
                  },
                },
                {
                  id: 'loading', type: 'Text' as const,
                  props: {
                    content: 'Loading plans…', fontSize: 14, textAlign: 'center' as const, opacity: 0.5,
                    renderWhen: { 'products.loaded': { eq: 'false' } },
                  },
                },
                {
                  id: 'plans', type: 'RadioGroup' as const,
                  props: {
                    variableName: 'plan', defaultValue: 'yearly',
                    renderWhen: { 'products.loaded': { eq: 'true' } },
                    items: [
                      { value: 'yearly', label: '{{product.yearly.title}} — {{product.yearly.price}}' },
                      { value: 'monthly', label: '{{product.monthly.title}} — {{product.monthly.price}}' },
                    ],
                  },
                },
                {
                  id: 'buy', type: 'Button' as const,
                  props: {
                    label: 'Start free trial',
                    renderWhen: { 'products.loaded': { eq: 'true' } },
                    actions: [{ type: 'purchase', product: '{{plan}}' }],
                  },
                },
                {
                  id: 'restore', type: 'Button' as const,
                  props: {
                    label: 'Restore purchases', variant: 'ghost' as const,
                    actions: [{ type: 'restore' }],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };

  return (
    <OnboardingUi.OnboardingPage
      step={step as any}
      onContinue={() => router.back()}
    />
  );
}
```

**Provider wiring:** this screen needs an `OnboardingProvider` carrying `productProvider={provider}` and `products={REFS}`. The example app already mounts one in `example/app/_layout.tsx` — add those two props there rather than nesting a second provider (two `OnboardingProvider`s would create two `QueryClientProvider`s and two variable stores). Read `_layout.tsx` first and extend the existing element.

Register the route in `example/app/example/index.tsx`, in the `"Composable Screen"` `variants` array:

```ts
      { name: "Products", route: "/example/composable-screen-products" },
```

- [ ] **Step 5: Document the runtime rule**

Add a section to `.claude/rules/composable-screen-runtime.md`:

```markdown
## Product variables

Resolved store products are projected into the variable bag as FLAT DOTTED KEYS
(`product.<slot>.price`, `product.<slot>.pricePerWeek`, `product.<slot>.savingsPct`,
plus `products.loaded` / `products.purchasing` / `products.error`). `interpolate()`
and `evaluateCondition` both do a flat `variables[key]` lookup, so this needs no
engine change — `{{product.yearly.price}}` and
`renderWhen: { variable: "products.loaded", operator: "eq", value: "true" }` just work.

Products OVERLAY the merged bag and win over author variables
(`withProductVariables` in `Runtime/variables.ts`): they are facts read from the
store, and a displayed price must match what StoreKit charges.

**Never render a price the CMS supplied.** Prices come only from a
`ProductProvider`. When resolution fails, `products.loaded` is `"false"` — gate
the CTA on it.

`ProductRuntime` sits in `RenderContext`, so it must be referentially stable
across variable writes; `useProducts` memoizes it on its contents. An unstable
one re-renders every memoized element on every write, and nothing type-checks it.
```

Add a line to `CLAUDE.md`'s peer-dependency section noting that `react-native-purchases` and `expo-iap` are optional, dynamically required by the product adapters, and never peer deps.

- [ ] **Step 6: Full verification**

```bash
npm run build:headless && npm run build:ui
npm test --workspace=packages/onboarding
npm test --workspace=packages/onboarding-ui
npm run check:element-docs
npm run check:versions
```

Expected: all clean, no version bump.

- [ ] **Step 7: Commit**

```bash
git add packages/onboarding/src/products example .claude/rules CLAUDE.md
git commit -m "✨ feat(headless): RevenueCat + expo-iap + stub providers, products example, docs"
```

---

## Definition of done

- [ ] `npm run build:headless` and `npm run build:ui` clean.
- [ ] Both test suites pass; the new product tests cover derived fields, variable projection, and both press actions.
- [ ] `ButtonActionSchema` parses `{ type:"purchase", product:"{{plan}}", onSuccess:["continue"] }` from the built headless dist.
- [ ] `UI/Runtime/` still imports nothing from `Pages/`, `Templates/`, or `Provider/OnboardingProgressProvider`.
- [ ] `packages/onboarding-ui/src/UI/Runtime/elements/actions.ts` and `packages/onboarding/src/steps/common.types.ts` declare identical field sets for both new arms.
- [ ] The example's Products screen renders prices from the stub provider with no billing SDK installed.
- [ ] No package version bumped.

## Follow-ups this phase does NOT do

- `dismiss` and `presentPaywall` actions — Phase 5, with the hosts that give them meaning.
- Per-paywall product declaration — Phase 4 adds `paywalls.products`; Phase 3 declares refs on `OnboardingProvider`.
- Entitlement / subscription state — RevenueCat owns it; the host reads it.
- **Blocking prerequisite for Phase 5:** the `customActions` default-parameter instability in `OnboardingProvider` (spec §11.0 item 1). `ProductRuntime` now shares `RenderContext`'s dependency array with `customActions`, so that pre-existing bug degrades this phase's memoization too. Fix it before adding a second host.
