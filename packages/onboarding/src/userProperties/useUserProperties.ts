import { useSyncExternalStore } from "react";
import { userPropertyStore } from "./store";
import type { UserPropertySnapshot } from "./store";

/**
 * Read the user properties `OnboardingStudio` holds.
 *
 * The read path for React; the WRITE path is `OnboardingStudio.setUserProperty`
 * / `setUserProperties`, which is callable from anywhere — a login handler, an
 * analytics service — precisely because it is not a hook.
 *
 * `useSyncExternalStore` rather than a context: the store is process-wide so
 * non-React code can write to it, and this is the supported way to read an
 * external mutable source without tearing.
 *
 * Hydration is kicked off HERE as well as in `OnboardingStudio.init`, so a
 * provider that calls this is gated correctly even if the host never called
 * `init` (passing a `client` prop instead). `ensureHydrated` is memoized, so
 * calling it from a render body is safe: every call after the first returns the
 * same promise and touches no storage.
 */
export const useUserProperties = (): UserPropertySnapshot => {
  const snapshot = useSyncExternalStore(userPropertyStore.subscribe, userPropertyStore.getSnapshot);
  if (snapshot.status === "hydrating") void userPropertyStore.ensureHydrated();
  return snapshot;
};
