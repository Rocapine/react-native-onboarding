import { describe, it, expect } from "vitest";
import { buildStepShownInfo } from "../stepShownInfo";
import { SDK_VERSION } from "../../version";

const client = {
  projectId: "proj-1",
  functionsBaseUrl: "https://f.example/functions/v1",
  identityParams: () => ({ appVersion: "2.3.4" }),
} as any;
const isActive = () => true;
const base = {
  step: { id: "s1", name: "Welcome", type: "CustomScreen", payload: { customScreenId: "welcome" } },
  metadata: { id: "ob1", locale: "fr" },
  client,
  platform: "ios",
  viewRef: null,
  isActive,
};

describe("buildStepShownInfo", () => {
  it("describes a custom screen", () => {
    expect(buildStepShownInfo(base)).toEqual({
      onboardingId: "ob1",
      stepId: "s1",
      stepName: "Welcome",
      customScreenId: "welcome",
      locale: "fr",
      draft: false,
      platform: "ios",
      appVersion: "2.3.4",
      sdkVersion: SDK_VERSION,
      projectId: "proj-1",
      functionsBaseUrl: "https://f.example/functions/v1",
      viewRef: null,
      isActive,
    });
  });
  it("defaults locale to null and keeps draft", () => {
    const i = buildStepShownInfo({ ...base, metadata: { id: "ob1", draft: true } });
    expect(i?.locale).toBeNull();
    expect(i?.draft).toBe(true);
  });
  it("returns null for non-custom steps", () => {
    expect(buildStepShownInfo({ ...base, step: { ...base.step, type: "Question" } })).toBeNull();
  });
  it.each([undefined, "", 5])("returns null for customScreenId %p", (v) => {
    expect(
      buildStepShownInfo({ ...base, step: { ...base.step, payload: { customScreenId: v } } })
    ).toBeNull();
  });
  it("returns null without a payload", () => {
    expect(buildStepShownInfo({ ...base, step: { id: "s", type: "CustomScreen" } })).toBeNull();
  });
  it("returns null on web", () => {
    expect(buildStepShownInfo({ ...base, platform: "web" })).toBeNull();
  });
  it("passes isActive through by identity", () => {
    expect(buildStepShownInfo(base)?.isActive).toBe(isActive);
  });
});
