import { describe, it, expect } from "vitest";
import {
  collectProductRefs,
  computeIsReady,
  purchaseOutcomeFromResult,
  resolvePresentDecision,
  resolvePresentedOutcome,
} from "../present";
import type { Paywall, PaywallCatalog } from "../types";
import type { PurchaseResult } from "../../products/types";

const makePaywall = (overrides: Partial<Paywall> & Pick<Paywall, "id" | "placement">): Paywall => ({
  name: overrides.name ?? "Paywall",
  elements: overrides.elements ?? [],
  products: overrides.products ?? [],
  configuration: overrides.configuration ?? null,
  ...overrides,
});

const makeCatalog = (paywalls: Paywall[]): PaywallCatalog => ({
  metadata: { audienceId: null, audienceName: null, locale: "en", draft: false },
  paywalls: Object.fromEntries(paywalls.map((p) => [p.placement, p])),
  fonts: null,
});

describe("collectProductRefs", () => {
  it("returns an empty array for a null catalog", () => {
    expect(collectProductRefs(null)).toEqual([]);
  });

  it("returns an empty array when no paywall declares any products", () => {
    const catalog = makeCatalog([makePaywall({ id: "1", placement: "a", products: [] })]);
    expect(collectProductRefs(catalog)).toEqual([]);
  });

  it("flattens products from every placement into one array", () => {
    const catalog = makeCatalog([
      makePaywall({ id: "1", placement: "a", products: [{ key: "yearly", ios: "com.app.yr" }] }),
      makePaywall({ id: "2", placement: "b", products: [{ key: "monthly", ios: "com.app.mo" }] }),
    ]);
    expect(collectProductRefs(catalog)).toEqual([
      { key: "yearly", ios: "com.app.yr" },
      { key: "monthly", ios: "com.app.mo" },
    ]);
  });

  it("dedupes identical refs (same key + ios + android + compareTo) across placements", () => {
    const shared = { key: "yearly", ios: "com.app.yr", android: "com.app.yr:p1y" };
    const catalog = makeCatalog([
      makePaywall({ id: "1", placement: "a", products: [shared] }),
      makePaywall({ id: "2", placement: "b", products: [shared, { key: "monthly", ios: "com.app.mo" }] }),
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
        placement: "a",
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
  const paywall = makePaywall({ id: "1", placement: "hard_paywall", products: [] });
  const catalog = makeCatalog([paywall]);

  it("starts when the placement exists and nothing is currently showing", () => {
    const decision = resolvePresentDecision(catalog, null, "hard_paywall");
    expect(decision).toEqual({ type: "start", paywall });
  });

  it("resolves 'error' immediately when the placement is absent from the catalog", () => {
    const decision = resolvePresentDecision(catalog, null, "does_not_exist");
    expect(decision).toEqual({ type: "immediate", result: { status: "error" } });
  });

  it("resolves 'error' immediately when the catalog has not resolved yet (null)", () => {
    const decision = resolvePresentDecision(null, null, "hard_paywall");
    expect(decision).toEqual({ type: "immediate", result: { status: "error" } });
  });

  it("resolves 'error' immediately when another paywall is already showing, even for a valid placement", () => {
    const decision = resolvePresentDecision(catalog, "already_showing", "hard_paywall");
    expect(decision).toEqual({ type: "immediate", result: { status: "error" } });
  });

  it("the concurrent-present check takes priority over the unknown-placement check", () => {
    // Both conditions are true at once: prove the function still resolves
    // rather than e.g. throwing on the first branch it happens to hit.
    const decision = resolvePresentDecision(catalog, "already_showing", "does_not_exist");
    expect(decision).toEqual({ type: "immediate", result: { status: "error" } });
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
    // "error" here means "unknown placement / already showing" (resolvePresentDecision) —
    // a purchase outcome must never be allowed to clobber that different meaning.
    expect(resolvePresentedOutcome({ status: "error" }, "purchased")).toEqual({ status: "error" });
  });
});
