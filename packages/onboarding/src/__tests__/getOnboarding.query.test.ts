import { describe, it, expect, vi, beforeEach } from "vitest";

// AsyncStorage is mocked — the query reads/writes the production cache through it.
const { getItem, setItem } = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem },
}));

import { getOnboardingQuery } from "../infra/queries/getOnboarding.query";

const CACHE_KEY = "rocapine-onboarding-studio";

const realOnboarding = { metadata: { id: "real" }, steps: [], fonts: {} } as any;
const fallbackOnboarding = { metadata: { id: "fallback" }, steps: [], fonts: {} } as any;

// Builds a fake client whose `getSteps` resolves to the given payload + the
// ONBS-Onboarding-Id header the SDK uses to flag the offline fallback.
const makeClient = (
  { isSandbox, onboardingId, data }: { isSandbox: boolean; onboardingId: string; data: any }
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
    options: { isSandbox, baseUrl: undefined },
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
    setItem.mockResolvedValue(undefined);
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
});
