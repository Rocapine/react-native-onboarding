import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// react-native is mocked so OnboardingStudioClient (which reads `Platform.OS`)
// loads under Node — same stub `getOnboarding.query.test.ts` uses.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

// AsyncStorage is mocked — the query reads/writes the paywall cache through it.
const { getItem, setItem, removeItem } = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem, removeItem },
}));

import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import {
  getOnboardingCacheKey,
  DEFAULT_ONBOARDING_CACHE_KEY,
  getPaywallsCacheKey,
  DEFAULT_PAYWALLS_CACHE_KEY,
} from "../../infra/queries/cacheKey";
import { getPaywallsQuery } from "../getPaywalls.query";
import type { PaywallCatalog } from "../types";

const CACHE_KEY = "rocapine-paywalls-studio";
const CUSTOM_KEY = "v2";
const CUSTOM_CACHE_KEY = "rocapine-paywalls-sdk-v2";

const catalog: PaywallCatalog = {
  metadata: { locale: "en", draft: false },
  paywalls: {
    onboarding_end: {
      id: "pw1",
      name: "End paywall",
      moment: "onboarding_end",
      audienceId: 1,
      audienceName: "default",
      elements: [],
      billing: "store",
      products: [{ key: "monthly", ios: "com.app.monthly" }],
      configuration: null,
    },
  },
  fonts: null,
};

type FakeResponseInit = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
};

const fakeResponse = (body: unknown, init: FakeResponseInit = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  statusText: init.statusText ?? "OK",
  json: async () => body,
  headers: { get: (name: string) => init.headers?.[name] ?? null },
});

describe("OnboardingStudioClient.getPaywalls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the URL against get-paywalls with projectId/platform/appVersion/locale, and omits moment by default", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(catalog, {
        headers: { "ONBS-Audience-Ids": "42", "ONBS-Paywall-Ids": "pw1" },
      })
    );
    const client = new OnboardingStudioClient("proj-1", { appVersion: "1.2.3" });

    await client.getPaywalls({ locale: "fr" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.pathname.endsWith("/get-paywalls")).toBe(true);
    expect(requestedUrl.searchParams.get("projectId")).toBe("proj-1");
    expect(requestedUrl.searchParams.get("platform")).toBe("ios");
    expect(requestedUrl.searchParams.get("appVersion")).toBe("1.2.3");
    expect(requestedUrl.searchParams.get("locale")).toBe("fr");
    expect(requestedUrl.searchParams.has("moment")).toBe(false);
    expect(requestedUrl.searchParams.has("draft")).toBe(false);
  });

  it("includes moment only when explicitly requested (the exception, not the default)", async () => {
    fetchMock.mockResolvedValue(fakeResponse(catalog));
    const client = new OnboardingStudioClient("proj-1", {});

    await client.getPaywalls({ locale: "en", moment: "onboarding_end" });

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("moment")).toBe("onboarding_end");
  });

  it("appends draft=true in sandbox mode, same as getSteps", async () => {
    fetchMock.mockResolvedValue(fakeResponse(catalog));
    const client = new OnboardingStudioClient("proj-1", { isSandbox: true });

    await client.getPaywalls();

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("draft")).toBe("true");
  });

  it("forwards arbitrary audience params onto the querystring", async () => {
    fetchMock.mockResolvedValue(fakeResponse(catalog));
    const client = new OnboardingStudioClient("proj-1", {});

    await client.getPaywalls(undefined, { experimentGroup: "b" });

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("experimentGroup")).toBe("b");
  });

  it("extracts ONBS-Audience-Ids and ONBS-Paywall-Ids — not the onboarding header trio", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(catalog, {
        headers: { "ONBS-Audience-Ids": "7", "ONBS-Paywall-Ids": "pw1,pw2" },
      })
    );
    const client = new OnboardingStudioClient("proj-1", {});

    const { data, headers } = await client.getPaywalls();

    expect(data).toEqual(catalog);
    expect(headers).toEqual({
      "ONBS-Audience-Ids": "7",
      "ONBS-Paywall-Ids": "pw1,pw2",
    });
    expect(headers).not.toHaveProperty("ONBS-Onboarding-Id");
    expect(headers).not.toHaveProperty("ONBS-Onboarding-Name");
  });

  it("surfaces a non-ok response as a rejection instead of resolving (no fallback)", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(null, { ok: false, status: 500, statusText: "Internal Server Error" })
    );
    const client = new OnboardingStudioClient("proj-1", {});

    await expect(client.getPaywalls()).rejects.toThrow(/500/);
  });

  it("surfaces a network failure as a rejection instead of resolving", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const client = new OnboardingStudioClient("proj-1", {});

    await expect(client.getPaywalls()).rejects.toThrow("network down");
  });
});

describe("getPaywallsCacheKey", () => {
  it("returns the default key when no custom key is given", () => {
    expect(getPaywallsCacheKey()).toBe(DEFAULT_PAYWALLS_CACHE_KEY);
    expect(DEFAULT_PAYWALLS_CACHE_KEY).toBe(CACHE_KEY);
  });

  it("namespaces a custom key, distinctly from the onboarding cache key", () => {
    expect(getPaywallsCacheKey(CUSTOM_KEY)).toBe(CUSTOM_CACHE_KEY);
    expect(getPaywallsCacheKey(CUSTOM_KEY)).not.toBe(getOnboardingCacheKey(CUSTOM_KEY));
    expect(DEFAULT_PAYWALLS_CACHE_KEY).not.toBe(DEFAULT_ONBOARDING_CACHE_KEY);
  });
});

// Fake client shape used by `getPaywallsQuery` — mirrors the fake used in
// `getOnboarding.query.test.ts`, swapping `getSteps` for `getPaywalls`.
const makeClient = (
  {
    isSandbox,
    cacheKey,
    data,
  }: { isSandbox: boolean; cacheKey?: string; data: PaywallCatalog }
) => {
  const getPaywalls = vi.fn().mockResolvedValue({
    data,
    headers: {
      "ONBS-Audience-Ids": "1",
      "ONBS-Paywall-Ids": Object.keys(data.paywalls).join(","),
    },
  });
  return {
    projectId: "p1",
    options: { isSandbox, baseUrl: undefined, cacheKey },
    getPaywalls,
  } as any;
};

const makeQueryClient = () => ({ setQueryData: vi.fn() }) as any;

const run = (client: any, queryClient = makeQueryClient()) =>
  (getPaywallsQuery(client, "en", {}, queryClient) as any).queryFn();

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("getPaywallsQuery", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    setItem.mockResolvedValue(undefined);
    removeItem.mockResolvedValue(undefined);
  });

  it("sandbox: always fetches, never touches the cache", async () => {
    const client = makeClient({ isSandbox: true, data: catalog });
    const data = await run(client);

    expect(client.getPaywalls).toHaveBeenCalledTimes(1);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(catalog));
    expect(data).toBe(catalog);
  });

  it("production cache miss: fetches and caches under the default key", async () => {
    getItem.mockResolvedValue(null);
    const client = makeClient({ isSandbox: false, data: catalog });
    const queryClient = makeQueryClient();

    const data = await run(client, queryClient);

    expect(client.getPaywalls).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(catalog));
    // A live (non-background) call also pushes through `setQueryData` — a
    // harmless overwrite with the exact value this call is about to return.
    expect(queryClient.setQueryData).toHaveBeenCalledWith(expect.anything(), catalog);
    expect(data).toBe(catalog);
  });

  it("production cache hit: returns cache immediately and revalidates in the background", async () => {
    const cached = { ...catalog, metadata: { ...catalog.metadata, locale: "cached" } };
    getItem.mockResolvedValue(JSON.stringify(cached));
    const client = makeClient({ isSandbox: false, data: catalog });
    const queryClient = makeQueryClient();

    const data = await run(client, queryClient);

    // Served from cache without blocking on the network — this call's own
    // return value is what becomes `data` for a live `useQuery`, with no
    // query-cache write needed for it.
    expect(data).toEqual(cached);

    // Background revalidation runs after the cache is returned, and pushes
    // the fresh payload into the query cache directly (Finding 1) — this is
    // the ONE case `useQuery`'s own `data` cannot cover on its own, since this
    // call is detached from the pending query invocation.
    await flush();
    expect(client.getPaywalls).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(catalog));
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
    expect(queryClient.setQueryData).toHaveBeenCalledWith(expect.anything(), catalog);
  });

  it("custom key, cache hit: serves cache and does NOT revalidate", async () => {
    const cached = { ...catalog, metadata: { ...catalog.metadata, locale: "cached" } };
    getItem.mockResolvedValue(JSON.stringify(cached));
    const client = makeClient({ isSandbox: false, cacheKey: CUSTOM_KEY, data: catalog });
    const queryClient = makeQueryClient();

    const data = await run(client, queryClient);

    expect(getItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY);
    expect(data).toEqual(cached);
    expect(queryClient.setQueryData).not.toHaveBeenCalled();

    // No background revalidation — the pinned version is never refetched.
    await flush();
    expect(client.getPaywalls).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(queryClient.setQueryData).not.toHaveBeenCalled();
  });

  it("custom key, cache miss: fetches once and persists under the namespaced key", async () => {
    getItem.mockResolvedValue(null);
    const client = makeClient({ isSandbox: false, cacheKey: CUSTOM_KEY, data: catalog });

    const data = await run(client);

    expect(getItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY);
    expect(client.getPaywalls).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY, JSON.stringify(catalog));
    expect(data).toBe(catalog);
  });

  it("cache-key namespace is distinct from the onboarding query's queryKey prefix", () => {
    const client = makeClient({ isSandbox: false, data: catalog });
    const { queryKey } = getPaywallsQuery(client, "en", {}) as any;

    expect(queryKey[0]).toBe("paywallCatalog");
    expect(queryKey[0]).not.toBe("onboardingQuestions");
  });

  it("a client error surfaces as a rejection on cache miss — it is not swallowed or cached", async () => {
    getItem.mockResolvedValue(null);
    const getPaywalls = vi.fn().mockRejectedValue(new Error("500 boom"));
    const client = {
      projectId: "p1",
      options: { isSandbox: false, baseUrl: undefined, cacheKey: undefined },
      getPaywalls,
    } as any;

    await expect(run(client)).rejects.toThrow("500 boom");
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("OnboardingStudioClient.clearCache", () => {
  beforeEach(() => removeItem.mockReset());

  it("removes both the default onboarding key and the default paywalls key", async () => {
    const client = new OnboardingStudioClient("p1", {});
    await client.clearCache();

    expect(removeItem).toHaveBeenCalledWith(DEFAULT_ONBOARDING_CACHE_KEY);
    expect(removeItem).toHaveBeenCalledWith(CACHE_KEY);
    expect(removeItem).toHaveBeenCalledTimes(2);
  });

  it("removes both namespaced keys when a custom key is configured", async () => {
    const client = new OnboardingStudioClient("p1", { cacheKey: CUSTOM_KEY });
    await client.clearCache();

    expect(removeItem).toHaveBeenCalledWith(`rocapine-onboarding-sdk-${CUSTOM_KEY}`);
    expect(removeItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY);
    expect(removeItem).toHaveBeenCalledTimes(2);
  });
});
