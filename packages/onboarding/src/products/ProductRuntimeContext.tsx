import { createContext, useContext } from "react";
import type { ProductRuntime } from "./types";

/**
 * Publishes one `ProductRuntime` above both `PaywallProvider` and
 * `OnboardingProvider`, so a `PaywallProvider` mounted around an
 * `OnboardingProvider` (Phase 5's `presentPaywall` arrangement) gives them one
 * shared product catalog instead of each mounting its own `useProducts` — one
 * store round-trip, one `purchasing` flag, for both.
 *
 * `null` by default: nothing above publishes a runtime, which is the normal
 * case for an app that mounts only `OnboardingProvider`.
 */
export const ProductRuntimeContext = createContext<ProductRuntime | null>(null);

/** The ancestor `ProductRuntime`, or `null` when no provider publishes one. */
export const useProductRuntime = (): ProductRuntime | null => useContext(ProductRuntimeContext);
