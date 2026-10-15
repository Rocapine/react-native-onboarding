/**
 * AsyncStorage key derivation for the SDK's cached payloads (onboarding
 * steps, paywall catalog).
 *
 * Lives in its own module so `getOnboarding.query.ts`, `getPaywalls.query.ts`
 * and `OnboardingStudioClient` can all use these as values without a circular
 * import (the query modules import `OnboardingStudioClient` for typing) —
 * this module itself has no imports, and must keep none that reach
 * `OnboardingStudioClient`.
 *
 * ## Why the key is scoped by params
 *
 * The react-query key has always been scoped by `customAudienceParams`; this
 * disk key was a bare constant. So a cache-first read could serve a payload
 * resolved under DIFFERENT params — non-null, and therefore indistinguishable
 * from a correct one — with a fresh fetch in flight behind it.
 *
 * Observed in production: an audience gated on `hoursSinceOnboardingPaywall >= 44`
 * was served the pre-threshold catalog on the launch where the user first became
 * eligible, so the arm under test lost exactly the launch that mattered.
 *
 * That needed volatile params to trigger, which was rare while params were a
 * static prop. The user-property store makes volatile params normal, so the key
 * carries a hash of the resolved params (`userProperties/serialize.ts`'s
 * `paramsHash`). An EMPTY hash yields the legacy key byte-for-byte, so shipping
 * this does not invalidate existing installs.
 *
 * Every key these helpers can produce starts with one of the two prefixes below,
 * which is what lets `OnboardingStudioClient.clearCache` find them all by
 * scanning rather than by naming a key it can no longer predict.
 */

/**
 * Every onboarding cache key starts with this — `clearCache` scans on it.
 *
 * Deliberately NOT a bare `rocapine-`: `USER_PROPERTIES_STORAGE_KEY` is
 * `rocapine-user-properties`, and clearing a payload cache must not forget who
 * the user is.
 */
export const ONBOARDING_CACHE_KEY_PREFIX = "rocapine-onboarding";

/** Every paywall cache key starts with this — `clearCache` scans on it. */
export const PAYWALLS_CACHE_KEY_PREFIX = "rocapine-paywalls";

/** Appends the params fingerprint, or nothing at all when there are no params. */
const withHash = (base: string, hash?: string): string => (hash ? `${base}-${hash}` : base);

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
 *
 * `paramsHash` scopes the key to the resolved audience params — see the module
 * doc. Omit it (or pass `""`) for the legacy, unscoped key.
 */
export const getOnboardingCacheKey = (customKey?: string, paramsHash?: string): string =>
  withHash(
    customKey ? `rocapine-onboarding-sdk-${customKey}` : DEFAULT_ONBOARDING_CACHE_KEY,
    paramsHash,
  );

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
 *
 * `paramsHash` scopes the key to the resolved audience params — see the module
 * doc. Omit it (or pass `""`) for the legacy, unscoped key.
 */
export const getPaywallsCacheKey = (customKey?: string, paramsHash?: string): string =>
  withHash(
    customKey ? `rocapine-paywalls-sdk-${customKey}` : DEFAULT_PAYWALLS_CACHE_KEY,
    paramsHash,
  );
