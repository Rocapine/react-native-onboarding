import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveAll } from "./derive";
import { productRefIdentity } from "./refIdentity";
import type {
  ProductProvider,
  ProductRef,
  ProductRuntime,
  ProductStatus,
  ProductWithDerived,
  PurchaseResult,
  RestoreResult,
} from "./types";

const EMPTY_PRODUCTS: Record<string, ProductWithDerived> = {};

/**
 * Resolves `refs` through `provider` once per (refs, provider) pair and exposes
 * a referentially stable ProductRuntime.
 *
 * Stability matters: this object lands in RenderContext's dependency array, so
 * an identity change on every render would re-render every memoized element on
 * every variable write — undoing the Phase 1 memoization work. It is memoized on
 * its actual contents, and purchase/restore are useCallback-stable.
 */
export const useProducts = (
  refs: ProductRef[] | undefined,
  provider: ProductProvider | undefined,
  locale?: string
): ProductRuntime => {
  const [products, setProducts] = useState<Record<string, ProductWithDerived>>(EMPTY_PRODUCTS);
  const [status, setStatus] = useState<ProductStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [purchasing, setPurchasing] = useState(false);

  // Refs so the callbacks below never need to be re-created.
  const productsRef = useRef(products);
  productsRef.current = products;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  // Key the effect on the refs' identity CONTENT, not the array identity — a
  // host passing an inline array literal would otherwise refetch every render.
  // `productRefIdentity` owns the field list; see its doc for why it is shared
  // with `collectProductRefs` rather than duplicated here.
  // "\u001E" (record separator) BETWEEN refs, distinct from the "\u001F"
  // `productRefIdentity` puts between FIELDS — one separator for each nesting
  // level, so no arrangement of ids can produce two identical keys.
  const refsKey = useMemo(() => (refs ?? []).map(productRefIdentity).join("\u001E"), [refs]);
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    const current = refsRef.current;
    const prov = providerRef.current;
    if (!prov || !current || current.length === 0) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(undefined);
    prov
      .getProducts(current)
      .then((resolved) => {
        if (cancelled) return;
        setProducts(deriveAll(resolved, current, locale));
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refsKey, locale]);

  const purchase = useCallback(async (key: string): Promise<PurchaseResult> => {
    const prov = providerRef.current;
    const product = productsRef.current[key];
    if (!prov || !product) {
      return { status: "error", error: new Error(`No resolved product for key "${key}"`) };
    }
    setPurchasing(true);
    try {
      return await prov.purchase(product);
    } catch (e) {
      return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<RestoreResult> => {
    const prov = providerRef.current;
    if (!prov) return { status: "error", error: new Error("No ProductProvider") };
    try {
      return await prov.restore();
    } catch (e) {
      return { status: "error", error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  return useMemo(
    () => ({ products, status, error, purchasing, purchase, restore }),
    [products, status, error, purchasing, purchase, restore]
  );
};
