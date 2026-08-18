import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { PaywallCatalog } from "./types";
import { getPaywallsCacheKey } from "../infra/queries/cacheKey";

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
 *
 * `catalog` consumption used to be a `setCatalog` callback mirrored into a
 * component `useState` — but `queryFn` only re-runs on a cache MISS
 * (`staleTime: Infinity`), so that mirror went stale on a provider remount
 * (module-scope `QueryClient`, cache outlives the provider) and on a
 * query-key round-trip (`locale` switched away and back) — Finding 1, 2026-
 * 08-17 final review. The fix: `PaywallProviderInner` now reads `data`
 * straight off `useQuery` as the single source of truth — react-query's own
 * cache already gets this right on both a remount and a key round-trip. The
 * ONE case `data` alone can't cover is the BACKGROUND revalidation below:
 * `fetchAndCache()` there runs detached from the pending query call (its
 * return value is discarded, not observed by react-query), so it must push
 * the fresh payload into the query cache directly via `queryClient.
 * setQueryData` — there is no mirrored component state left to keep in sync.
 */
export const getPaywallsQuery = (
  client: OnboardingStudioClient,
  locale: string,
  customAudienceParams: Record<string, any>,
  queryClient?: QueryClient
) => {
  const queryKey = [
    "paywallCatalog",
    client.projectId,
    client.options.isSandbox,
    client.options.baseUrl,
    client.options.cacheKey,
    locale,
    JSON.stringify(customAudienceParams),
  ];

  return {
    queryKey,
    queryFn: async (): Promise<PaywallCatalog> => {
      const isProduction = !(client?.options?.isSandbox || false);
      // A custom key opts into app-controlled caching: persist cache-first
      // with NO background revalidation, so a pinned version survives across
      // launches. The default key keeps stale-while-revalidate.
      const hasCustomKey = Boolean(client.options.cacheKey);
      const cacheKey = getPaywallsCacheKey(client.options.cacheKey);

      // Fetches the live catalog, caches it, and pushes it into the query
      // cache directly — see the module doc above for why that push is
      // needed even though `queryFn`'s own return value already becomes
      // `data` for a LIVE call: this same function also runs detached, as a
      // background revalidation, whose return value nothing observes.
      // Unlike `getOnboardingQuery`, there is no fallback payload to exclude
      // from caching — a rejection here propagates as-is (error-surfacing,
      // not a resolved fallback).
      const fetchAndCache = async (): Promise<PaywallCatalog> => {
        const { data } = await client.getPaywalls(
          { locale },
          customAudienceParams
        );

        queryClient?.setQueryData<PaywallCatalog>(queryKey, data);

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
        if (!hasCustomKey) {
          // Background revalidation — updates the cache + query state when a
          // fresh real payload arrives via `queryClient.setQueryData` above.
          // Errors are swallowed: the cache already painted, so an offline
          // revalidation must not surface as a query error.
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
