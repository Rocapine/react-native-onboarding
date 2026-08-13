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
