import { describe, it, expect, vi, beforeEach } from "vitest";

// AsyncStorage is mocked — the query reads/writes the production cache through it.
const { getItem, setItem, removeItem, getAllKeys, multiRemove } = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
  // `clearCache` scans by prefix now, because the keys are scoped by a hash of
  // the resolved audience params and are no longer predictable one-by-one.
  getAllKeys: vi.fn<() => Promise<string[]>>(),
  multiRemove: vi.fn<(keys: string[]) => Promise<void>>(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem, removeItem, getAllKeys, multiRemove },
}));
// OnboardingStudioClient (used by the clearCache test) imports `react-native`
// for `Platform`; stub it so the class loads under Node.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { OnboardingStudioClient } from "../OnboardingStudioClient";
import {
  getOnboardingCacheKey,
  DEFAULT_ONBOARDING_CACHE_KEY,
} from "../infra/queries/cacheKey";
import { getOnboardingQuery } from "../infra/queries/getOnboarding.query";

const CACHE_KEY = "rocapine-onboarding-studio";
const CUSTOM_KEY = "v2";
const CUSTOM_CACHE_KEY = "rocapine-onboarding-sdk-v2";

const realOnboarding = { metadata: { id: "real" }, steps: [], fonts: {} } as any;
const fallbackOnboarding = { metadata: { id: "fallback" }, steps: [], fonts: {} } as any;

// Builds a fake client whose `getSteps` resolves to the given payload + the
// ONBS-Onboarding-Id header the SDK uses to flag the offline fallback.
const makeClient = (
  { isSandbox, onboardingId, data, cacheKey }: { isSandbox: boolean; onboardingId: string; data: any; cacheKey?: string }
) => {
  const getSteps = vi.fn().mockResolvedValue({
    data,
    headers: {
      "ONBS-Onboarding-Id": onboardingId,
      "ONBS-Onboarding-Name": onboardingId,
      "ONBS-Audience-Id": onboardingId,
    },
  });
  return {
    projectId: "p1",
    options: { isSandbox, baseUrl: undefined, cacheKey },
    getSteps,
  } as any;
};

const run = (client: any, setOnboarding = vi.fn()) =>
  (getOnboardingQuery(client, "en", {}, setOnboarding) as any).queryFn();

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("getOnboardingQuery", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    setItem.mockResolvedValue(undefined);
    removeItem.mockResolvedValue(undefined);
  });

  it("sandbox: always fetches, never touches the cache", async () => {
    const client = makeClient({ isSandbox: true, onboardingId: "real", data: realOnboarding });
    const data = await run(client);

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(realOnboarding));
    expect(data).toBe(realOnboarding);
  });

  it("production cache miss + real payload: fetches and caches", async () => {
    getItem.mockResolvedValue(null);
    const client = makeClient({ isSandbox: false, onboardingId: "real", data: realOnboarding });
    const setOnboarding = vi.fn();
    const data = await run(client, setOnboarding);

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(realOnboarding));
    expect(setOnboarding).toHaveBeenCalledWith(realOnboarding);
    expect(data).toBe(realOnboarding);
  });

  it("production cache miss + fallback: returns it but does NOT cache it", async () => {
    getItem.mockResolvedValue(null);
    const client = makeClient({ isSandbox: false, onboardingId: "fallback", data: fallbackOnboarding });
    const data = await run(client);

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(data).toBe(fallbackOnboarding);
  });

  it("production cache hit: returns cache immediately and revalidates in the background", async () => {
    const cached = { metadata: { id: "cached" }, steps: [], fonts: {} } as any;
    getItem.mockResolvedValue(JSON.stringify(cached));
    const client = makeClient({ isSandbox: false, onboardingId: "real", data: realOnboarding });
    const setOnboarding = vi.fn();

    const data = await run(client, setOnboarding);

    // Served from cache without blocking on the network.
    expect(data).toEqual(cached);
    expect(setOnboarding).toHaveBeenCalledWith(cached);

    // Background revalidation runs after the cache is returned.
    await flush();
    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(realOnboarding));
    expect(setOnboarding).toHaveBeenCalledWith(realOnboarding);
  });

  it("custom key, cache hit: serves cache and does NOT revalidate", async () => {
    const cached = { metadata: { id: "cached" }, steps: [], fonts: {} } as any;
    getItem.mockResolvedValue(JSON.stringify(cached));
    const client = makeClient({ isSandbox: false, onboardingId: "real", data: realOnboarding, cacheKey: CUSTOM_KEY });
    const setOnboarding = vi.fn();

    const data = await run(client, setOnboarding);

    // Reads the namespaced key and serves it.
    expect(getItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY);
    expect(data).toEqual(cached);
    expect(setOnboarding).toHaveBeenCalledWith(cached);

    // No background revalidation — the pinned version is never refetched.
    await flush();
    expect(client.getSteps).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("custom key, cache miss: fetches once and persists under the namespaced key", async () => {
    getItem.mockResolvedValue(null);
    const client = makeClient({ isSandbox: false, onboardingId: "real", data: realOnboarding, cacheKey: CUSTOM_KEY });

    const data = await run(client);

    expect(getItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY);
    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY, JSON.stringify(realOnboarding));
    expect(data).toBe(realOnboarding);
  });
});

describe("getOnboardingCacheKey", () => {
  it("returns the default key when no custom key is given", () => {
    expect(getOnboardingCacheKey()).toBe(DEFAULT_ONBOARDING_CACHE_KEY);
    expect(DEFAULT_ONBOARDING_CACHE_KEY).toBe(CACHE_KEY);
  });

  it("namespaces a custom key", () => {
    expect(getOnboardingCacheKey(CUSTOM_KEY)).toBe(CUSTOM_CACHE_KEY);
  });
});

describe("OnboardingStudioClient.clearCache", () => {
  beforeEach(() => {
    multiRemove.mockReset();
    multiRemove.mockResolvedValue(undefined);
    getAllKeys.mockReset();
  });

  it("clears every param variant of both domains, plus any legacy unscoped key", async () => {
    getAllKeys.mockResolvedValue([
      CACHE_KEY,
      `${CACHE_KEY}-7f3a1c92`,
      CUSTOM_CACHE_KEY,
      "rocapine-paywalls-studio",
      "rocapine-paywalls-sdk-v2-deadbeef",
      "unrelated-app-key",
    ]);
    const client = new OnboardingStudioClient("p1", {});
    await client.clearCache();
    expect(multiRemove).toHaveBeenCalledWith([
      CACHE_KEY,
      `${CACHE_KEY}-7f3a1c92`,
      CUSTOM_CACHE_KEY,
      "rocapine-paywalls-studio",
      "rocapine-paywalls-sdk-v2-deadbeef",
    ]);
  });

  it("leaves user properties alone — clearing a cache must not forget who the user is", async () => {
    getAllKeys.mockResolvedValue(["rocapine-user-properties"]);
    const client = new OnboardingStudioClient("p1", {});
    await client.clearCache();
    expect(multiRemove).not.toHaveBeenCalled();
  });

  it("does nothing when there is nothing of ours to clear", async () => {
    getAllKeys.mockResolvedValue(["unrelated-app-key"]);
    const client = new OnboardingStudioClient("p1", {});
    await client.clearCache();
    expect(multiRemove).not.toHaveBeenCalled();
  });

  it("does not throw when storage enumeration fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getAllKeys.mockRejectedValue(new Error("storage unavailable"));
    const client = new OnboardingStudioClient("p1", {});
    await expect(client.clearCache()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
