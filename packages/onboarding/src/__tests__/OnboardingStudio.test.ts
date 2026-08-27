import { describe, it, expect, vi, beforeEach } from "vitest";

// `OnboardingStudioClient` reads `Platform.OS`; stub it so the class loads under
// Node — the same stub the other client-touching suites use.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
// `userProperties/store.ts` constructs the real singleton at module scope from
// AsyncStorage. The facade under test is built over an INJECTED store, so this
// mock only has to let the import resolve.
const { getItem, setItem, removeItem } = vi.hoisted(() => ({
  getItem: vi.fn(async () => null),
  setItem: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem, removeItem },
}));

import {
  createOnboardingStudio,
  resolveProviderClient,
  MISSING_CLIENT_MESSAGE,
} from "../OnboardingStudio";
import { createUserPropertyStore } from "../userProperties/store";
import { OnboardingStudioClient } from "../OnboardingStudioClient";

const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn(async (k: string) => map.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void map.set(k, v)),
    removeItem: vi.fn(async (k: string) => void map.delete(k)),
  };
};

/** A fresh facade over a fresh store, so no test can leak into another. */
const makeStudio = () => {
  const storage = makeStorage();
  const store = createUserPropertyStore(storage);
  return { studio: createOnboardingStudio(store), store, storage };
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("OnboardingStudio.init", () => {
  it("is not initialized before init", () => {
    const { studio } = makeStudio();
    expect(studio.isInitialized()).toBe(false);
    expect(studio.getClient()).toBeNull();
  });

  it("builds a client from the config and returns it", () => {
    const { studio } = makeStudio();
    const client = studio.init({ projectId: "abc", appVersion: "1.0.0" });

    expect(client).toBeInstanceOf(OnboardingStudioClient);
    expect(client.projectId).toBe("abc");
    expect(client.options.appVersion).toBe("1.0.0");
    expect(studio.isInitialized()).toBe(true);
    expect(studio.getClient()).toBe(client);
  });

  it("does not leak `userProperties` into the client options", () => {
    const { studio } = makeStudio();
    const client = studio.init({ projectId: "abc", userProperties: { plan: "free" } });
    expect("userProperties" in client.options).toBe(false);
  });

  it("seeds initial user properties, so targeting is right on a first-ever launch", () => {
    const { studio } = makeStudio();
    studio.init({ projectId: "abc", userProperties: { plan: "free", days: 3 } });
    expect(studio.getUserProperties()).toEqual({ plan: "free", days: 3 });
  });

  it("is a silent no-op when called twice with the same config", () => {
    const { studio } = makeStudio();
    const first = studio.init({ projectId: "abc", appVersion: "1.0.0" });
    const second = studio.init({ projectId: "abc", appVersion: "1.0.0" });

    // Same client instance: Fast Refresh re-running module scope must not
    // rebuild the client and orphan the one the providers already hold.
    expect(second).toBe(first);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("replaces the client and warns when called again with a different config", () => {
    const { studio } = makeStudio();
    const first = studio.init({ projectId: "abc" });
    const second = studio.init({ projectId: "different" });

    expect(second).not.toBe(first);
    expect(studio.getClient()).toBe(second);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("different"));
  });

  it("starts hydrating persisted properties without waiting for a provider", () => {
    const { studio, storage } = makeStudio();
    studio.init({ projectId: "abc" });
    expect(storage.getItem).toHaveBeenCalled();
  });

  it("lets an init-time property win over a persisted one", async () => {
    const storage = makeStorage();
    await storage.setItem("rocapine-user-properties", JSON.stringify({ plan: "pro", days: 9 }));
    const store = createUserPropertyStore(storage);
    const studio = createOnboardingStudio(store);

    studio.init({ projectId: "abc", userProperties: { plan: "free" } });
    await store.ensureHydrated();

    // The host's current knowledge beats last launch's; disk fills the gap.
    expect(studio.getUserProperties()).toEqual({ plan: "free", days: 9 });
  });
});

describe("OnboardingStudio user properties", () => {
  it("sets a single property", () => {
    const { studio } = makeStudio();
    studio.setUserProperty("plan", "free");
    expect(studio.getUserProperties()).toEqual({ plan: "free" });
  });

  it("deletes a property when the value is null", () => {
    const { studio } = makeStudio();
    studio.setUserProperty("plan", "free");
    studio.setUserProperty("plan", null);
    expect(studio.getUserProperties()).toEqual({});
  });

  it("merges a batch rather than replacing", () => {
    const { studio } = makeStudio();
    studio.setUserProperty("plan", "free");
    studio.setUserProperties({ days: 3 });
    expect(studio.getUserProperties()).toEqual({ plan: "free", days: 3 });
  });

  it("removes a property by name", () => {
    const { studio } = makeStudio();
    studio.setUserProperties({ plan: "free", days: 3 });
    studio.removeUserProperty("plan");
    expect(studio.getUserProperties()).toEqual({ days: 3 });
  });

  it("refuses a reserved name and warns", () => {
    const { studio } = makeStudio();
    studio.setUserProperty("projectId", "sneaky");
    expect(studio.getUserProperties()).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("projectId"));
  });

  it("works before init — properties are not gated on configuration", () => {
    const { studio } = makeStudio();
    studio.setUserProperty("plan", "free");
    expect(studio.getUserProperties()).toEqual({ plan: "free" });
    expect(studio.isInitialized()).toBe(false);
  });
});

describe("OnboardingStudio.reset", () => {
  it("clears user properties", () => {
    const { studio } = makeStudio();
    studio.setUserProperties({ plan: "free", days: 3 });
    studio.reset();
    expect(studio.getUserProperties()).toEqual({});
  });

  it("keeps the client — reset forgets the user, not the configuration", () => {
    const { studio } = makeStudio();
    const client = studio.init({ projectId: "abc" });
    studio.reset();
    expect(studio.getClient()).toBe(client);
    expect(studio.isInitialized()).toBe(true);
  });

  it("does not clear the payload cache", () => {
    // Logging out should forget who you are, not force a refetch of content that
    // has not changed. `getClient()?.clearCache()` is there if both are wanted.
    const { studio } = makeStudio();
    const client = studio.init({ projectId: "abc" });
    const clearCache = vi.spyOn(client, "clearCache");
    studio.reset();
    expect(clearCache).not.toHaveBeenCalled();
  });
});

describe("resolveProviderClient", () => {
  const a = new OnboardingStudioClient("prop", {});
  const b = new OnboardingStudioClient("studio", {});

  it("prefers the prop, so an existing host is unaffected", () => {
    expect(resolveProviderClient(a, b)).toBe(a);
  });

  it("falls back to the studio's client", () => {
    expect(resolveProviderClient(undefined, b)).toBe(b);
  });

  it("is null when neither exists", () => {
    expect(resolveProviderClient(undefined, null)).toBeNull();
  });

  it("names both fixes in the missing-client message", () => {
    expect(MISSING_CLIENT_MESSAGE).toContain("OnboardingStudio.init");
    expect(MISSING_CLIENT_MESSAGE).toContain("client");
  });
});
