// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { act, createContext, createElement, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * `PaywallStepRenderer`'s observer WIRING, through a real render (react-dom
 * under jsdom, `react-native` stubbed — the `PaywallProvider.observer.test.tsx`
 * harness). `usePaywallStepObservation.test.ts` covers the hook's lifecycle;
 * this file covers what only the renderer can get wrong (r1-3): the wrapped
 * `products.purchase`, `shown`, `advance` in `complete`, the skip effect's
 * `fail()` calls, and the inner `ErrorBoundary`. Reverting any one of them
 * fails a test here.
 *
 * Mocked, because they pull in native modules or every element renderer:
 * `react-native`, the headless package, the UI progress provider (safe-area),
 * the theme, the template (renders its children), `ScreenRenderer` (captures
 * its `host`, or throws on demand) and `ScreenElementsSchema` (an array parses).
 */

const h = vi.hoisted(() => ({
  paywallState: {} as Record<string, unknown>,
  observePresentation: undefined as unknown,
  host: null as any,
  rendered: [] as string[],
  focus: null as null | {
    useFocusEffect: (e: () => void | (() => void)) => void;
  },
}));

vi.mock("react-native", async () => {
  const { createElement: ce } = await import("react");
  const box = ({ children }: { children?: unknown }) => ce("div", null, children as any);
  return {
    View: box,
    ScrollView: box,
    Text: box,
    TouchableOpacity: box,
    ActivityIndicator: () => ce("progress"),
    StyleSheet: { create: <T,>(s: T) => s },
    Platform: { OS: "ios" },
  };
});

vi.mock("@rocapine/react-native-onboarding", async () => {
  const { createContext: cc } = await import("react");
  return {
    OnboardingProgressContext: cc({}),
    useOnboardingHeaderHeight: () => ({ headerHeight: 0 }),
    usePaywall: () => h.paywallState,
    usePaywallHost: () => ({ observePresentation: h.observePresentation }),
  };
});

vi.mock("../../../Provider/OnboardingProgressProvider", async () => {
  const { createContext: cc } = await import("react");
  return {
    OnboardingProgressContext: cc({ composableVariables: {}, setComposableVariable: () => {} }),
  };
});

vi.mock("../../../Theme/useTheme", () => ({
  useTheme: () => ({ theme: { colors: { neutral: { lowest: "#fff" } } } }),
}));

vi.mock("../../../Templates/OnboardingTemplate", () => ({
  OnboardingTemplate: ({ children }: { children?: unknown }) => children,
}));

vi.mock("../../../Runtime/types", () => ({
  ScreenElementsSchema: {
    safeParse: (x: unknown) =>
      Array.isArray(x) ? { success: true, data: x } : { success: false, error: new Error("bad elements") },
  },
}));

vi.mock("../../../Runtime/ScreenRenderer", () => ({
  ScreenRenderer: ({ elements, host }: { elements: Array<{ type: string }>; host: unknown }) => {
    if (elements[0]?.type === "Throws") throw new Error("element renderer bug");
    h.host = host;
    h.rendered.push(elements[0]?.type ?? "(none)");
    return null;
  },
}));

const { OnboardingProgressContext: HeadlessProgressContext } = await import("@rocapine/react-native-onboarding");
const { PaywallStepRenderer } = await import("../Renderer");

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const step = {
  id: "s1",
  type: "Paywall",
  name: "Paywall step",
  displayProgressHeader: true,
  payload: { moment: "m" },
  customPayload: null,
};

const paywall = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  moment: "m",
  elements: [{ type: `content-${id}` }],
  ...extra,
});

const recorder = () => {
  const calls: Array<[string, ...unknown[]]> = [];
  h.observePresentation = (p: { id: string }) => {
    calls.push(["start", p.id]);
    return {
      shown: () => void calls.push(["shown", p.id]),
      end: (result: unknown, key?: string | null) => void calls.push(["end", p.id, result, key ?? null]),
    };
  };
  return calls;
};

const setCatalog = (pw: ReturnType<typeof paywall> | null, customScreens?: Record<string, unknown>) => {
  h.paywallState = {
    catalog: pw ? { paywalls: { m: pw } } : { paywalls: {} },
    catalogStatus: "success",
    isProviderMounted: true,
    customScreens,
  };
};

/** A controllable focus effect: expo-router semantics (see the hook's test). */
const focusController = () => {
  let effect: (() => void | (() => void)) | null = null;
  let cleanup: void | (() => void);
  let focused = true;
  const runCleanup = () => {
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
  };
  return {
    useFocusEffect: (e: () => void | (() => void)) => {
      effect = e;
      useEffect(() => {
        if (focused) cleanup = e();
        return runCleanup;
      }, [e]);
    },
    blur: () =>
      act(async () => {
        focused = false;
        runCleanup();
      }),
    focus: () =>
      act(async () => {
        focused = true;
        cleanup = effect!();
      }),
  };
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const purchase = vi.fn(async (key: string) => ({ status: "purchased", productKey: key }) as const);
const onContinue = vi.fn();

const App = ({ nav }: { nav?: ReturnType<typeof focusController> }): ReactNode =>
  createElement(
    HeadlessProgressContext.Provider as any,
    {
      value: {
        setVariable: () => {},
        customActions: {},
        products: { purchase, restore: async () => ({ status: "restored" }) },
        navigation: nav ? { useFocusEffect: nav.useFocusEffect } : undefined,
      },
    },
    createElement(PaywallStepRenderer as any, { step, onContinue }),
  );

const render = async (nav?: ReturnType<typeof focusController>) => {
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(createElement(App, { nav })));
};

const unmount = async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
};

const quietly = async (fn: () => Promise<void>) => {
  const err = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = err;
  }
};

afterEach(async () => {
  await unmount();
  h.host = null;
  h.rendered = [];
  purchase.mockClear();
  onContinue.mockClear();
});

describe("PaywallStepRenderer — observer wiring (r1-3)", () => {
  it("reports start, shown, and end(purchased) with the slot key for a purchase that continues", async () => {
    const calls = recorder();
    setCatalog(paywall("pw-a"));
    await render();
    // The authored `{purchase, onSuccess:[continue]}`: the runtime awaits the
    // host's products, then completes with no status.
    await act(async () => {
      await h.host.products.purchase("annual");
      h.host.complete(undefined);
    });
    expect(purchase).toHaveBeenCalledWith("annual");
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
  });

  it("ends render-error through the inner ErrorBoundary when an element renderer throws", async () => {
    const calls = recorder();
    setCatalog(paywall("pw-a", { elements: [{ type: "Throws" }] }));
    await quietly(() => render());
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "render-error" }, null],
    ]);
  });

  it("ends parse-error and skips the step when the elements fail validation", async () => {
    const calls = recorder();
    setCatalog(paywall("pw-a", { elements: "not-an-array" }));
    await quietly(() => render());
    expect(onContinue).toHaveBeenCalled();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "parse-error" }, null],
    ]);
  });

  it("ends unknown-custom-screen and skips the step when the custom screen is not registered", async () => {
    const calls = recorder();
    setCatalog(paywall("pw-a", { renderMode: "custom", customScreenId: "missing", elements: [] }), {});
    await quietly(() => render());
    expect(onContinue).toHaveBeenCalled();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "unknown-custom-screen" }, null],
    ]);
  });
});

describe("PaywallStepRenderer — custom screen cancelled (r1-6)", () => {
  it("ends cancelled when a custom screen completes cancelled and the user then leaves", async () => {
    const calls = recorder();
    let complete: (o?: { status?: string }) => void = () => {};
    const Screen = (props: { complete: typeof complete }) => {
      complete = props.complete;
      return null;
    };
    setCatalog(paywall("pw-a", { renderMode: "custom", customScreenId: "s", elements: [] }), { s: Screen });
    await render();
    await act(async () => complete({ status: "cancelled" }));
    expect(onContinue).not.toHaveBeenCalled(); // the gate still holds
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "cancelled" }, null],
    ]);
  });
});

describe("PaywallStepRenderer — crash then variant swap (r1-4, r1-7)", () => {
  it("renders the new variant after a crash, and reports no impression for it", async () => {
    const calls = recorder();
    setCatalog(paywall("pw-a", { elements: [{ type: "Throws" }] }));
    await quietly(() => render());
    setCatalog(paywall("pw-b"));
    await quietly(() => render());
    // The boundary is keyed by paywall id (PaywallHost's precedent), so B renders.
    expect(h.rendered).toEqual(["content-pw-b"]);
    // One presentation per visit: A's ended with render-error, and a swap
    // neither restarts it nor reports B shown.
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "render-error" }, null],
    ]);
  });
});

describe("PaywallStepRenderer — re-entry through navigation focus (r1-5)", () => {
  it("reports a second presentation, with its purchase, when the advanced step is focused again", async () => {
    const calls = recorder();
    const nav = focusController();
    setCatalog(paywall("pw-a"));
    await render(nav);
    await act(async () => h.host.complete(undefined)); // a plain continue
    await nav.blur(); // the next step is pushed on top
    await nav.focus(); // back
    await act(async () => {
      await h.host.products.purchase("annual");
      h.host.complete(undefined);
    });
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "dismissed" }, null],
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
  });
});
