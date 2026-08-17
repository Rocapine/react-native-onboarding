import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { PaywallCatalog } from "./types";
import { getPaywallsCacheKey } from "./cacheKey";

/**
 * Mirrors `getOnboarding.query.ts`'s cache-first / background-revalidate /
 * custom-key behaviour exactly (same `staleTime: Infinity`, same
 * production-vs-sandbox split, same "no background refetch under a custom
 * key" rule) so a paywall does not revalidate differently from an
 * onboarding.
 *
 * Deliberate difference: `getOnboardingQuery`'s `fetchAndCache` special-cases
 * the client's offline-fallback payload (`ONBS-Onboarding-Id === "fallback"`)
 * and skips caching it. `OnboardingStudioClient.getPaywalls` has no fallback
 * option — it always throws on a network/response error instead of returning
 * a stand-in payload — so there is no fallback case to special-case here:
 * every resolved catalog is a real one and is always cached.
 */
export const getPaywallsQuery = (
  client: OnboardingStudioClient,
  locale: string,
  customAudienceParams: Record<string, any>,
  setCatalog?: (catalog: PaywallCatalog) => void
) => {
  return {
    queryKey: [
      "paywallCatalog",
      client.projectId,
      client.options.isSandbox,
      client.options.baseUrl,
      client.options.cacheKey,
      locale,
      JSON.stringify(customAudienceParams),
    ],
    queryFn: async (): Promise<PaywallCatalog> => {
      const isProduction = !(client?.options?.isSandbox || false);
      // A custom key opts into app-controlled caching: persist cache-first
      // with NO background revalidation, so a pinned version survives across
      // launches. The default key keeps stale-while-revalidate.
      const hasCustomKey = Boolean(client.options.cacheKey);
      const cacheKey = getPaywallsCacheKey(client.options.cacheKey);

      // Fetches the live catalog, pushes it to the provider, and caches it.
      // Unlike `getOnboardingQuery`, there is no fallback payload to exclude
      // from caching (see module doc above) — a rejection here propagates
      // as-is (error-surfacing, not a resolved fallback).
      const fetchAndCache = async (): Promise<PaywallCatalog> => {
        const { data } = await client.getPaywalls(
          { locale },
          customAudienceParams
        );

        setCatalog && setCatalog(data);

        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (error) {
          console.warn("Failed to cache paywalls:", error);
        }

        return data;
      };

      // Sandbox / draft: always fetch fresh, no caching.
      if (!isProduction) {
        return fetchAndCache();
      }

      // Production: serve the cached catalog instantly (fast first paint,
      // offline-resilient). With the default key this is stale-while-revalidate
      // (also refresh in the background so studio re-deploys propagate and a
      // stale cache heals). With a custom key it's persist-only — no background
      // refetch — so a pinned version is never swapped out from under the host.
      let cached: PaywallCatalog | null = null;
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) cached = JSON.parse(cachedData) as PaywallCatalog;
      } catch (error) {
        console.warn("Failed to load cached paywalls:", error);
      }

      if (cached) {
        setCatalog && setCatalog(cached);
        if (!hasCustomKey) {
          // Background revalidation — updates the cache + provider state when a
          // fresh real payload arrives. Errors are swallowed: the cache already
          // painted, so an offline revalidation must not surface as a query error.
          void fetchAndCache().catch((error) => {
            console.warn("Background paywalls revalidation failed:", error);
          });
        }
        return cached;
      }

      // No cache yet: await the network. A rejection here surfaces as the
      // query's error (there is no fallback to fall back to).
      return fetchAndCache();
    },
    staleTime: Infinity,
  };
};
