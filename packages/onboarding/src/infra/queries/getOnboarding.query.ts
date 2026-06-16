import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import { BaseStepType, Onboarding, OnboardingMetadata } from "../../types";
import type { UseQueryOptions } from "@tanstack/react-query";

const cacheKey = "rocapine-onboarding-studio";

export const getOnboardingQuery = <StepType extends BaseStepType>(
  client: OnboardingStudioClient,
  locale: string,
  customAudienceParams: Record<string, any>,
  setOnboarding?: (onboarding: Onboarding<StepType>) => void
) => {
  return {
    queryKey: [
      "onboardingQuestions",
      client.projectId,
      client.options.isSandbox,
      client.options.baseUrl,
      locale,
      JSON.stringify(customAudienceParams),
    ],
    queryFn: async (): Promise<Onboarding<StepType>> => {
      const isProduction = !(client?.options?.isSandbox || false);

      // Fetches the live payload, pushes it to the provider, and caches it —
      // but NEVER caches the offline fallback. Caching the fallback (with
      // `staleTime: Infinity` + cache-first below) would pin every future
      // launch to the fallback even after the network recovers, and the device
      // would stop calling the edge function entirely. Returns the payload.
      const fetchAndCache = async (): Promise<Onboarding<StepType>> => {
        const { data, headers } = await client!.getSteps<StepType>(
          { locale },
          customAudienceParams
        );

        const isFallback = headers["ONBS-Onboarding-Id"] === "fallback";
        console.info("onbs-onboarding-name", headers["ONBS-Onboarding-Name"]);
        console.info("onbs-onboarding-id", headers["ONBS-Onboarding-Id"]);
        setOnboarding && setOnboarding(data);

        if (!isFallback) {
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (error) {
            console.warn("Failed to cache onboarding questions:", error);
          }
        }

        return data;
      };

      // Sandbox / draft: always fetch fresh, no caching.
      if (!isProduction) {
        return fetchAndCache();
      }

      // Production: stale-while-revalidate. Serve the cached payload instantly
      // (fast first paint, offline-resilient) AND refresh from the network in
      // the background, so studio re-deploys propagate and a stale cache heals.
      let cached: Onboarding<StepType> | null = null;
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) cached = JSON.parse(cachedData) as Onboarding<StepType>;
      } catch (error) {
        console.warn("Failed to load cached onboarding questions:", error);
      }

      if (cached) {
        setOnboarding && setOnboarding(cached);
        // Background revalidation — updates the cache + provider state when a
        // fresh real payload arrives. Errors are swallowed: the cache already
        // painted, so an offline revalidation must not surface as a query error.
        void fetchAndCache().catch((error) => {
          console.warn("Background onboarding revalidation failed:", error);
        });
        return cached;
      }

      // No cache yet: await the network. A fallback result is returned but NOT
      // cached, so the next launch retries instead of being pinned to it.
      return fetchAndCache();
    },
    staleTime: Infinity,
  };
};
