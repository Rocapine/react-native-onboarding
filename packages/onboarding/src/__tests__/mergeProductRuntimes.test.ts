import { describe, it, expect } from "vitest";
import { mergeProductRuntimes } from "../products/mergeProductRuntimes";
import type { ProductRuntime, ProductWithDerived } from "../products/types";

const product = (key: string): ProductWithDerived => ({
  key,
  productId: `com.app.${key}`,
  store: "app_store",
  title: key,
  description: key,
  price: "$1.99",
  priceAmount: 1.99,
  currencyCode: "USD",
  period: null,
  periodCount: 1,
  periodIso: null,
});

const makeRuntime = (overrides: Partial<ProductRuntime> = {}): ProductRuntime => ({
  products: {},
  status: "idle",
  purchasing: false,
  purchase: async () => ({ status: "cancelled" }),
  restore: async () => ({ status: "nothing_to_restore" }),
  ...overrides,
});

// Finding 5, 2026-08-17 final review: `OnboardingProvider` publishes ONE of
// two ProductRuntimes (the shared `PaywallProvider` context one, or its own
// local `useProducts` call) — never both — so a host's own `productRefs`
// resolved locally were invisible whenever a context runtime existed. This
// function is the fix: it unions the two into one runtime.
describe("mergeProductRuntimes", () => {
  it("returns the context runtime UNCHANGED when there are no local refs to add — the common case", () => {
    const contextRuntime = makeRuntime({ products: { yearly: product("yearly") }, status: "ready" });
    const localRuntime = makeRuntime();

    const result = mergeProductRuntimes(contextRuntime, localRuntime, false);

    expect(result).toBe(contextRuntime);
  });

  it("unions both runtimes' products when the host declared local productRefs", () => {
    const contextRuntime = makeRuntime({ products: { yearly: product("yearly") }, status: "ready" });
    const localRuntime = makeRuntime({ products: { lifetime: product("lifetime") }, status: "ready" });

    const result = mergeProductRuntimes(contextRuntime, localRuntime, true);

    expect(result.products).toEqual({
      yearly: product("yearly"),
      lifetime: product("lifetime"),
    });
  });

  it("is not ready until BOTH runtimes are ready", () => {
    const contextRuntime = makeRuntime({ status: "ready" });
    const localRuntime = makeRuntime({ status: "loading" });

    expect(mergeProductRuntimes(contextRuntime, localRuntime, true).status).toBe("loading");
  });

  it("reports 'error' if either runtime errored", () => {
    const contextRuntime = makeRuntime({ status: "ready" });
    const localRuntime = makeRuntime({ status: "error", error: "boom" });

    const result = mergeProductRuntimes(contextRuntime, localRuntime, true);
    expect(result.status).toBe("error");
    expect(result.error).toBe("boom");
  });

  it("is 'ready' once both runtimes resolved", () => {
    const contextRuntime = makeRuntime({ status: "ready" });
    const localRuntime = makeRuntime({ status: "ready" });

    expect(mergeProductRuntimes(contextRuntime, localRuntime, true).status).toBe("ready");
  });

  it("purchasing is true if EITHER runtime is mid-purchase", () => {
    const contextRuntime = makeRuntime({ purchasing: false });
    const localRuntime = makeRuntime({ purchasing: true });

    expect(mergeProductRuntimes(contextRuntime, localRuntime, true).purchasing).toBe(true);
  });

  it("purchase() routes a key resolved by the LOCAL runtime through the local provider", async () => {
    let calledLocal = false;
    const contextRuntime = makeRuntime({
      products: { yearly: product("yearly") },
      purchase: async () => {
        throw new Error("must not call context purchase for a local-only key");
      },
    });
    const localRuntime = makeRuntime({
      products: { lifetime: product("lifetime") },
      purchase: async (key) => {
        calledLocal = true;
        return { status: "purchased", productKey: key };
      },
    });

    const result = await mergeProductRuntimes(contextRuntime, localRuntime, true).purchase("lifetime");

    expect(calledLocal).toBe(true);
    expect(result).toEqual({ status: "purchased", productKey: "lifetime" });
  });

  it("purchase() routes anything else — including an unknown key — through the context runtime", async () => {
    let calledContext = false;
    const contextRuntime = makeRuntime({
      products: { yearly: product("yearly") },
      purchase: async (key) => {
        calledContext = true;
        return { status: "purchased", productKey: key };
      },
    });
    const localRuntime = makeRuntime({ products: { lifetime: product("lifetime") } });

    const result = await mergeProductRuntimes(contextRuntime, localRuntime, true).purchase("yearly");

    expect(calledContext).toBe(true);
    expect(result).toEqual({ status: "purchased", productKey: "yearly" });
  });

  it("restore() always delegates to the context runtime — restoring is store-account-wide, not per-ref", async () => {
    let calledContext = false;
    let calledLocal = false;
    const contextRuntime = makeRuntime({
      restore: async () => {
        calledContext = true;
        return { status: "restored", entitlements: ["pro"] };
      },
    });
    const localRuntime = makeRuntime({
      restore: async () => {
        calledLocal = true;
        return { status: "restored", entitlements: ["pro"] };
      },
    });

    const result = await mergeProductRuntimes(contextRuntime, localRuntime, true).restore();

    expect(calledContext).toBe(true);
    expect(calledLocal).toBe(false);
    expect(result).toEqual({ status: "restored", entitlements: ["pro"] });
  });
});
