import { describe, it, expect, vi, afterEach } from "vitest";
import {
  setPaywallDevHook,
  notifyPaywallShown,
  hasPaywallDevHook,
  type PaywallShownInfo,
} from "../devHook";

const info: PaywallShownInfo = {
  paywallId: "p1",
  paywallName: "Spring sale",
  renderMode: "elements",
  customScreenId: null,
  platform: "ios",
  appVersion: "1.0.0",
  sdkVersion: "1.78.0",
  projectId: "proj",
  functionsBaseUrl: "https://example.test/functions/v1",
  viewRef: { current: null },
};

afterEach(() => {
  setPaywallDevHook(null);
  vi.restoreAllMocks();
});

describe("paywall dev hook", () => {
  it("notifyPaywallShown without a hook is a no-op", () => {
    expect(hasPaywallDevHook()).toBe(false);
    expect(() => notifyPaywallShown(info)).not.toThrow();
  });

  it("calls the registered hook with the info", () => {
    const hook = vi.fn();
    setPaywallDevHook(hook);
    expect(hasPaywallDevHook()).toBe(true);
    notifyPaywallShown(info);
    expect(hook).toHaveBeenCalledWith(info);
  });

  it("a throwing hook is swallowed and warned", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setPaywallDevHook(() => {
      throw new Error("boom");
    });
    expect(() => notifyPaywallShown(info)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Spring sale");
  });

  it("setPaywallDevHook(null) unregisters", () => {
    const hook = vi.fn();
    setPaywallDevHook(hook);
    setPaywallDevHook(null);
    expect(hasPaywallDevHook()).toBe(false);
    notifyPaywallShown(info);
    expect(hook).not.toHaveBeenCalled();
  });
});
