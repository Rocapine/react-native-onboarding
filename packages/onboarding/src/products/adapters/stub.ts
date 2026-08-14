import type { ProductProvider, ProductRef, ResolvedProduct } from "../types";

/**
 * In-memory provider for demos, tests, and studio previews. NEVER ship a paywall
 * backed by this — its prices are invented, and App Review rejects a paywall
 * whose displayed price does not match the store.
 */
export const stubProductProvider = (
  catalog: Record<string, Omit<ResolvedProduct, "key">>
): ProductProvider => ({
  async getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]> {
    return refs.filter((r) => catalog[r.key]).map((r) => ({ key: r.key, ...catalog[r.key] }));
  },
  async purchase(product) {
    return { status: "purchased", productKey: product.key };
  },
  async restore() {
    return { status: "nothing_to_restore" };
  },
});
