// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The real hook against a fake dev-hook registry: the headless package is
 * mocked so the test controls whether a hook is registered and records every
 * `notifyPaywallShown` call.
 */

const h = vi.hoisted(() => ({
  registered: true,
  calls: [] as any[],
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@rocapine/react-native-onboarding", () => ({
  SDK_VERSION: "9.9.9",
  hasPaywallDevHook: () => h.registered,
  notifyPaywallShown: (info: unknown) => void h.calls.push(info),
}));

const { usePaywallShownNotifier } = await import("../usePaywallShownNotifier");

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const client = {
  projectId: "proj",
  functionsBaseUrl: "https://example.test/functions/v1",
  identityParams: () => ({ appVersion: "2.3.4", sdkVersion: "9.9.9" }),
} as any;

const paywall = (id: string) => ({
  id,
  name: `Paywall ${id}`,
  renderMode: "elements" as const,
  customScreenId: null,
});

let root: Root | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  h.registered = true;
  h.calls = [];
});

const Probe = (props: Parameters<typeof usePaywallShownNotifier>[0]) => {
  usePaywallShownNotifier(props);
  return null;
};

const commit = async (props: Parameters<typeof usePaywallShownNotifier>[0]) => {
  if (!root) root = createRoot(document.createElement("div"));
  await act(async () => root!.render(createElement(Probe, props)));
};

describe("usePaywallShownNotifier", () => {
  it("fires once when shown becomes true", async () => {
    await commit({ shown: false, paywall: paywall("p1"), client });
    expect(h.calls).toEqual([]);
    await commit({ shown: true, paywall: paywall("p1"), client });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      paywallId: "p1",
      paywallName: "Paywall p1",
      renderMode: "elements",
      customScreenId: null,
      platform: "ios",
      appVersion: "2.3.4",
      sdkVersion: "9.9.9",
      projectId: "proj",
      functionsBaseUrl: "https://example.test/functions/v1",
    });
    expect(h.calls[0].viewRef).toHaveProperty("current");
  });

  it("fires again for a new paywall id while still shown", async () => {
    await commit({ shown: true, paywall: paywall("p1"), client });
    await commit({ shown: true, paywall: paywall("p2"), client });
    expect(h.calls.map((c) => c.paywallId)).toEqual(["p1", "p2"]);
  });

  it("does not refire on re-render with the same id", async () => {
    await commit({ shown: true, paywall: paywall("p1"), client });
    await commit({ shown: true, paywall: paywall("p1"), client });
    await commit({ shown: true, paywall: { ...paywall("p1") }, client });
    expect(h.calls).toHaveLength(1);
  });

  it("fires again for the same id after it was hidden and shown again", async () => {
    await commit({ shown: true, paywall: paywall("p1"), client });
    await commit({ shown: false, paywall: paywall("p1"), client });
    await commit({ shown: true, paywall: paywall("p1"), client });
    expect(h.calls).toHaveLength(2);
  });

  it("does nothing when no dev hook is registered", async () => {
    h.registered = false;
    const identityParams = vi.fn(() => ({}));
    await commit({ shown: true, paywall: paywall("p1"), client: { ...client, identityParams } });
    expect(h.calls).toEqual([]);
    expect(identityParams).not.toHaveBeenCalled();
  });

  it("reports a null appVersion when the client has none", async () => {
    await commit({
      shown: true,
      paywall: paywall("p1"),
      client: { ...client, identityParams: () => ({ sdkVersion: "9.9.9" }) },
    });
    expect(h.calls[0].appVersion).toBeNull();
  });

  it("does nothing without a client, and never throws when building the info fails", async () => {
    await commit({ shown: true, paywall: paywall("p1"), client: null });
    expect(h.calls).toEqual([]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = {
      ...client,
      identityParams: () => {
        throw new Error("native module missing");
      },
    };
    await commit({ shown: true, paywall: paywall("p2"), client: broken });
    expect(h.calls).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
