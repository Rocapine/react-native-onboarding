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
    // `daily` itself, not just its multiples: emitted first so the ordering
    // matches the ascending sequence below.
    out.pricePerDayAmount = daily;
    out.pricePerDay = formatCurrency(daily, p.currencyCode, locale);
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
