import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";

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

import { OnboardingStudioClient } from "../OnboardingStudioClient";
import type { OnboardingMetadata } from "../types";

const fakeResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => body,
  headers: { get: () => null },
});

const getMetadata = async (metadata: Record<string, unknown>) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ metadata, steps: [] })));
  const { data } = await new OnboardingStudioClient("proj-1", {}).getSteps({ locale: "en" });
  return data.metadata;
};

describe("OnboardingMetadata experiment and deployment identity", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("types the three fields as optional, deploymentId nullable", () => {
    expectTypeOf<OnboardingMetadata["experimentId"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<OnboardingMetadata["variantKey"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<OnboardingMetadata["deploymentId"]>().toEqualTypeOf<number | null | undefined>();
  });

  it("surfaces experimentId, variantKey and deploymentId from the payload through getSteps", async () => {
    const metadata = await getMetadata({
      id: "onb-1",
      experimentId: "exp-1",
      variantKey: "b",
      deploymentId: 42,
    });
    expect(metadata.experimentId).toBe("exp-1");
    expect(metadata.variantKey).toBe("b");
    expect(metadata.deploymentId).toBe(42);
  });

  it("keeps a draft's null deploymentId null", async () => {
    const metadata = await getMetadata({ id: "onb-1", draft: true, deploymentId: null });
    expect(metadata.deploymentId).toBeNull();
  });

  it("reads the fields as undefined on a payload that does not carry them", async () => {
    const metadata = await getMetadata({ id: "onb-1", audienceId: "7" });
    expect(metadata.experimentId).toBeUndefined();
    expect(metadata.variantKey).toBeUndefined();
    expect(metadata.deploymentId).toBeUndefined();
  });
});
