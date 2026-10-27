// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CustomPaywallScreenProps } from "@rocapine/react-native-onboarding";

/**
 * The REAL `PaywallHost`: a custom screen's `complete({ transaction })` reaches
 * the provider's bound `complete` as its second argument (#287), and nothing
 * else does. Same mocks as `PaywallHost.acknowledgement.test.ts`, plus a
 * `ScreenRenderer` that exposes the elements path's `ScreenHost`.
 */

const h = vi.hoisted(() => ({
  host: null as any,
  screenHost: null as any,
  screenProps: null as any,
}));

vi.mock("react-native", async () => {
  const { createElement: ce } = await import("react");
  const box = ({ children }: { children?: unknown }) => ce("div", null, children as any);
  return {
    View: box,
    ScrollView: box,
    Text: box,
    StyleSheet: { create: <T,>(s: T) => s },
    Platform: { OS: "ios" },
    Modal: (props: { visible: boolean; children?: unknown }) =>
      props.visible ? ce("div", null, props.children as any) : null,
  };
});
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children?: unknown }) => children,
}));
vi.mock("@rocapine/react-native-onboarding", () => ({
  usePaywallHost: () => h.host,
  usePaywall: () => ({ present: async () => ({ status: "dismissed" }) }),
  useProductRuntime: () => null,
}));
vi.mock("../../Theme/useTheme", () => ({
  useTheme: () => ({ theme: { colors: { neutral: { lowest: "#fff" } } } }),
}));
vi.mock("../../Runtime/types", () => ({
  ScreenElementsSchema: {
    safeParse: (x: unknown) =>
      Array.isArray(x) ? { success: true, data: x } : { success: false, error: new Error("bad elements") },
  },
}));
vi.mock("../../Runtime/ScreenRenderer", () => ({
  ScreenRenderer: (props: { host: unknown }) => {
    h.screenHost = props.host;
    return null;
  },
}));

const { PaywallHost } = await import("../PaywallHost");

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  h.screenHost = null;
  h.screenProps = null;
  vi.restoreAllMocks();
});

const Screen = (props: CustomPaywallScreenProps) => {
  h.screenProps = props;
  return null;
};

const TX = { originalTransactionIdentifier: "2000000123", productId: "com.app.annual.ios" };

const show = async (pw: Record<string, unknown>) => {
  const completed: unknown[][] = [];
  h.host = {
    activePaywall: pw,
    complete: (...args: unknown[]) => void completed.push(args),
    acknowledgePresentation: () => {},
    customActions: {},
    customScreens: { native: Screen },
  };
  root = createRoot(document.createElement("div"));
  await act(async () => root!.render(createElement(PaywallHost)));
  return completed;
};

const custom = { id: "pw", name: "pw", moment: "upgrade", elements: [], renderMode: "custom", customScreenId: "native", customPayload: {} };

describe("PaywallHost: a custom screen's transaction (#287)", () => {
  it("forwards complete({ status, transaction }) to the provider's complete as its second argument", async () => {
    const completed = await show(custom);
    await act(async () => h.screenProps.complete({ status: "purchased", transaction: TX }));
    expect(completed).toEqual([[{ status: "purchased" }, TX]]);
  });

  it("passes no transaction when the screen passes none, exactly as before", async () => {
    const completed = await show(custom);
    await act(async () => {
      h.screenProps.complete({ status: "purchased" });
      h.screenProps.complete();
    });
    expect(completed.map((args) => args[0])).toEqual([{ status: "purchased" }, { status: "dismissed" }]);
    expect(completed.map((args) => args[1])).toEqual([undefined, undefined]);
  });

  it("never forwards one from the elements path's ScreenHost.complete", async () => {
    const completed = await show({ id: "pw", name: "pw", moment: "upgrade", elements: [] });
    await act(async () => h.screenHost.complete({ status: "purchased", transaction: TX }));
    expect(completed.map((args) => args[1])).toEqual([undefined]);
  });

  it("still resolves when reading the transaction throws, and passes none", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const completed = await show(custom);
    const outcome = Object.defineProperty({ status: "purchased" }, "transaction", {
      get() {
        throw new Error("getter bug");
      },
    });
    await act(async () => h.screenProps.complete(outcome));
    expect(completed).toEqual([[{ status: "purchased" }, undefined]]);
  });

  it("leaves a non-purchased transaction to the provider, which drops and warns only for a live call", async () => {
    // The bound `complete` ignores a stale call silently, so warning here would
    // warn for calls that change nothing (round 3).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const completed = await show(custom);
    await act(async () => h.screenProps.complete({ status: "cancelled", transaction: TX }));
    expect(completed).toEqual([[{ status: "cancelled" }, TX]]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("PaywallHost: a custom screen sees the moment's variant identity (#235)", () => {
  it("passes variantKey and deploymentId through on the paywall prop", async () => {
    await show({ ...custom, variantKey: "b", deploymentId: 42 });
    expect(h.screenProps.paywall).toEqual({
      id: "pw",
      name: "pw",
      moment: "upgrade",
      customScreenId: "native",
      variantKey: "b",
      deploymentId: 42,
    });
  });

  it("passes null through as null, and leaves them undefined when the catalog has none", async () => {
    await show({ ...custom, variantKey: null, deploymentId: null });
    expect([h.screenProps.paywall.variantKey, h.screenProps.paywall.deploymentId]).toEqual([null, null]);
    await act(async () => root!.unmount());
    root = null;
    await show(custom);
    expect([h.screenProps.paywall.variantKey, h.screenProps.paywall.deploymentId]).toEqual([undefined, undefined]);
  });
});
