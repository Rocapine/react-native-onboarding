import { describe, it, expect } from "vitest";
import {
  getOnboardingCacheKey,
  getPaywallsCacheKey,
  DEFAULT_ONBOARDING_CACHE_KEY,
  DEFAULT_PAYWALLS_CACHE_KEY,
  ONBOARDING_CACHE_KEY_PREFIX,
  PAYWALLS_CACHE_KEY_PREFIX,
} from "../infra/queries/cacheKey";
import { paramsHash } from "../userProperties/serialize";
import { USER_PROPERTIES_STORAGE_KEY } from "../userProperties/store";

describe("cache keys", () => {
  it("is byte-identical to the legacy key when there are no params", () => {
    expect(getOnboardingCacheKey()).toBe(DEFAULT_ONBOARDING_CACHE_KEY);
    expect(getOnboardingCacheKey(undefined, "")).toBe(DEFAULT_ONBOARDING_CACHE_KEY);
    expect(getPaywallsCacheKey()).toBe(DEFAULT_PAYWALLS_CACHE_KEY);
    expect(getPaywallsCacheKey(undefined, "")).toBe(DEFAULT_PAYWALLS_CACHE_KEY);
    expect(getPaywallsCacheKey("v2")).toBe("rocapine-paywalls-sdk-v2");
    expect(getOnboardingCacheKey("v2")).toBe("rocapine-onboarding-sdk-v2");
  });

  it("appends the hash when params are present", () => {
    const hash = paramsHash({ plan: "free" });
    expect(getPaywallsCacheKey(undefined, hash)).toBe(`${DEFAULT_PAYWALLS_CACHE_KEY}-${hash}`);
    expect(getPaywallsCacheKey("v2", hash)).toBe(`rocapine-paywalls-sdk-v2-${hash}`);
  });

  it("gives different params different keys", () => {
    const a = getPaywallsCacheKey(undefined, paramsHash({ plan: "free" }));
    const b = getPaywallsCacheKey(undefined, paramsHash({ plan: "pro" }));
    expect(a).not.toBe(b);
  });

  it("gives the same params the same key regardless of insertion order", () => {
    const a = getPaywallsCacheKey(undefined, paramsHash({ plan: "free", days: "3" }));
    const b = getPaywallsCacheKey(undefined, paramsHash({ days: "3", plan: "free" }));
    expect(a).toBe(b);
  });

  it("keeps the two domains on separate prefixes", () => {
    const hash = paramsHash({ plan: "free" });
    expect(getOnboardingCacheKey(undefined, hash).startsWith(ONBOARDING_CACHE_KEY_PREFIX)).toBe(true);
    expect(getPaywallsCacheKey(undefined, hash).startsWith(PAYWALLS_CACHE_KEY_PREFIX)).toBe(true);
  });

  it("every key a helper can produce starts with its prefix, so clearCache finds it", () => {
    const hash = paramsHash({ plan: "free" });
    for (const key of [
      getPaywallsCacheKey(),
      getPaywallsCacheKey("v2"),
      getPaywallsCacheKey(undefined, hash),
      getPaywallsCacheKey("v2", hash),
    ]) {
      expect(key.startsWith(PAYWALLS_CACHE_KEY_PREFIX)).toBe(true);
    }
    for (const key of [
      getOnboardingCacheKey(),
      getOnboardingCacheKey("v2"),
      getOnboardingCacheKey(undefined, hash),
      getOnboardingCacheKey("v2", hash),
    ]) {
      expect(key.startsWith(ONBOARDING_CACHE_KEY_PREFIX)).toBe(true);
    }
  });

  it("does not match the user-property key, which clearCache must never wipe", () => {
    expect(USER_PROPERTIES_STORAGE_KEY.startsWith(ONBOARDING_CACHE_KEY_PREFIX)).toBe(false);
    expect(USER_PROPERTIES_STORAGE_KEY.startsWith(PAYWALLS_CACHE_KEY_PREFIX)).toBe(false);
  });
});
