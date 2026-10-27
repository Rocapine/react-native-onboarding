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
  variantKey?: string | null;
  deploymentId?: number | null;
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
 *
 * `purchasedFrom` is the paywall the purchase was made ON, when that is not the
 * one the presentation started with: a variant swap keeps one presentation open
 * (credited to the variant shown first), but the bought slot's store id is the
 * swapped-in variant's, and that id is what joins to revenue. Omitted, the
 * started paywall is used.
 *
 * `reportedTransaction` is the `transaction` a custom paywall screen passed to
 * `complete()` (#287). Typed `unknown` because it arrives from host code and is
 * sanitized here (`sanitizePaywallTransaction`), the one place both surfaces
 * share. The caller passes it only when the screen itself reported
 * `purchased`; `buildPresentationEnd` documents how it meets a recorded
 * purchase.
 */
export type PaywallPresentation = {
  shown(): void;
  end(
    result: Pick<PresentResult, "status" | "reason">,
    purchasedProductKey?: string | null,
    purchasedFrom?: PaywallPresentationSource | null,
    reportedTransaction?: unknown
  ): void;
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

const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/**
 * The arm this paywall was served as (#237): a variant's key, or the reserved
 * `"main"` for the parent. Both keys are left UNSET, never empty or
 * `"none"`, when the server sent no `variantKey` (an older server), so an app
 * on one sees no new property. `deploymentId` is only sent alongside a key,
 * and as a decimal string because that is the contract's type.
 *
 * `end()` carries no info of its own: an observer attributes a purchase or a
 * dismiss to the presentation `start()` opened, so this covers them too.
 */
const servedArm = (paywall: PaywallPresentationSource): Pick<PaywallPresentationInfo, "variantKey" | "deploymentId"> => {
  if (!nonEmptyString(paywall.variantKey)) return {};
  return paywall.deploymentId == null
    ? { variantKey: paywall.variantKey }
    : { variantKey: paywall.variantKey, deploymentId: String(paywall.deploymentId) };
};

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
  ...servedArm(paywall),
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

/**
 * A custom screen's `complete({ transaction })`, reduced to the contract: the
 * three ids only when they are non-empty strings, `restored` only when it is
 * exactly `true`, every other field dropped. `undefined` when the input is not
 * a plain object or nothing survives, so the end carries no `transaction` at
 * all, exactly as when none was passed.
 *
 * Never throws: the value is host data, and a throwing getter or a revoked
 * `Proxy` (on which even `Array.isArray` throws) must cost only the
 * transaction, never the end of the presentation it rides on.
 */
export const sanitizePaywallTransaction = (value: unknown): PaywallTransactionInfo | undefined => {
  try {
    return readTransaction(value);
  } catch (error) {
    console.warn("[paywalls] complete()'s transaction could not be read; it was dropped:", error);
    return undefined;
  }
};

const readTransaction = (value: unknown): PaywallTransactionInfo | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const out: PaywallTransactionInfo = {};
  if (nonEmptyString(raw.originalTransactionIdentifier)) {
    out.originalTransactionIdentifier = raw.originalTransactionIdentifier;
  }
  if (nonEmptyString(raw.purchaseToken)) out.purchaseToken = raw.purchaseToken;
  if (nonEmptyString(raw.productId)) out.productId = raw.productId;
  if (raw.restored === true) out.restored = true;
  return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * The end the observer receives.
 *
 * A transaction only ever accompanies a `purchased` end (contract rule P8).
 * Its sources:
 * - a purchase the SDK recorded (`purchasedProductKey`): `productId` from that
 *   slot for the running platform;
 * - a custom screen's reported transaction (#287), sanitized.
 *
 * With no recorded purchase, the reported transaction is sent as it is.
 *
 * When a purchase IS recorded, the recorded purchase wins: the "first settled
 * purchase sticks" rule `resolveEndedOutcome` applies to the outcome. The
 * reported ids are added to it only when they provably describe it, i.e. the
 * reported `productId` is present and equals the recorded slot's store id for
 * this platform. `restored` is never added: the SDK's own purchase is a
 * purchase, and a screen's flag must not relabel it. In every other case (an
 * absent or different reported `productId`, or a recorded slot with no store
 * id on this platform) the reported ids are dropped with a warning, and the
 * end carries the recorded purchase's transaction alone (`{ productId }`, or
 * none when its slot names nothing here). Pairing one purchase's transaction
 * id with another's `productId` would corrupt the revenue join.
 */
export const buildPresentationEnd = (
  paywall: PaywallPresentationSource,
  result: Pick<PresentResult, "status" | "reason">,
  purchasedProductKey: string | null | undefined,
  platform: string,
  reportedTransaction?: unknown
): PaywallPresentationEnd => {
  const end: PaywallPresentationEnd = { status: result.status };
  if (result.reason !== undefined) end.reason = result.reason;
  if (result.status !== "purchased") return end;
  const productId = resolveProductId(paywall, purchasedProductKey, platform);
  const reported = sanitizePaywallTransaction(reportedTransaction);
  if (reported && !purchasedProductKey) {
    end.transaction = reported;
    return end;
  }
  if (reported && productId && reported.productId === productId) {
    const { restored, ...ids } = reported;
    if (restored) {
      console.warn(
        "[paywalls] complete() reported `restored: true` for a purchase this presentation already " +
          "recorded through the SDK; the flag was dropped and the purchase is reported as one."
      );
    }
    end.transaction = ids;
    return end;
  }
  if (reported) {
    console.warn(
      `[paywalls] complete() reported a transaction for ${JSON.stringify(reported.productId ?? null)}, ` +
        `but this presentation already recorded a purchase of ${JSON.stringify(productId ?? null)}; ` +
        "the recorded purchase is reported and the screen's transaction ids are dropped."
    );
  }
  if (productId) end.transaction = { productId };
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
    end: (result, purchasedProductKey, purchasedFrom, reportedTransaction) => {
      if (ended) return;
      ended = true;
      if (!handle) return;
      const source = purchasedFrom ?? paywall;
      // The sanitizer never throws, but the end must reach the observer
      // whatever the reported transaction does: fall back to the end without it.
      let outcome: PaywallPresentationEnd;
      try {
        outcome = buildPresentationEnd(source, result, purchasedProductKey, platform, reportedTransaction);
      } catch (error) {
        warn("end (its transaction)", error);
        outcome = buildPresentationEnd(source, result, purchasedProductKey, platform);
      }
      guarded("end", () => handle.end(outcome));
    },
  };
};
