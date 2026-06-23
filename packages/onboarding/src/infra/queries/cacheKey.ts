/**
 * AsyncStorage key derivation for the cached onboarding payload.
 *
 * Lives in its own module so both `getOnboarding.query.ts` and
 * `OnboardingStudioClient` can use it as a value without a circular import
 * (the query module imports `OnboardingStudioClient` for typing).
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
