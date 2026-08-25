import { formatCurrency } from "../derive";
import type {
  ProductPeriod,
  ProductProvider,
  ProductRef,
  ResolvedProduct,
  RestoreResult,
} from "../types";

/**
 * Stripe Payment Link provider.
 *
 * Deliberately NOT a store adapter. It makes no network call and holds no
 * Stripe key: the price is authored in Onboarding Studio and travels inline on
 * the `ProductRef` (`ProductRef.stripe`), so `getProducts` is a synchronous
 * synthesis and `purchase` is a link-out.
 *
 * What it does NOT do, on purpose:
 *  - grant or verify anything. `purchase()` resolves `{ status: "pending" }`
 *    because the browser leaves the app — on web the JS context is destroyed.
 *    The entitlement arrives later through RevenueCat's Stripe integration,
 *    which is why `clientReferenceId` MUST return the RevenueCat App User ID:
 *    it is the key RevenueCat's webhook matches on, and the only thing tying
 *    the payment to the user. Return the wrong id and the money is taken with
 *    no entitlement granted.
 *  - import `react-native` at module scope, so this file is safe to load on
 *    web. URL opening is injected (`openUrl`) for the same reason, and so the
 *    provider is testable under Node.
 */
export type StripeLinkProviderConfig = {
  /**
   * The RevenueCat App User ID, as a getter — it changes on login/logout, and
   * a value captured at provider construction would go stale.
   */
  clientReferenceId: () => string | null | undefined;
  /** Optional email prefill for the Checkout page. */
  prefilledEmail?: () => string | null | undefined;
  /**
   * How to leave the app. Defaults to `react-native`'s `Linking.openURL`,
   * required lazily so this module stays importable where react-native is not.
   */
  openUrl?: (url: string) => void | Promise<void>;
  /**
   * Restoring is a store-account operation Stripe links cannot perform. Supply
   * the host's real implementation (usually the RevenueCat adapter's
   * `restore`) to make a Restore button work on a Stripe paywall.
   */
  restore?: ProductProvider["restore"];
  /** Passed to `Intl.NumberFormat` when formatting the authored price. */
  locale?: string;
};

const PERIOD_FROM_UNIT: Record<string, ProductPeriod> = {
  D: "week",
  W: "week",
  M: "month",
  Y: "year",
};

/** Same shape the store adapters parse, for one consistent notion of period. */
const toPeriod = (iso: string | null | undefined): { period: ProductPeriod | null; count: number } => {
  if (!iso) return { period: null, count: 0 };
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return { period: null, count: 0 };
  return { period: PERIOD_FROM_UNIT[m[2]] ?? null, count: Number(m[1]) };
};

const lazyLinking = (url: string): void => {
  // Required lazily and defensively: this provider's whole point is running on
  // web, where react-native may be absent entirely.
  try {
    const RN = require("react-native");
    RN.Linking.openURL(url);
  } catch {
    if (typeof globalThis !== "undefined" && (globalThis as any).location) {
      (globalThis as any).location.assign(url);
      return;
    }
    throw new Error(
      "stripeLinkProductProvider: no way to open a URL. Pass `openUrl` in the provider config.",
    );
  }
};

const withParams = (
  link: string,
  params: Record<string, string | null | undefined>,
): string => {
  // Parsed rather than string-concatenated so a link that already carries
  // query parameters (`?locale=fr`) keeps them and does not gain a second `?`.
  const url = new URL(link);
  for (const [name, value] of Object.entries(params)) {
    // Omit rather than emit — Stripe would receive the literal string "null".
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(name, value);
  }
  return url.toString();
};

export const stripeLinkProductProvider = (config: StripeLinkProviderConfig): ProductProvider => {
  const { clientReferenceId, prefilledEmail, openUrl = lazyLinking, restore, locale } = config;

  // `ResolvedProduct` has no field for the payment link and widening it would
  // put a Stripe concern on every store product, so the link is remembered
  // here, populated by `getProducts` — the same call that produced the
  // `ResolvedProduct` `purchase` is later handed.
  const linkByKey = new Map<string, string>();

  return {
    async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
      // Cleared, not merged: this call's `refs` is the full current catalog, so
      // it defines the resolvable set on its own. A key that carried a stripe
      // block last call but not this one (re-authored off Stripe billing) must
      // stop resolving — an accumulating map would keep `purchase()` opening
      // that stale link indefinitely instead of taking the "no link" error path.
      linkByKey.clear();
      const out: ResolvedProduct[] = [];
      for (const ref of refs) {
        const s = ref.stripe;
        // A ref with no stripe block is not an error — the catalog union spans
        // every paywall, including `billing: "store"` ones. Dropping it is the
        // same contract the store adapters have for a missing platform id.
        if (!s || !s.paymentLink) continue;
        linkByKey.set(ref.key, s.paymentLink);
        const { period, count } = toPeriod(s.periodIso);
        const trialDays = s.trialDays ?? 0;
        out.push({
          key: ref.key,
          productId: s.priceId ?? s.paymentLink,
          store: "stripe",
          title: "",
          description: "",
          price: formatCurrency(s.amount, s.currency, locale),
          priceAmount: s.amount,
          currencyCode: s.currency,
          period,
          periodCount: count,
          periodIso: s.periodIso ?? null,
          // Expressed in days, which is what `deriveProductFields` reads via
          // `trial.days`; the period/count pair is filled in consistently so
          // nothing downstream sees a half-populated trial.
          ...(trialDays > 0
            ? {
                trial: {
                  period: "week" as ProductPeriod,
                  periodCount: Math.max(1, Math.round(trialDays / 7)),
                  days: trialDays,
                },
              }
            : {}),
        });
      }
      return out;
    },

    async purchase(product) {
      const link = linkByKey.get(product.key);
      if (!link) {
        return {
          status: "error",
          error: new Error(
            `stripeLinkProductProvider: no payment link for "${product.key}". ` +
              "getProducts() never resolved this key, so the ref carries no `stripe.paymentLink`.",
          ),
        };
      }
      // `withParams` throws synchronously on a malformed link (`new URL`) —
      // a plausible failure mode for an author-pasted Stripe URL. That throw
      // happens before any `await`, so left unguarded it would make
      // `purchase()` return a REJECTED promise instead of the resolved
      // `{ status: "error", error }` every other failure path in this file
      // uses. Callers awaiting `purchase()` should only ever see it resolve.
      try {
        await openUrl(
          withParams(link, {
            client_reference_id: clientReferenceId(),
            prefilled_email: prefilledEmail?.(),
          }),
        );
      } catch (e) {
        // Always renamed to name the offending link — a bare `Invalid URL`
        // (what `new URL` throws) gives an author nothing to act on.
        const reason = e instanceof Error ? e.message : String(e);
        return {
          status: "error",
          error: new Error(`stripeLinkProductProvider: failed to open payment link "${link}": ${reason}`),
        };
      }
      // Never "purchased": the browser has taken over and, on web, this JS
      // context is about to be destroyed. RevenueCat reports the entitlement.
      return { status: "pending" };
    },

    async restore(): Promise<RestoreResult> {
      if (restore) return restore();
      return {
        status: "error",
        error: new Error(
          "stripeLinkProductProvider: restore is not configured. A Stripe Payment Link cannot " +
            "enumerate past purchases; pass `restore` (usually your RevenueCat adapter's) in the " +
            "provider config so a Restore button does something.",
        ),
      };
    },
  };
};
