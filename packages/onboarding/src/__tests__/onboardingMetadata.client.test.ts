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

describe("OnboardingMetadata variant and deployment identity", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("types variantKey and deploymentId as optional and nullable, with no experimentId", () => {
    expectTypeOf<OnboardingMetadata["variantKey"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<OnboardingMetadata["deploymentId"]>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<OnboardingMetadata>().not.toHaveProperty("experimentId");
  });

  it("surfaces variantKey and deploymentId from the payload through getSteps", async () => {
    const metadata = await getMetadata({ id: "onb-1", variantKey: "b", deploymentId: 42 });
    expect(metadata.variantKey).toBe("b");
    expect(metadata.deploymentId).toBe(42);
  });

  it("passes the reserved main variantKey through unchanged", async () => {
    const metadata = await getMetadata({ id: "onb-1", variantKey: "main", deploymentId: 7 });
    expect(metadata.variantKey).toBe("main");
  });

  it("keeps null variantKey and deploymentId null", async () => {
    const metadata = await getMetadata({ id: "onb-1", draft: true, variantKey: null, deploymentId: null });
    expect(metadata.variantKey).toBeNull();
    expect(metadata.deploymentId).toBeNull();
  });

  it("reads the fields as undefined on a payload that does not carry them", async () => {
    const metadata = await getMetadata({ id: "onb-1", audienceId: "7" });
    expect(metadata.variantKey).toBeUndefined();
    expect(metadata.deploymentId).toBeUndefined();
  });
});
