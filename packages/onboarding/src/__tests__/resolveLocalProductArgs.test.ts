import { describe, it, expect, vi } from "vitest";

// OnboardingProvider.tsx transitively imports `react-native` (via
// OnboardingStudioClient/registry.ts) and AsyncStorage — mocked the same way
// getOnboarding.query.test.ts does, so the module loads under Node.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { resolveLocalProductArgs } from "../infra/provider/OnboardingProvider";
import type { ProductProvider, ProductRef } from "../products/types";

const REFS: ProductRef[] = [{ key: "yearly", ios: "com.app.yearly" }];
const PROVIDER: ProductProvider = {
  getProducts: async () => [],
  purchase: async () => ({ status: "cancelled" }),
  restore: async () => ({ status: "nothing_to_restore" }),
};

// Finding 5, 2026-08-17 final review: this function used to zero refs/provider
// out whenever a context runtime existed, on the assumption that the paywall
// catalog's product union is always a superset of the host's own `productRefs`
// — that silently broke a documented Phase 3 prop the moment a `PaywallProvider`
// was mounted above. It now passes the host's own args through UNCONDITIONALLY;
// `mergeProductRuntimes` (see its own test) does the unioning at the runtime
// level. This test guards the pass-through itself against a regression back to
// the old zeroing behavior.
describe("resolveLocalProductArgs", () => {
  it("passes the host's own refs/provider through unchanged", () => {
    const result = resolveLocalProductArgs(REFS, PROVIDER);
    expect(result.refs).toBe(REFS);
    expect(result.provider).toBe(PROVIDER);
  });

  it("stays undefined when the host declared no productRefs/productProvider props", () => {
    const result = resolveLocalProductArgs(undefined, undefined);
    expect(result.refs).toBeUndefined();
    expect(result.provider).toBeUndefined();
  });
});
