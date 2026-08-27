import { useSyncExternalStore } from "react";
import { userProperties } from "./store";
import type { UserPropertySnapshot } from "./store";

/**
 * Subscribe to the user-property store.
 *
 * `useSyncExternalStore` rather than a context: the store is a singleton so
 * non-React code can write to it, and this is the supported way to read an
 * external mutable source without tearing.
 *
 * Hydration is kicked off HERE rather than by the host, so a provider that calls
 * this is gated correctly with no host cooperation. `ensureHydrated` is memoized,
 * so calling it from a render body is safe: every call after the first returns
 * the same promise and touches no storage.
 */
export const useUserProperties = (): UserPropertySnapshot => {
  const snapshot = useSyncExternalStore(userProperties.subscribe, userProperties.getSnapshot);
  if (snapshot.status === "hydrating") void userProperties.ensureHydrated();
  return snapshot;
};
