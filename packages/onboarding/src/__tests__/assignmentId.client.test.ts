import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
const disk = vi.hoisted(() => ({ data: {} as Record<string, string> }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.data[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      disk.data[k] = v;
    }),
    removeItem: vi.fn(async () => {}),
    getAllKeys: vi.fn(async () => []),
    multiRemove: vi.fn(async () => {}),
  },
}));

import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { ASSIGNMENT_ID_STORAGE_KEY, __resetInstallationIdForTests } from "../assignmentId";
import { isReservedUserPropertyKey } from "../userProperties/reserved";
import AsyncStorage from "@react-native-async-storage/async-storage";

const fakeResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => body,
  headers: { get: () => null },
});

const fetches = {
  getSteps: (c: OnboardingStudioClient, params?: Record<string, string>) =>
    c.getSteps({ locale: "en" }, params),
  getPaywalls: (c: OnboardingStudioClient, params?: Record<string, string>) =>
    c.getPaywalls({ locale: "en" }, params),
};

describe.each(Object.entries(fetches))("%s assignmentId", (_name, fetchWith) => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks(); // the AsyncStorage module mock keeps call history across tests
    disk.data = {};
    __resetInstallationIdForTests();
    fetchMock = vi.fn().mockResolvedValue(fakeResponse({ metadata: {}, steps: [], paywalls: {} }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sent = (i = 0) => new URL(fetchMock.mock.calls[i][0] as string).searchParams;

  it("sends a persisted installation id, the same one across launches", async () => {
    await fetchWith(new OnboardingStudioClient("proj-1", {}));
    const first = sent().get("assignmentId");
    expect(first).toBeTruthy();
    expect(disk.data[ASSIGNMENT_ID_STORAGE_KEY]).toBe(first);

    // Next launch: module memo gone, disk kept.
    __resetInstallationIdForTests();
    await fetchWith(new OnboardingStudioClient("proj-1", {}));
    expect(sent(1).get("assignmentId")).toBe(first);
  });

  it("sends it in sandbox (draft) requests too", async () => {
    await fetchWith(new OnboardingStudioClient("proj-1", { isSandbox: true }));
    expect(sent().get("draft")).toBe("true");
    expect(sent().get("assignmentId")).toBeTruthy();
  });

  it("a host override wins and is read on every request", async () => {
    let id = "anon-1";
    const client = new OnboardingStudioClient("proj-1", { assignmentId: () => id });
    await fetchWith(client);
    id = "user-42";
    await fetchWith(client);
    expect(sent(0).get("assignmentId")).toBe("anon-1");
    expect(sent(1).get("assignmentId")).toBe("user-42");
    expect(disk.data[ASSIGNMENT_ID_STORAGE_KEY]).toBeUndefined();
  });

  it("assignmentId: false sends nothing and never touches storage", async () => {
    const client = new OnboardingStudioClient("proj-1", { assignmentId: false });
    await fetchWith(client);
    expect(sent().has("assignmentId")).toBe(false);
    expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(ASSIGNMENT_ID_STORAGE_KEY);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(ASSIGNMENT_ID_STORAGE_KEY, expect.anything());
    expect(disk.data[ASSIGNMENT_ID_STORAGE_KEY]).toBeUndefined();
  });

  it("opting out drops a user param named assignmentId too", async () => {
    await fetchWith(new OnboardingStudioClient("proj-1", { assignmentId: () => false }), {
      assignmentId: "spoofed",
    });
    expect(sent().has("assignmentId")).toBe(false);
  });

  it("is absent when nothing stable is available (storage unreadable)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("disk"));
    await fetchWith(new OnboardingStudioClient("proj-1", {}));
    expect(sent().has("assignmentId")).toBe(false);
  });

  it("a user param named assignmentId never reaches the wire as the id", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("disk"));
    await fetchWith(new OnboardingStudioClient("proj-1", {}), { assignmentId: "spoofed" });
    expect(sent().getAll("assignmentId")).toEqual([]);

    await fetchWith(new OnboardingStudioClient("proj-1", { assignmentId: "host" }), {
      assignmentId: "spoofed",
    });
    expect(sent(1).getAll("assignmentId")).toEqual(["host"]);
  });
});

it("getSteps and getPaywalls fired together on a first launch send the same id", async () => {
  disk.data = {};
  __resetInstallationIdForTests();
  const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ metadata: {}, steps: [], paywalls: {} }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  const client = new OnboardingStudioClient("proj-1", {});
  await Promise.all([fetches.getSteps(client), fetches.getPaywalls(client)]);
  const ids = fetchMock.mock.calls.map((c) => new URL(c[0] as string).searchParams.get("assignmentId"));
  expect(ids[0]).toBeTruthy();
  expect(ids[1]).toBe(ids[0]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("assignmentId is a reserved user property key", () => {
  expect(isReservedUserPropertyKey("assignmentId")).toBe(true);
});

describe.each(Object.entries(fetches))("%s: fail closed and one timeout budget", (name, fetchWith) => {
  const fallbackOnboarding = { metadata: { id: "fb" }, steps: [], configuration: {} } as never;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    disk.data = {};
    __resetInstallationIdForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** fetch that answers after `ms`. */
  const slowFetch = (ms: number) => {
    fetchMock = vi.fn(
      () => new Promise((r) => setTimeout(() => r(fakeResponse({ metadata: {}, steps: [], paywalls: {} })), ms)),
    );
    vi.stubGlobal("fetch", fetchMock);
  };

  /** Settles the request, recording when (in fake ms) it did and how. */
  const settle = async (p: Promise<unknown>, budget: number) => {
    const out: { at?: number; value?: unknown; error?: unknown } = {};
    const start = Date.now();
    p.then(
      (value) => Object.assign(out, { at: Date.now() - start, value }),
      (error) => Object.assign(out, { at: Date.now() - start, error }),
    );
    await vi.advanceTimersByTimeAsync(budget);
    return out;
  };

  it("a getter that resolves false after 2.5s: nothing sent, nothing stored", async () => {
    slowFetch(0);
    const client = new OnboardingStudioClient("proj-1", {
      assignmentId: () => new Promise<false>((r) => setTimeout(() => r(false), 2500)),
    });
    const out = await settle(fetchWith(client), 3000);
    expect(out.error).toBeUndefined();
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.has("assignmentId")).toBe(false);
    expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(ASSIGNMENT_ID_STORAGE_KEY);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(ASSIGNMENT_ID_STORAGE_KEY, expect.anything());
    expect(disk.data[ASSIGNMENT_ID_STORAGE_KEY]).toBeUndefined();
  });

  it("options.timeout covers id resolution AND fetch: 800ms + 500ms against 1000ms times out at 1000ms", async () => {
    slowFetch(500);
    const client = new OnboardingStudioClient("proj-1", {
      timeout: 1000,
      fallbackOnboarding,
      assignmentId: () => new Promise<string>((r) => setTimeout(() => r("user-42"), 800)),
    });
    const out = await settle(fetchWith(client), 3000);
    expect(out.at).toBe(1000);
    if (name === "getSteps") {
      expect((out.value as { headers: Record<string, string> }).headers["ONBS-Onboarding-Id"]).toBe("fallback");
    } else {
      expect(String(out.error)).toMatch(/timeout/);
    }
  });

  it("a hanging getter does not delay fallbackOnboarding past options.timeout", async () => {
    slowFetch(0);
    const client = new OnboardingStudioClient("proj-1", {
      timeout: 500,
      fallbackOnboarding,
      assignmentId: () => new Promise<string>(() => {}),
    });
    const out = await settle(fetchWith(client), 3000);
    expect(out.at).toBe(500);
  });

  it("a request that timed out while resolving the id is never sent afterwards", async () => {
    slowFetch(0);
    const client = new OnboardingStudioClient("proj-1", {
      timeout: 500,
      fallbackOnboarding,
      assignmentId: () => new Promise<string>((r) => setTimeout(() => r("user-42"), 800)),
    });
    const out = await settle(fetchWith(client), 3000);
    expect(out.at).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("within budget the request succeeds: 300ms + 300ms against 1000ms", async () => {
    slowFetch(300);
    const client = new OnboardingStudioClient("proj-1", {
      timeout: 1000,
      fallbackOnboarding,
      assignmentId: () => new Promise<string>((r) => setTimeout(() => r("user-42"), 300)),
    });
    const out = await settle(fetchWith(client), 3000);
    expect(out.error).toBeUndefined();
    expect(out.at).toBe(600);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("assignmentId")).toBe("user-42");
  });
});
