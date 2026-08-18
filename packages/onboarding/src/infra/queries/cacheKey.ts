/**
 * AsyncStorage key derivation for the SDK's cached payloads (onboarding
 * steps, paywall catalog).
 *
 * Lives in its own module so `getOnboarding.query.ts`, `getPaywalls.query.ts`
 * and `OnboardingStudioClient` can all use these as values without a circular
 * import (the query modules import `OnboardingStudioClient` for typing) —
 * this module itself has no imports.
 */

/** Default cache key used when the host does not provide a custom one. */
export const DEFAULT_ONBOARDING_CACHE_KEY = "rocapine-onboarding-studio";

/**
 * Derives the AsyncStorage key for the cached onboarding payload.
 *
 * - No custom key → the shared default `"rocapine-onboarding-studio"`
 *   (stale-while-revalidate: served cache-first and healed in the background).
 * - Custom key → `"rocapine-onboarding-sdk-{customKey}"`, which the SDK
 *   persists cache-first with **no** background revalidation, so the host owns
 *   when to refetch (see `OnboardingStudioClient.clearCache`).
 */
export const getOnboardingCacheKey = (customKey?: string): string =>
  customKey
    ? `rocapine-onboarding-sdk-${customKey}`
    : DEFAULT_ONBOARDING_CACHE_KEY;

/** Default cache key used when the host does not provide a custom one. */
export const DEFAULT_PAYWALLS_CACHE_KEY = "rocapine-paywalls-studio";

/**
 * Derives the AsyncStorage key for the cached paywall catalog.
 *
 * Namespaced separately from `getOnboardingCacheKey`
 * (`rocapine-paywalls-*` vs `rocapine-onboarding-*`) so the two caches never
 * collide, even though both derive from the same `client.options.cacheKey`.
 *
 * - No custom key → the shared default `"rocapine-paywalls-studio"`
 *   (stale-while-revalidate: served cache-first and healed in the background).
 * - Custom key → `"rocapine-paywalls-sdk-{customKey}"`, which the SDK persists
 *   cache-first with **no** background revalidation, so the host owns when to
 *   refetch (see `OnboardingStudioClient.clearCache`).
 */
export const getPaywallsCacheKey = (customKey?: string): string =>
  customKey
    ? `rocapine-paywalls-sdk-${customKey}`
    : DEFAULT_PAYWALLS_CACHE_KEY;
