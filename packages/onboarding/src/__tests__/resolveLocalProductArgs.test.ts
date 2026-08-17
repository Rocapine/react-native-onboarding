import { describe, it, expect, vi } from "vitest";

// OnboardingProvider.tsx transitively imports `react-native` (via
// OnboardingStudioClient/registry.ts) and AsyncStorage — mocked the same way
// getOnboarding.query.test.ts does, so the module loads under Node.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { resolveLocalProductArgs } from "../infra/provider/OnboardingProvider";
import type { ProductProvider, ProductRef, ProductRuntime } from "../products/types";

const REFS: ProductRef[] = [{ key: "yearly", ios: "com.app.yearly" }];
const PROVIDER: ProductProvider = {
  getProducts: async () => [],
  purchase: async () => ({ status: "cancelled" }),
  restore: async () => ({ status: "nothing_to_restore" }),
};
const CONTEXT_RUNTIME: ProductRuntime = {
  products: {},
  status: "ready",
  purchasing: false,
  purchase: async () => ({ status: "cancelled" }),
  restore: async () => ({ status: "nothing_to_restore" }),
};

// This is the exact decision the shared-runtime feature hinges on: get it
// backwards and either (a) a wrapped OnboardingProvider double-fetches
// alongside the shared runtime, or (b) a standalone one silently never
// resolves its products — no error, no failing test, just missing products.
// See the comment on `resolveLocalProductArgs` in OnboardingProvider.tsx.
describe("resolveLocalProductArgs", () => {
  it("standalone (no context runtime): passes the host's own refs/provider through unchanged", () => {
    const result = resolveLocalProductArgs(null, REFS, PROVIDER);
    expect(result.refs).toBe(REFS);
    expect(result.provider).toBe(PROVIDER);
  });

  it("standalone with no productRefs/productProvider props: stays undefined (host declared no products)", () => {
    const result = resolveLocalProductArgs(null, undefined, undefined);
    expect(result.refs).toBeUndefined();
    expect(result.provider).toBeUndefined();
  });

  it("provider-above: local call gets an empty ref set and no provider, regardless of the host's own props", () => {
    const result = resolveLocalProductArgs(CONTEXT_RUNTIME, REFS, PROVIDER);
    expect(result.refs).toEqual([]);
    expect(result.provider).toBeUndefined();
  });
});
