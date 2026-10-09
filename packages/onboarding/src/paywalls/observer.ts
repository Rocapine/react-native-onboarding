import type { PresentResult } from "./types";

// ---------------------------------------------------------------------------
// The observer contract. Copied VERBATIM from rocalytics-sdk
// `src/paywall/observer.ts` (Rocapine/rocalytics-sdk#14): that package's
// `createPaywallTracker()` satisfies `PaywallObserver` STRUCTURALLY and imports
// nothing from here, so any drift in a name or a field type breaks the only
// consumer without a compile error on either side. Change it there first.
// ---------------------------------------------------------------------------

export type PaywallSurface = "present" | "paywall_step";

export interface PaywallPresentationInfo {
  moment: string;
  paywallId: string;
  audienceId: string | null;
  renderMode: "elements" | "custom";
  billing: "store" | "stripe";
  surface: PaywallSurface;
  variantKey?: string;
  deploymentId?: string;
  onboardingRun?: { runId: string; stepKey: string };
}

export interface PaywallTransactionInfo {
  /** The exact value the app passes to Rocalytics' `purchase` call: iOS StoreKit original transaction id (iOS join key); Android Play order id (GPA.…). */
  originalTransactionIdentifier?: string;
  /** Android only: the Play purchase token (RevenueCat `transaction.purchaseToken`). Android join key. */
  purchaseToken?: string;
  productId?: string;
  /** True when the purchase only restored existing access. Not a conversion. */
  restored?: boolean;
}

export interface PaywallPresentationEnd {
  status: "purchased" | "dismissed" | "cancelled" | "error";
  /** The host SDK's error reason; accepted as any string. */
  reason?: string;
  transaction?: PaywallTransactionInfo;
}

export interface PaywallPresentationHandle {
  shown(): void;
  end(outcome: PaywallPresentationEnd): void;
}

export interface PaywallObserver {
  start(info: PaywallPresentationInfo): PaywallPresentationHandle | void;
}

// ---------------------------------------------------------------------------
// This SDK's side: one guarded presentation, shared by `present()` and the
// inline `Paywall` step so both enforce the same rules in one place.
// ---------------------------------------------------------------------------

/**
 * The fields of a catalog `Paywall` a presentation report needs. Structural
 * and lenient (`billing`/`products` optional, `renderMode` nullable) because
 * the inline step reads the catalog as open wire data.
 */
export type PaywallPresentationSource = {
  id: string;
  moment: string;
  audienceId?: number | null;
  billing?: "store" | "stripe";
  renderMode?: "elements" | "custom" | null;
  products?: ReadonlyArray<{ key: string; ios?: string; android?: string }>;
};

/**
 * What a surface holds for one presentation. Never throws, whatever the
 * observer does: `shown()` reaches the observer at most once and never after
 * `end()`; `end()` reaches it exactly once.
 *
 * `end` takes the SDK's own `PresentResult` plus the product key a purchase
 * went through, and builds the observer's `PaywallPresentationEnd` itself — so
 * the transaction rules (only with `purchased`, `productId` from the slot for
 * the running platform) live here and not in each surface.
 */
export type PaywallPresentation = {
  shown(): void;
  end(result: Pick<PresentResult, "status" | "reason">, purchasedProductKey?: string | null): void;
};

export const NOOP_PAYWALL_PRESENTATION: PaywallPresentation = Object.freeze({
  shown: () => {},
  end: () => {},
});

const warn = (what: string, error: unknown) =>
  console.warn(`[paywalls] PaywallObserver.${what} threw; ignored so the paywall is unaffected:`, error);

/**
 * Calls `fn`, swallowing a synchronous throw AND a rejected promise. An
 * observer typed `void` can still be `async`, and its rejection would otherwise
 * surface as an unhandled rejection in the host app.
 */
const guarded = (what: string, fn: () => unknown): unknown => {
  try {
    const value = fn();
    if (value && typeof (value as PromiseLike<unknown>).then === "function") {
      Promise.resolve(value).catch((error) => warn(what, error));
    }
    return value;
  } catch (error) {
    warn(what, error);
    return undefined;
  }
};

const isHandle = (value: unknown): value is PaywallPresentationHandle =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as PaywallPresentationHandle).shown === "function" &&
  typeof (value as PaywallPresentationHandle).end === "function";

export const buildPresentationInfo = (
  paywall: PaywallPresentationSource,
  surface: PaywallSurface
): PaywallPresentationInfo => ({
  moment: paywall.moment,
  paywallId: paywall.id,
  // The catalog carries a numeric id; the contract is a string.
  audienceId: paywall.audienceId == null ? null : String(paywall.audienceId),
  // Absent means "elements" — see `Paywall.renderMode`.
  renderMode: paywall.renderMode === "custom" ? "custom" : "elements",
  billing: paywall.billing === "stripe" ? "stripe" : "store",
  surface,
});

/**
 * `productId` is the store id of the purchased slot on the RUNNING platform.
 * Undefined when nothing resolves (unknown key, a slot with no id for this
 * platform, web), in which case the caller sends no `transaction` at all.
 */
const resolveProductId = (
  paywall: PaywallPresentationSource,
  key: string | null | undefined,
  platform: string
): string | undefined => {
  if (!key) return undefined;
  const slot = paywall.products?.find((p) => p.key === key);
  if (!slot) return undefined;
  if (platform === "ios") return slot.ios || undefined;
  if (platform === "android") return slot.android || undefined;
  return undefined;
};

export const buildPresentationEnd = (
  paywall: PaywallPresentationSource,
  result: Pick<PresentResult, "status" | "reason">,
  purchasedProductKey: string | null | undefined,
  platform: string
): PaywallPresentationEnd => {
  const end: PaywallPresentationEnd = { status: result.status };
  if (result.reason !== undefined) end.reason = result.reason;
  // A transaction only ever accompanies `purchased` (contract rule P8).
  if (result.status === "purchased") {
    const productId = resolveProductId(paywall, purchasedProductKey, platform);
    if (productId) end.transaction = { productId };
  }
  return end;
};

/**
 * Opens one observed presentation: calls `observer.start` now and returns the
 * guarded handle. With no observer (or a malformed one) every call is a no-op.
 *
 * `platform` is `Platform.OS`, passed in rather than imported so this module
 * stays testable without a react-native stub.
 */
export const openPaywallPresentation = (
  observer: PaywallObserver | undefined | null,
  paywall: PaywallPresentationSource,
  surface: PaywallSurface,
  platform: string
): PaywallPresentation => {
  if (!observer || typeof (observer as PaywallObserver).start !== "function") {
    return NOOP_PAYWALL_PRESENTATION;
  }
  const returned = guarded("start", () => observer.start(buildPresentationInfo(paywall, surface)));
  // `start()` may legitimately return void; anything that is not a handle is
  // treated the same way.
  const handle = isHandle(returned) ? returned : null;
  let shown = false;
  let ended = false;
  return {
    shown: () => {
      if (shown || ended) return;
      shown = true;
      if (handle) guarded("shown", () => handle.shown());
    },
    end: (result, purchasedProductKey) => {
      if (ended) return;
      ended = true;
      if (handle) {
        const outcome = buildPresentationEnd(paywall, result, purchasedProductKey, platform);
        guarded("end", () => handle.end(outcome));
      }
    },
  };
};
