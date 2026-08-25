import { describe, it, expect } from "vitest";
import {
  collectProductRefs,
  computeCatalogStatus,
  computeIsReady,
  purchaseOutcomeFromResult,
  resolvePresentDecision,
  resolvePresentedOutcome,
  selectActiveProductRuntime,
  shouldBreakPresentationWedge,
  shouldRecordPurchaseOutcome,
} from "../present";
import type { Paywall, PaywallCatalog } from "../types";
import type { ProductRuntime, PurchaseResult } from "../../products/types";

const makePaywall = (overrides: Partial<Paywall> & Pick<Paywall, "id" | "moment">): Paywall => ({
  name: overrides.name ?? "Paywall",
  audienceId: overrides.audienceId ?? null,
  audienceName: overrides.audienceName ?? null,
  elements: overrides.elements ?? [],
  billing: overrides.billing ?? "store",
  products: overrides.products ?? [],
  configuration: overrides.configuration ?? null,
  ...overrides,
});

const makeCatalog = (paywalls: Paywall[]): PaywallCatalog => ({
  metadata: { locale: "en", draft: false },
  paywalls: Object.fromEntries(paywalls.map((p) => [p.moment, p])),
  fonts: null,
});

describe("collectProductRefs", () => {
  it("returns an empty array for a null catalog", () => {
    expect(collectProductRefs(null)).toEqual([]);
  });

  it("returns an empty array when no paywall declares any products", () => {
    const catalog = makeCatalog([makePaywall({ id: "1", moment: "a", products: [] })]);
    expect(collectProductRefs(catalog)).toEqual([]);
  });

  it("flattens products from every moment into one array", () => {
    const catalog = makeCatalog([
      makePaywall({ id: "1", moment: "a", products: [{ key: "yearly", ios: "com.app.yr" }] }),
      makePaywall({ id: "2", moment: "b", products: [{ key: "monthly", ios: "com.app.mo" }] }),
    ]);
    expect(collectProductRefs(catalog)).toEqual([
      { key: "yearly", ios: "com.app.yr" },
      { key: "monthly", ios: "com.app.mo" },
    ]);
  });

  it("dedupes identical refs (same key + ios + android + compareTo) across moments", () => {
    const shared = { key: "yearly", ios: "com.app.yr", android: "com.app.yr:p1y" };
    const catalog = makeCatalog([
      makePaywall({ id: "1", moment: "a", products: [shared] }),
      makePaywall({ id: "2", moment: "b", products: [shared, { key: "monthly", ios: "com.app.mo" }] }),
    ]);
    expect(collectProductRefs(catalog)).toEqual([
      shared,
      { key: "monthly", ios: "com.app.mo" },
    ]);
  });

  it("does NOT dedupe refs that share a key but differ in ios/android/compareTo", () => {
    const catalog = makeCatalog([
      makePaywall({
        id: "1",
        moment: "a",
        products: [
          { key: "yearly", ios: "com.app.yr" },
          { key: "yearly", ios: "com.app.yr", compareTo: "monthly" },
        ],
      }),
    ]);
    expect(collectProductRefs(catalog)).toHaveLength(2);
  });
});

describe("resolvePresentDecision", () => {
  const paywall = makePaywall({ id: "1", moment: "hard_paywall", products: [] });
  const catalog = makeCatalog([paywall]);

  it("starts when the moment exists and nothing is currently showing", () => {
    const decision = resolvePresentDecision(catalog, null, "hard_paywall");
    expect(decision).toEqual({ type: "start", paywall });
  });

  // Every error below carries a `reason`. The bare `{status:"error"}` these
  // used to assert is what made two conditions with OPPOSITE correct responses
  // — "retry later, the catalog may still arrive" vs "do not retry, something
  // is stuck" — indistinguishable to the caller.
  it("resolves 'unknown-moment' when the moment is absent from the catalog", () => {
    const decision = resolvePresentDecision(catalog, null, "does_not_exist");
    expect(decision).toEqual({
      type: "immediate",
      result: { status: "error", reason: "unknown-moment" },
    });
  });

  it("resolves 'unknown-moment' when the catalog has not resolved yet (null)", () => {
    const decision = resolvePresentDecision(null, null, "hard_paywall");
    expect(decision).toEqual({
      type: "immediate",
      result: { status: "error", reason: "unknown-moment" },
    });
  });

  it("reports unknown-moment when the key is absent from the catalog", () => {
    const decision = resolvePresentDecision(catalog, null, "not_a_moment");
    expect(decision).toEqual({
      type: "immediate",
      result: { status: "error", reason: "unknown-moment" },
    });
  });

  it("resolves 'already-presenting' AND names the moment that is showing", () => {
    // The moment is the difference between "I double-called for the same
    // one" (caller adds a guard) and "something else is stuck" (caller cannot
    // fix it) — different diagnoses, so the bare status could serve neither.
    const decision = resolvePresentDecision(catalog, "already_showing", "hard_paywall");
    expect(decision).toEqual({
      type: "immediate",
      result: {
        status: "error",
        reason: "already-presenting",
        activeMoment: "already_showing",
      },
    });
  });

  it("reports 'already-presenting' when the caller re-presents the SAME moment", () => {
    const decision = resolvePresentDecision(catalog, "hard_paywall", "hard_paywall");
    expect(decision).toEqual({
      type: "immediate",
      result: {
        status: "error",
        reason: "already-presenting",
        activeMoment: "hard_paywall",
      },
    });
  });

  it("the concurrent-present check takes priority over the unknown-moment check", () => {
    // Both conditions are true at once: prove the function still resolves
    // rather than e.g. throwing on the first branch it happens to hit, and
    // that the reason reflects the branch actually taken.
    const decision = resolvePresentDecision(catalog, "already_showing", "does_not_exist");
    expect(decision).toEqual({
      type: "immediate",
      result: {
        status: "error",
        reason: "already-presenting",
        activeMoment: "already_showing",
      },
    });
  });
});

describe("shouldBreakPresentationWedge", () => {
  // The confirmed production failure this exists for: iOS refuses to present a
  // view controller over one that is already presenting (another Modal, a
  // `presentation: "modal"` route, a StoreKit alert). `present()` has already
  // set `activePlacement`, the host's Modal never actually appears, so nothing
  // ever calls `complete()` — and because `activePaywall` is non-null the
  // OTHER self-heal (which requires it to be null) cannot fire. Every later
  // `present()` then returns "error" for the life of the process, with no
  // error and no log, on a monetisation surface.
  it("breaks the wedge once a presentation has timed out unacknowledged", () => {
    expect(shouldBreakPresentationWedge("hard_paywall", false, true)).toBe(true);
  });

  it("does NOT fire while nothing is being presented", () => {
    expect(shouldBreakPresentationWedge(null, false, true)).toBe(false);
  });

  it("does NOT fire once the host has acknowledged — a real paywall may stay up for minutes", () => {
    // The whole point of requiring an acknowledgement rather than a bare
    // timeout: a user reading a paywall must never have it torn down.
    expect(shouldBreakPresentationWedge("hard_paywall", true, true)).toBe(false);
  });

  it("does NOT fire before the timeout elapses, even unacknowledged", () => {
    expect(shouldBreakPresentationWedge("hard_paywall", false, false)).toBe(false);
  });
});

describe("computeIsReady", () => {
  const refs = [{ key: "yearly", ios: "com.app.yr" }];

  it("is false while the catalog has not resolved", () => {
    expect(computeIsReady(null, refs, "idle")).toBe(false);
    expect(computeIsReady(null, refs, "ready")).toBe(false);
  });

  it("is false when the catalog resolved but products have not (loading/idle/error)", () => {
    const catalog = makeCatalog([]);
    expect(computeIsReady(catalog, refs, "idle")).toBe(false);
    expect(computeIsReady(catalog, refs, "loading")).toBe(false);
    expect(computeIsReady(catalog, refs, "error")).toBe(false);
  });

  it("is true once both the catalog and products resolved", () => {
    const catalog = makeCatalog([]);
    expect(computeIsReady(catalog, refs, "ready")).toBe(true);
  });

  it("is true as soon as the catalog resolves when NO paywall declares any products — useProducts would otherwise stay 'idle' forever", () => {
    const catalog = makeCatalog([]);
    expect(computeIsReady(catalog, [], "idle")).toBe(true);
  });
});

describe("purchaseOutcomeFromResult", () => {
  it("tracks 'purchased'", () => {
    const result: PurchaseResult = { status: "purchased", productKey: "yearly" };
    expect(purchaseOutcomeFromResult(result)).toBe("purchased");
  });

  it("tracks 'cancelled'", () => {
    const result: PurchaseResult = { status: "cancelled" };
    expect(purchaseOutcomeFromResult(result)).toBe("cancelled");
  });

  it("does not track 'pending' — not a completed store interaction", () => {
    const result: PurchaseResult = { status: "pending" };
    expect(purchaseOutcomeFromResult(result)).toBeNull();
  });

  it("does not track 'error' — would collide with PresentResult's own, differently-meaning 'error'", () => {
    const result: PurchaseResult = { status: "error", error: new Error("boom") };
    expect(purchaseOutcomeFromResult(result)).toBeNull();
  });
});

describe("resolvePresentedOutcome", () => {
  it("upgrades a bare 'dismissed' to 'purchased' when a purchase succeeded during the presentation", () => {
    expect(resolvePresentedOutcome({ status: "dismissed" }, "purchased")).toEqual({ status: "purchased" });
  });

  it("upgrades a bare 'dismissed' to 'cancelled' when the store purchase was cancelled during the presentation", () => {
    expect(resolvePresentedOutcome({ status: "dismissed" }, "cancelled")).toEqual({ status: "cancelled" });
  });

  it("leaves 'dismissed' alone when nothing happened at the store", () => {
    expect(resolvePresentedOutcome({ status: "dismissed" }, null)).toEqual({ status: "dismissed" });
  });

  it("never upgrades a status other than 'dismissed', even if a purchase occurred", () => {
    // "error" here means "unknown moment / already showing" (resolvePresentDecision) —
    // a purchase outcome must never be allowed to clobber that different meaning.
    expect(resolvePresentedOutcome({ status: "error" }, "purchased")).toEqual({ status: "error" });
  });
});

describe("shouldRecordPurchaseOutcome", () => {
  it("records when the presentation is still the one the purchase started in", () => {
    expect(shouldRecordPurchaseOutcome(1, 1)).toBe(true);
  });

  it("does NOT record when a newer presentation has started since the purchase began — the race this guards against", () => {
    // Paywall A's purchase() captured generation 1; the user dismissed A and
    // paywall B was presented (generation bumped to 2) before A's promise
    // settled. A's write must not land in B's tracker.
    expect(shouldRecordPurchaseOutcome(1, 2)).toBe(false);
  });

  it("does NOT record for a generation older than the current one by more than one step either", () => {
    expect(shouldRecordPurchaseOutcome(1, 5)).toBe(false);
  });
});

describe("computeCatalogStatus", () => {
  const catalog = makeCatalog([makePaywall({ id: "1", moment: "hard_paywall" })]);

  it("is 'loading' before anything arrives", () => {
    expect(computeCatalogStatus(null, null, true)).toBe("loading");
    expect(computeCatalogStatus(null, null, false)).toBe("loading");
  });

  it("is 'error' only when there is no catalog to fall back on", () => {
    expect(computeCatalogStatus(null, new Error("network"), false)).toBe("error");
  });

  it("is 'ready' for a settled catalog", () => {
    expect(computeCatalogStatus(catalog, null, false)).toBe("ready");
  });

  it("is 'revalidating' when a catalog is on hand AND a fetch is in flight", () => {
    // The state this type exists for. In production the catalog is served
    // cache-first from a disk key that is NOT scoped by customAudienceParams,
    // so this catalog may have been resolved under DIFFERENT params and be
    // superseded in a moment. A host must be able to tell that a moment
    // missing HERE might simply not have arrived yet.
    expect(computeCatalogStatus(catalog, null, true)).toBe("revalidating");
  });

  it("prefers a usable catalog over reporting a failed revalidation", () => {
    // react-query keeps cached `data` and sets `error` when a background
    // refetch fails. Reporting "error" there would make a host discard a
    // perfectly serviceable catalog.
    expect(computeCatalogStatus(catalog, new Error("revalidation failed"), false)).toBe("ready");
    expect(computeCatalogStatus(catalog, new Error("revalidation failed"), true)).toBe("revalidating");
  });

  it("distinguishes every state `isReady` collapses", () => {
    // isReady is false for all three of these; catalogStatus separates them,
    // which is the whole point.
    const loading = computeCatalogStatus(null, null, true);
    const errored = computeCatalogStatus(null, new Error("x"), false);
    const productsPending = computeCatalogStatus(catalog, null, false);
    expect(computeIsReady(null, [], "idle")).toBe(false);
    expect(new Set([loading, errored, productsPending]).size).toBe(3);
  });
});

const runtime = (over: Partial<ProductRuntime> = {}): ProductRuntime => ({
  products: {},
  status: "ready",
  purchasing: false,
  purchase: async () => ({ status: "cancelled" }),
  restore: async () => ({ status: "nothing_to_restore" }),
  ...over,
});

describe("selectActiveProductRuntime", () => {
  const storeRuntime = runtime({ status: "ready" });
  const stripeRuntime = runtime({ status: "loading" });

  it("publishes the store runtime when billing is 'store'", () => {
    expect(
      selectActiveProductRuntime({ storeRuntime, stripeRuntime, billing: "store", hasStripeProvider: true }),
    ).toBe(storeRuntime);
  });

  it("publishes the store runtime when no paywall is active (billing undefined)", () => {
    expect(
      selectActiveProductRuntime({ storeRuntime, stripeRuntime, billing: undefined, hasStripeProvider: true }),
    ).toBe(storeRuntime);
  });

  it("publishes the stripe runtime when billing is 'stripe'", () => {
    expect(
      selectActiveProductRuntime({ storeRuntime, stripeRuntime, billing: "stripe", hasStripeProvider: true }),
    ).toBe(stripeRuntime);
  });

  it("falls back to the store runtime when billing is 'stripe' but no stripe provider was passed", () => {
    // Without this, `useProducts` leaves the stripe runtime at "idle" forever
    // (it bails before calling a provider it does not have), `computeIsReady`
    // never turns true, and every paywall silently stops presenting — the same
    // trap `mergeProductRuntimes` documents for its own status merge.
    const idleStripe = runtime({ status: "idle" });
    expect(
      selectActiveProductRuntime({
        storeRuntime,
        stripeRuntime: idleStripe,
        billing: "stripe",
        hasStripeProvider: false,
      }),
    ).toBe(storeRuntime);
  });

  it("never merges the two statuses", () => {
    // A store paywall must not be held un-ready by the stripe pass.
    const selected = selectActiveProductRuntime({
      storeRuntime: runtime({ status: "ready" }),
      stripeRuntime: runtime({ status: "loading" }),
      billing: "store",
      hasStripeProvider: true,
    });
    expect(selected.status).toBe("ready");
  });
});
