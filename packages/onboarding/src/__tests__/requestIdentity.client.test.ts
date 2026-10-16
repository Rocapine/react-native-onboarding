import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
    getAllKeys: vi.fn(async () => []),
    multiRemove: vi.fn(async () => {}),
  },
}));
// The client reads expo-application through `readNativeAppInfo`; replace only
// that export so each test chooses what the device reports.
const native = vi.hoisted(() => ({ info: {} as { appVersion?: string; build?: string } }));
vi.mock("../requestIdentity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../requestIdentity")>()),
  readNativeAppInfo: () => native.info,
}));

import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { SDK_VERSION } from "../version";

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

describe.each(Object.entries(fetches))("%s request identity", (_name, fetchWith) => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    native.info = {};
    fetchMock = vi.fn().mockResolvedValue(fakeResponse({ metadata: {}, steps: [], paywalls: {} }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sent = () => new URL(fetchMock.mock.calls[0][0] as string).searchParams;

  it("sends appVersion and build from expo-application, plus sdkVersion and environment", async () => {
    native.info = { appVersion: "2.3.0", build: "45" };
    await fetchWith(new OnboardingStudioClient("proj-1", {}));
    expect(sent().get("appVersion")).toBe("2.3.0");
    expect(sent().get("build")).toBe("45");
    expect(sent().get("sdkVersion")).toBe(SDK_VERSION);
    expect(sent().get("environment")).toBe("production");
  });

  it("host appVersion and build win over expo-application", async () => {
    native.info = { appVersion: "2.3.0", build: "45" };
    await fetchWith(new OnboardingStudioClient("proj-1", { appVersion: "3.0.0", build: "300" }));
    expect(sent().get("appVersion")).toBe("3.0.0");
    expect(sent().get("build")).toBe("300");
  });

  it("omits appVersion and build when neither source has them", async () => {
    await fetchWith(new OnboardingStudioClient("proj-1", {}));
    expect(sent().has("appVersion")).toBe(false);
    expect(sent().has("build")).toBe(false);
    expect(sent().get("sdkVersion")).toBe(SDK_VERSION);
  });

  it("environment: sandbox in sandbox mode, normalized when the host sets it", async () => {
    await fetchWith(new OnboardingStudioClient("proj-1", { isSandbox: true }));
    expect(sent().get("environment")).toBe("sandbox");
    fetchMock.mockClear();
    await fetchWith(new OnboardingStudioClient("proj-1", { environment: "Staging Env!" }));
    expect(sent().get("environment")).toBe("stagingenv");
  });

  it("SDK-owned keys replace a same-named user param (the server reads the first occurrence)", async () => {
    native.info = { appVersion: "2.3.0", build: "45" };
    await fetchWith(new OnboardingStudioClient("proj-1", {}), {
      build: "from-user",
      environment: "from-user",
      sdkVersion: "from-user",
      projectId: "other",
      plan: "pro",
    });
    expect(sent().getAll("build")).toEqual(["45"]);
    expect(sent().getAll("environment")).toEqual(["production"]);
    expect(sent().getAll("sdkVersion")).toEqual([SDK_VERSION]);
    expect(sent().getAll("projectId")).toEqual(["proj-1"]);
    expect(sent().get("plan")).toBe("pro");
  });

  it("a user appVersion or build never reaches the wire, even when the SDK has none to send", async () => {
    // A property persisted before these names were reserved is re-read from
    // disk without a reserved-key check, so it can still arrive here.
    await fetchWith(new OnboardingStudioClient("proj-1", {}), {
      appVersion: "from-user",
      build: "from-user",
      plan: "pro",
    });
    expect(sent().has("appVersion")).toBe(false);
    expect(sent().has("build")).toBe(false);
    expect(sent().get("plan")).toBe("pro");
  });
});
