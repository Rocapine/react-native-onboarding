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
