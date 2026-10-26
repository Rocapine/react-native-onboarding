import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";

// react-native is mocked so OnboardingStudioClient (which reads `Platform.OS`)
// loads under Node — same stub `getOnboarding.query.test.ts` uses.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

// AsyncStorage is mocked — the query reads/writes the paywall cache through it.
const { getItem, setItem, removeItem, getAllKeys, multiRemove } = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
  // `clearCache` scans by prefix now — the keys are scoped by a hash of the
  // resolved audience params, so it can no longer name them one by one.
  getAllKeys: vi.fn<() => Promise<string[]>>(),
  multiRemove: vi.fn<(keys: string[]) => Promise<void>>(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem, removeItem, getAllKeys, multiRemove },
}));

import { OnboardingStudioClient } from "../../OnboardingStudioClient";
import {
  getOnboardingCacheKey,
  DEFAULT_ONBOARDING_CACHE_KEY,
  getPaywallsCacheKey,
  DEFAULT_PAYWALLS_CACHE_KEY,
} from "../../infra/queries/cacheKey";
import { getPaywallsQuery } from "../getPaywalls.query";
import type { Paywall, PaywallCatalog } from "../types";

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
  beforeEach(() => {
    multiRemove.mockReset();
    multiRemove.mockResolvedValue(undefined);
    getAllKeys.mockReset();
  });

  it("clears both domains' default keys", async () => {
    getAllKeys.mockResolvedValue([DEFAULT_ONBOARDING_CACHE_KEY, CACHE_KEY]);
    const client = new OnboardingStudioClient("p1", {});
    await client.clearCache();

    expect(multiRemove).toHaveBeenCalledWith([DEFAULT_ONBOARDING_CACHE_KEY, CACHE_KEY]);
  });

  it("clears both namespaced keys when a custom key is configured", async () => {
    getAllKeys.mockResolvedValue([`rocapine-onboarding-sdk-${CUSTOM_KEY}`, CUSTOM_CACHE_KEY]);
    const client = new OnboardingStudioClient("p1", { cacheKey: CUSTOM_KEY });
    await client.clearCache();

    expect(multiRemove).toHaveBeenCalledWith([
      `rocapine-onboarding-sdk-${CUSTOM_KEY}`,
      CUSTOM_CACHE_KEY,
    ]);
  });

  it("clears a params-scoped paywall key it could not have named in advance", async () => {
    const scoped = `${CACHE_KEY}-1b9a2624`;
    getAllKeys.mockResolvedValue([scoped]);
    const client = new OnboardingStudioClient("p1", {});
    await client.clearCache();

    expect(multiRemove).toHaveBeenCalledWith([scoped]);
  });
});

describe("getPaywallsQuery cache key and request identity", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
  });

  // The SDK's own identity is sent on the request but must NOT enter the cache
  // key: a key that changed with every app update would leave a returning user
  // who is offline right after updating with no cached catalog, and would stop a
  // custom `cacheKey` from pinning content across updates.
  const withIdentity = (client: any, identity: Record<string, string>) => {
    client.identityParams = () => identity;
    return client;
  };

  it("same cache key across builds when only the SDK-derived identity changes", async () => {
    await run(withIdentity(makeClient({ isSandbox: false, data: catalog }), { appVersion: "2.3.0", build: "45", sdkVersion: "1.77.0", environment: "production" }));
    await run(withIdentity(makeClient({ isSandbox: false, data: catalog }), { appVersion: "2.4.0", build: "46", sdkVersion: "1.78.0", environment: "production" }));
    const keys = setItem.mock.calls.map(([key]) => key);
    expect(keys).toEqual([CACHE_KEY, CACHE_KEY]);
  });

  it("custom cacheKey is unaffected by identity", async () => {
    await run(withIdentity(makeClient({ isSandbox: false, cacheKey: CUSTOM_KEY, data: catalog }), { appVersion: "2.3.0", build: "45", sdkVersion: "1.77.0", environment: "production" }));
    expect(setItem).toHaveBeenCalledWith(CUSTOM_CACHE_KEY, JSON.stringify(catalog));
  });
});

// #235: each resolved paywall carries its own experiment identity, PER MOMENT
// (like `audienceId`). The values are the server's; the SDK passes them through
// untouched — `null` stays `null`, and a field an older `get-paywalls` never
// sent stays absent.
describe("Paywall experiment identity (experimentId / variantKey / deploymentId)", () => {
  const base = {
    name: "pw",
    audienceId: 1,
    audienceName: "default",
    elements: [],
    billing: "store" as const,
    products: [],
    configuration: null,
  };
  const twoArms: PaywallCatalog = {
    metadata: { locale: "en", draft: false },
    paywalls: {
      onboarding_end: {
        ...base,
        id: "pw-a",
        moment: "onboarding_end",
        experimentId: "exp-1",
        variantKey: "b",
        deploymentId: 42,
      },
      settings_upgrade: {
        ...base,
        id: "pw-b",
        moment: "settings_upgrade",
        experimentId: null,
        variantKey: null,
        deploymentId: 7,
      },
      // An older `get-paywalls` that predates the fields.
      legacy: { ...base, id: "pw-c", moment: "legacy" },
    },
    fonts: null,
  };

  const expectArms = (data: PaywallCatalog) => {
    const { onboarding_end, settings_upgrade, legacy } = data.paywalls;
    expect([onboarding_end.experimentId, onboarding_end.variantKey, onboarding_end.deploymentId]).toEqual(["exp-1", "b", 42]);
    expect([settings_upgrade.experimentId, settings_upgrade.variantKey, settings_upgrade.deploymentId]).toEqual([null, null, 7]);
    expect([legacy.experimentId, legacy.variantKey, legacy.deploymentId]).toEqual([undefined, undefined, undefined]);
  };

  it("is declared on the resolved Paywall type, optional and nullable", () => {
    expectTypeOf<Paywall["experimentId"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Paywall["variantKey"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Paywall["deploymentId"]>().toEqualTypeOf<number | null | undefined>();
  });

  it("getPaywalls passes each moment's own values through, absent stays undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(JSON.parse(JSON.stringify(twoArms))));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { data } = await new OnboardingStudioClient("proj-1", {}).getPaywalls();
      expectArms(data);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("survives the production cache round-trip (served from AsyncStorage)", async () => {
    getItem.mockReset();
    setItem.mockReset();
    setItem.mockResolvedValue(undefined);
    getItem.mockResolvedValue(JSON.stringify(twoArms));
    const data = await run(makeClient({ isSandbox: false, cacheKey: CUSTOM_KEY, data: catalog }));
    expectArms(data);
  });
});
