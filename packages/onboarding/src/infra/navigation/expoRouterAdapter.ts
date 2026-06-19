import { useEffect } from "react";
import type { OnboardingNavigationAdapter } from "./types";

// expo-router is an OPTIONAL peer dependency. Lazily require it so the SDK
// loads (and the no-op fallbacks below take over) when it is not installed.
// Precedent: Pages/ComposableScreen/elements/haptics.ts (try/require/catch).
let expoRouter: any;
try {
  expoRouter = require("expo-router");
} catch {
  /* expo-router not installed — fall back to no-op navigation */
}

/**
 * Default navigation adapter. Binds to expo-router when available, otherwise
 * degrades gracefully: focus effect runs as a mount/cb-change effect and the
 * back button stays hidden (`canGoBack` returns false).
 *
 * Fields are bound once at module load, so the hook identities are stable —
 * consumers may call `adapter.useFocusEffect(...)` / `adapter.useRouter()`
 * directly without breaking the rules of hooks.
 */
export const expoRouterAdapter: OnboardingNavigationAdapter = {
  useFocusEffect:
    expoRouter?.useFocusEffect ??
    ((effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    }),
  useRouter: expoRouter
    ? () => {
        const router = expoRouter.useRouter();
        return {
          canGoBack: () => router.canGoBack(),
          goBack: () => router.back(),
        };
      }
    : () => ({ canGoBack: () => false, goBack: () => {} }),
};
