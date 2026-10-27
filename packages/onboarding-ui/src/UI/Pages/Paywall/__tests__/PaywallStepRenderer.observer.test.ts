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
// The real headless handle, by source path, for the tests that need its sanitizer.
const { openPaywallPresentation } = await import("../../../../../../onboarding/src/paywalls/observer");

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
  it("renders the new variant after a crash, reports it as a new presentation, and records its purchase", async () => {
    const calls = recorder();
    setCatalog(paywall("pw-a", { elements: [{ type: "Throws" }] }));
    await quietly(() => render());
    setCatalog(paywall("pw-b"));
    await quietly(() => render());
    // The boundary is keyed by paywall id (PaywallHost's precedent), so B renders.
    expect(h.rendered).toEqual(["content-pw-b"]);
    // A ENDED with render-error, so B on screen is a new presentation: a live
    // swap keeps one presentation, an ended one is not reused for another id.
    // Without that, a purchase on the visible B would be reported nowhere.
    await act(async () => {
      await h.host.products.purchase("annual");
      h.host.complete(undefined);
    });
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "render-error" }, null],
      ["start", "pw-b"],
      ["shown", "pw-b"],
      ["end", "pw-b", { status: "purchased" }, "annual"],
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

describe("PaywallStepRenderer — late purchase (owner decision: count it)", () => {
  const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it("ends purchased with the key when a purchase in flight at blur settles afterwards", async () => {
    const calls = recorder();
    const nav = focusController();
    setCatalog(paywall("pw-a"));
    await render(nav);
    const store = deferred<{ status: "purchased"; productKey: string }>();
    purchase.mockImplementationOnce(() => store.promise);
    let inFlight!: Promise<unknown>;
    await act(async () => {
      inFlight = h.host.products.purchase("annual");
    });
    await nav.blur();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
    ]);
    await act(async () => {
      store.resolve({ status: "purchased", productKey: "annual" });
      await inFlight;
    });
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
  });

  it("settles a purchase that REJECTS, so a blurred step ends at once instead of waiting out the bound", async () => {
    const calls = recorder();
    const nav = focusController();
    setCatalog(paywall("pw-a"));
    await render(nav);
    const store = deferred<never>();
    purchase.mockImplementationOnce(() => store.promise);
    let inFlight!: Promise<unknown>;
    await act(async () => {
      inFlight = h.host.products.purchase("annual");
    });
    await nav.blur();
    await act(async () => {
      store.reject(new Error("store unavailable"));
      await expect(inFlight).rejects.toThrow("store unavailable");
    });
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "dismissed" }, null],
    ]);
  });
});

describe("PaywallStepRenderer — a custom screen's transaction (#287)", () => {
  const TX = { originalTransactionIdentifier: "2000000123", productId: "com.app.annual.ios" };
  const fullRecorder = () => {
    const ends: unknown[][] = [];
    h.observePresentation = () => ({ shown: () => {}, end: (...args: unknown[]) => void ends.push(args) });
    return ends;
  };
  let complete: (o?: { status?: string; transaction?: unknown }) => void = () => {};
  const Screen = (props: { complete: typeof complete }) => {
    complete = props.complete;
    return null;
  };
  const showCustom = async (nav?: ReturnType<typeof focusController>) => {
    setCatalog(paywall("pw-a", { renderMode: "custom", customScreenId: "s", elements: [] }), { s: Screen });
    await render(nav);
  };

  it("forwards complete({ status: purchased, transaction }) to end() and advances", async () => {
    const ends = fullRecorder();
    await showCustom();
    await act(async () => complete({ status: "purchased", transaction: TX }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(ends).toEqual([[{ status: "purchased" }, null, null, TX]]);
  });

  it("drops it with dismissed or cancelled: the gate holds and the end carries none", async () => {
    for (const status of ["dismissed", "cancelled"]) {
      const ends = fullRecorder();
      await showCustom();
      await act(async () => complete({ status, transaction: TX }));
      expect(onContinue).not.toHaveBeenCalled();
      await unmount();
      expect(ends).toHaveLength(1);
      expect(ends[0][0]).toEqual({ status });
      expect(ends[0][3]).toBeUndefined();
    }
  });

  it("does nothing with a complete after the step was left, transaction included", async () => {
    const ends = fullRecorder();
    const nav = focusController();
    await showCustom(nav);
    await nav.blur();
    await act(async () => complete({ status: "purchased", transaction: TX }));
    expect(ends).toEqual([[{ status: "dismissed" }, null, null, undefined]]);
  });

  it("never forwards one from the elements path's ScreenHost.complete", async () => {
    const ends = fullRecorder();
    setCatalog(paywall("pw-a"));
    await render();
    await act(async () => h.host.complete({ status: "purchased", transaction: TX }));
    expect(ends).toHaveLength(1);
    expect(ends[0][3]).toBeUndefined();
  });
});

describe("PaywallStepRenderer — round 2 on a custom screen's transaction (#287)", () => {
  afterEach(() => vi.restoreAllMocks());
  const TX = { originalTransactionIdentifier: "2000000123", productId: "com.app.annual.ios" };
  let complete: (o?: unknown) => void = () => {};
  const Screen = (props: { complete: typeof complete }) => {
    complete = props.complete;
    return null;
  };
  const showCustom = async (nav?: ReturnType<typeof focusController>) => {
    setCatalog(paywall("pw-a", { renderMode: "custom", customScreenId: "s", elements: [] }), { s: Screen });
    await render(nav);
  };
  const realObserver = () => {
    const ends: unknown[] = [];
    const observer = { start: () => ({ shown: () => {}, end: (o: unknown) => void ends.push(o) }) };
    h.observePresentation = (p: any) => openPaywallPresentation(observer, p, "paywall_step", "ios");
    return ends;
  };

  it("still advances, and ends once without a transaction, when the transaction throws when read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    const throwingGetter = Object.defineProperty({ status: "purchased" }, "transaction", {
      get() {
        throw new Error("getter bug");
      },
    });
    for (const outcome of [{ status: "purchased", transaction: revocable.proxy }, throwingGetter]) {
      const ends = realObserver();
      await showCustom();
      await act(async () => complete(outcome));
      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(ends).toEqual([{ status: "purchased" }]);
      await unmount();
      onContinue.mockClear();
    }
    expect(warn).toHaveBeenCalled();
  });

  it("warns once when it drops a transaction passed with a status other than purchased", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    realObserver();
    await showCustom();
    await act(async () => complete({ status: "dismissed", transaction: TX }));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  const perVisit = () => {
    const ends: Array<[string, unknown[]]> = [];
    let n = 0;
    h.observePresentation = () => {
      const visit = `v${++n}`;
      return { shown: () => {}, end: (...args: unknown[]) => void ends.push([visit, args]) };
    };
    return ends;
  };

  it("a stale visit-1 purchased while visit 2 is focused advances, with a warning, but neither ends visit 2 nor carries its transaction", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ends = perVisit();
    const nav = focusController();
    await showCustom(nav);
    const lateFromVisit1 = complete;
    await nav.blur();
    await nav.focus();
    await act(async () => lateFromVisit1({ status: "purchased", transaction: TX }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(ends).toEqual([["v1", [{ status: "dismissed" }, null, null, undefined]]]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("earlier visit");
    // The visit-2 screen's own complete still ends visit 2, with its
    // transaction, but does not advance a second time (round 4).
    await act(async () => complete({ status: "purchased", transaction: TX }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(ends[1]).toEqual(["v2", [{ status: "purchased" }, null, null, TX]]);
  });

  for (const order of ["stale first", "current first"] as const) {
    it(`advances once per visit when a stale purchased and visit 2's own land in one tick (${order})`, async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const ends = perVisit();
      const nav = focusController();
      await showCustom(nav);
      const lateFromVisit1 = complete;
      await nav.blur();
      await nav.focus();
      const current = complete;
      await act(async () => {
        if (order === "stale first") {
          lateFromVisit1({ status: "purchased" });
          current({ status: "purchased", transaction: TX });
        } else {
          current({ status: "purchased", transaction: TX });
          lateFromVisit1({ status: "purchased" });
        }
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(ends).toEqual([
        ["v1", [{ status: "dismissed" }, null, null, undefined]],
        ["v2", [{ status: "purchased" }, null, null, TX]],
      ]);
    });
  }

  it("resets the once-per-visit advance on the next visit", async () => {
    const ends = perVisit();
    const nav = focusController();
    await showCustom(nav);
    await act(async () => complete({ status: "purchased" }));
    await nav.blur();
    await nav.focus();
    await act(async () => complete({ status: "purchased" }));
    expect(onContinue).toHaveBeenCalledTimes(2);
    expect(ends.map(([v]) => v)).toEqual(["v1", "v2"]);
  });

  it("a stale visit-1 purchased while the step is blurred does nothing", async () => {
    const ends = perVisit();
    const nav = focusController();
    await showCustom(nav);
    const lateFromVisit1 = complete;
    await nav.blur();
    await act(async () => lateFromVisit1({ status: "purchased", transaction: TX }));
    expect(onContinue).not.toHaveBeenCalled();
    expect(ends).toEqual([["v1", [{ status: "dismissed" }, null, null, undefined]]]);
  });

  it("a stale visit-1 dismissed while visit 2 is focused does nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ends = perVisit();
    const nav = focusController();
    await showCustom(nav);
    const lateFromVisit1 = complete;
    await nav.blur();
    await nav.focus();
    for (const outcome of [{ status: "dismissed", transaction: TX }, { status: "cancelled" }, undefined]) {
      await act(async () => lateFromVisit1(outcome));
    }
    expect(onContinue).not.toHaveBeenCalled();
    expect(ends).toEqual([["v1", [{ status: "dismissed" }, null, null, undefined]]]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("PaywallStepRenderer — the served arm reaches the observer's start() (#237)", () => {
  const startInfo = async (arm: Record<string, unknown>) => {
    const infos: Array<Record<string, unknown>> = [];
    const observer = { start: (info: Record<string, unknown>) => void infos.push(info) };
    h.observePresentation = (p: any) => openPaywallPresentation(observer as any, p, "paywall_step", "ios");
    setCatalog(paywall("pw-a", arm));
    await render();
    expect(infos).toHaveLength(1);
    return infos[0];
  };

  it("reports a served variant", async () => {
    expect(await startInfo({ variantKey: "b", deploymentId: 42 })).toMatchObject({
      surface: "paywall_step",
      variantKey: "b",
      deploymentId: "42",
    });
  });

  it("reports the parent paywall as main", async () => {
    expect(await startInfo({ variantKey: "main", deploymentId: 7 })).toMatchObject({ variantKey: "main", deploymentId: "7" });
  });

  it("adds no property for an older server", async () => {
    const info = await startInfo({});
    expect(Object.keys(info)).not.toContain("variantKey");
    expect(Object.keys(info)).not.toContain("deploymentId");
  });
});

describe("PaywallStepRenderer — custom screen sees the moment's variant identity (#235)", () => {
  it("passes variantKey and deploymentId through on the paywall prop", async () => {
    let seen: Record<string, unknown> | null = null;
    const Screen = (props: { paywall: Record<string, unknown> }) => {
      seen = props.paywall;
      return null;
    };
    recorder();
    setCatalog(
      paywall("pw-a", { renderMode: "custom", customScreenId: "s", elements: [], variantKey: "main", deploymentId: 7 }),
      { s: Screen },
    );
    await render();
    expect(seen).toEqual({ id: "pw-a", name: "pw-a", moment: "m", customScreenId: "s", variantKey: "main", deploymentId: 7 });
  });
});
