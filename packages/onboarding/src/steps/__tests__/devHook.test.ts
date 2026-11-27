import { describe, it, expect, vi, afterEach } from "vitest";
import {
  setStepDevHook,
  notifyStepShown,
  hasStepDevHook,
  type StepShownInfo,
} from "../devHook";

const info: StepShownInfo = {
  onboardingId: "ob1",
  stepId: "s1",
  stepName: "Goal picker",
  customScreenId: "goal",
  locale: "en",
  draft: false,
  platform: "ios",
  appVersion: "1.0.0",
  sdkVersion: "1.78.0",
  projectId: "proj",
  functionsBaseUrl: "https://example.test/functions/v1",
  viewRef: { current: null },
  isActive: () => true,
};

afterEach(() => {
  setStepDevHook(null);
  vi.restoreAllMocks();
});

describe("step dev hook", () => {
  it("notifyStepShown without a hook is a no-op", () => {
    expect(hasStepDevHook()).toBe(false);
    expect(() => notifyStepShown(info)).not.toThrow();
  });

  it("calls the registered hook with the exact info object", () => {
    const hook = vi.fn();
    setStepDevHook(hook);
    expect(hasStepDevHook()).toBe(true);
    notifyStepShown(info);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0]).toBe(info);
  });

  it("a throwing hook is swallowed and warned", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setStepDevHook(() => {
      throw new Error("boom");
    });
    expect(() => notifyStepShown(info)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Goal picker");
  });

  it("setStepDevHook(null) unregisters", () => {
    const hook = vi.fn();
    setStepDevHook(hook);
    setStepDevHook(null);
    expect(hasStepDevHook()).toBe(false);
    notifyStepShown(info);
    expect(hook).not.toHaveBeenCalled();
  });

  it("an async hook that rejects is warned, not left unhandled", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setStepDevHook(async () => {
      throw new Error("async boom");
    });
    expect(() => notifyStepShown(info)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Goal picker");
  });
});
