// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement, useCallback, useContext, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { RenderContext } from "../../Runtime/elements/shared";
import type { ButtonAction } from "../../Runtime/elements/actions";
import type { CompleteOutcome } from "../../Runtime/ScreenHost";

/**
 * `complete()` is bound to the presentation it was rendered for (RNO#329 round
 * 5): an authored action chain still running for paywall A must never end or
 * close the presentation that replaced it.
 *
 * What is REAL here: the headless `PaywallProvider` (imported by source path,
 * the `usePaywallStepObservation.test.ts` precedent), its purchase-tracking
 * product runtime, the engine's `runActions`, `toPresentResult` and
 * `presentationContentKey` (the `PaywallHost` wrapper and content key). What is
 * MODELED, because this package's tests render no React Native tree: the
 * `Modal`, and `ScreenRenderer`'s ref-stash of `complete` (`completeRef`, read at
 * call time by `ctx.onContinue`), reproduced line for line in `Content` below.
 */

vi.mock("@react-native-async-storage/async-storage", () => {
  const map = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => map.get(k) ?? null,
      setItem: async (k: string, v: string) => void map.set(k, v),
      removeItem: async (k: string) => void map.delete(k),
      getAllKeys: async () => [...map.keys()],
      multiRemove: async (ks: string[]) => ks.forEach((k) => map.delete(k)),
    },
  };
});
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Image: { prefetch: async () => true },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const paywall = (moment: string) => ({
  id: `pw-${moment}`,
  name: moment,
  moment,
  audienceId: 7,
  audienceName: "everyone",
  elements: [],
  billing: "store" as const,
  products: [{ key: "annual", ios: "com.app.annual.ios", android: "com.app.annual.android" }],
  configuration: null,
});
const catalogOf = (...moments: string[]) => ({
  metadata: { locale: "en", draft: false },
  paywalls: Object.fromEntries(moments.map((m) => [m, paywall(m)])),
  fonts: null,
});
const makeClient = (catalog: ReturnType<typeof catalogOf>, projectId = "p1") =>
  ({
    projectId,
    options: { isSandbox: true },
    getPaywalls: vi.fn(async () => ({ data: catalog, headers: {} })),
  }) as any;

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const settle = async () => {
  await act(async () => {
    await flush();
    await flush();
  });
};

const mount = async (options: { presentAckTimeoutMs?: number | null } = {}) => {
  vi.resetModules();
  const [{ PaywallProvider, PaywallContext }, { ProductRuntimeContext }, { runActions }, binding] =
    await Promise.all([
      import("../../../../../onboarding/src/paywalls/PaywallProvider"),
      import("../../../../../onboarding/src/products/ProductRuntimeContext"),
      import("../../Runtime/elements/runActions"),
      import("../presentationBinding"),
    ]);
  const purchases: Array<Deferred<any>> = [];
  const productProvider = {
    getProducts: async (refs: Array<{ key: string }>) =>
      refs.map((r) => ({
        key: r.key,
        productId: `store-${r.key}`,
        store: "app_store" as const,
        title: r.key,
        description: "",
        price: "$1",
        priceAmount: 1,
        currencyCode: "USD",
        period: "year",
        periodCount: 1,
        periodIso: "P1Y",
      })),
    purchase: () => {
      const d = deferred<any>();
      purchases.push(d);
      return d.promise;
    },
    restore: async () => ({ status: "nothing_to_restore" }),
  };
  const slow = deferred<void>();
  const live: { host?: any; ctx?: RenderContext; close?: () => void; refuseShow?: boolean } = {};
  // What a stale chain must never reach: `PaywallHost`'s `presentPaywall`
  // (an unbound `void present(...)`) and a host `custom` action.
  const presentPaywallCalls: string[] = [];
  let spyCalls = 0;
  const observed: string[] = [];
  const observer = {
    start: (info: { moment: string }) => {
      observed.push(`start ${info.moment}`);
      return {
        shown: () => void observed.push(`shown ${info.moment}`),
        end: (o: { status: string; reason?: string }) =>
          void observed.push(`end ${info.moment} ${o.status}${o.reason ? ` ${o.reason}` : ""}`),
      };
    },
  };

  // ScreenRenderer's stash, verbatim in shape: `completeRef.current` is read
  // when an action calls `onContinue`, not when it was rendered.
  const Content = ({
    complete,
    products,
    present,
  }: {
    complete: (o?: CompleteOutcome) => void;
    products: any;
    present: (moment: string) => Promise<unknown>;
  }) => {
    const completeRef = useRef(complete);
    completeRef.current = complete;
    const onContinue = useCallback((outcome?: CompleteOutcome) => completeRef.current(outcome), []);
    live.ctx = {
      theme: {} as RenderContext["theme"],
      getVariables: () => ({}),
      setVariable: () => {},
      onContinue,
      customActions: { slow: () => slow.promise, spy: () => void spyCalls++ },
      products,
      // PaywallHost's `presentPaywall`, verbatim in shape.
      presentPaywall: (moment: string) => {
        presentPaywallCalls.push(moment);
        void present(moment);
      },
      renderChildren: () => null,
    } as unknown as RenderContext;
    return null;
  };
  // PaywallHost's wiring: the `complete` wrapper, `handleRequestClose`, and the
  // content key.
  const Host = () => {
    const host = useContext(PaywallContext) as any;
    const products = useContext(ProductRuntimeContext);
    live.host = host;
    // The RN Modal's `onShow`: fires when `visible` goes false → true, never
    // when it stays true across two presentations in one commit.
    const visible = Boolean(host.activePaywall);
    const ackRef = useRef(host.acknowledgePresentation);
    ackRef.current = host.acknowledgePresentation;
    useEffect(() => {
      // `refuseShow` models iOS refusing to present: no `onShow` at all.
      if (visible && !live.refuseShow) ackRef.current();
    }, [visible]);
    const resolvePresent = host.complete;
    const complete = useCallback(
      (outcome?: CompleteOutcome) => resolvePresent(binding.toPresentResult(outcome)),
      [resolvePresent]
    );
    live.close = () => complete({ status: "dismissed" });
    if (!host.activePaywall) return null;
    return createElement(Content, {
      key: binding.presentationContentKey(host.activePaywall.id, resolvePresent),
      complete,
      products,
      present: host.present,
    });
  };
  const element = (client: any) =>
    createElement(PaywallProvider, {
      client,
      productProvider: productProvider as any,
      presentAckTimeoutMs: options.presentAckTimeoutMs === undefined ? null : options.presentAckTimeoutMs,
      observer,
      children: createElement(Host),
    });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element(makeClient(catalogOf("upgrade", "downsell")))));
  await settle();
  return {
    live,
    observed,
    storePurchases: () => purchases.length,
    presentPaywallCalls,
    spyCalls: () => spyCalls,
    slow,
    /** Runs an authored action list on the content currently shown, without awaiting it. */
    press: async (actions: ButtonAction[]) => {
      const ctx = live.ctx!;
      await act(async () => void runActions(actions, ctx));
      await settle();
    },
    settlePurchase: async (result: unknown) => {
      await act(async () => purchases.shift()!.resolve(result));
      await settle();
    },
    present: async (moment: string, onResolve?: (r: unknown) => void) => {
      await act(async () => void live.host.present(moment).then(onResolve));
      await settle();
    },
    disappear: async () => {
      await act(async () => root!.render(element(makeClient(catalogOf("downsell"), "p2"))));
      await settle();
    },
  };
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

const BUY_THEN_DISMISS: ButtonAction[] = [
  { type: "purchase", product: "annual", onSuccess: [{ type: "dismiss" }] } as ButtonAction,
];

describe("present(): complete() is bound to the presentation it was rendered for", () => {
  it("A's onSuccess dismiss, resuming after A's paywall disappeared and B opened, leaves B open", async () => {
    const t = await mount();
    let first: unknown;
    let second: unknown;
    await t.present("upgrade", (r) => (first = r));
    await t.press(BUY_THEN_DISMISS);
    await t.disappear();
    await t.present("downsell", (r) => (second = r));
    expect(t.live.host.activePaywall?.moment).toBe("downsell");

    await t.settlePurchase({ status: "purchased", productKey: "annual" });
    expect(first).toEqual({ status: "purchased" });
    expect(second).toBeUndefined();
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
  });

  it("A's onSuccess dismiss does not close the paywall the host's `await present()` continuation opened", async () => {
    const t = await mount();
    let second: unknown;
    await t.present("upgrade", () => void t.live.host.present("downsell").then((r: unknown) => (second = r)));
    await t.press(BUY_THEN_DISMISS);
    // The user closes the Modal while the store sheet is up: it waits (ruling 3).
    await act(async () => t.live.close!());
    await settle();
    await t.settlePurchase({ status: "purchased", productKey: "annual" });
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
    expect(second).toBeUndefined();
  });

  it("a Stripe-style onPending dismiss from A does not close the continuation's paywall", async () => {
    const t = await mount();
    let second: unknown;
    await t.present("upgrade", () => void t.live.host.present("downsell").then((r: unknown) => (second = r)));
    await t.press([{ type: "purchase", product: "annual", onPending: [{ type: "dismiss" }] } as ButtonAction]);
    await act(async () => t.live.close!());
    await settle();
    await t.settlePurchase({ status: "pending" });
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
    expect(second).toBeUndefined();
  });

  it("a trailing dismiss from A does not close a same-moment re-present that reused A's content", async () => {
    const t = await mount();
    let second: unknown;
    await t.present("upgrade", () => void t.live.host.present("upgrade").then((r: unknown) => (second = r)));
    await t.press([{ type: "custom", function: "slow" } as ButtonAction, { type: "dismiss" } as ButtonAction]);
    // Back button with nothing in flight: A ends at once, and the continuation
    // re-presents the same moment, in the same batch.
    await act(async () => t.live.close!());
    await settle();
    expect(t.live.host.activePaywall?.moment).toBe("upgrade");
    await act(async () => t.slow.resolve());
    await settle();
    expect(t.live.host.activePaywall?.moment).toBe("upgrade");
    expect(second).toBeUndefined();
  });

  it("the CURRENT presentation's own dismiss still closes it", async () => {
    const t = await mount();
    let first: unknown;
    await t.present("upgrade", (r) => (first = r));
    await t.press([{ type: "dismiss" } as ButtonAction]);
    expect(first).toEqual({ status: "dismissed" });
    expect(t.live.host.activePaywall).toBeNull();
  });

  it("a stale chain from A does not open the store, and records nothing on B (round 6)", async () => {
    const t = await mount();
    let second: unknown;
    await t.present("upgrade", () => void t.live.host.present("downsell").then((r: unknown) => (second = r)));
    await t.press([{ type: "custom", function: "slow" } as ButtonAction, ...BUY_THEN_DISMISS]);
    // Closed with nothing in flight: A ends at once and B opens.
    await act(async () => t.live.close!());
    await settle();
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
    // A's chain resumes and reaches its `purchase`.
    await act(async () => t.slow.resolve());
    await settle();
    expect(t.storePurchases()).toBe(0);
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
    // B closes with its own dismiss and owes nothing to A's purchase.
    await t.press([{ type: "dismiss" } as ButtonAction]);
    expect(second).toEqual({ status: "dismissed" });
  });
});

describe("present(): a purchase refused because its presentation ended runs no branch (round 7)", () => {
  const SPY = { type: "custom", function: "spy" } as ButtonAction;
  const DOWNSELL = { type: "presentPaywall", placement: "downsell" } as ButtonAction;
  const SLOW = { type: "custom", function: "slow" } as ButtonAction;
  const BUY_WITH_EVERY_BRANCH = {
    type: "purchase",
    product: "annual",
    onSuccess: [SPY, DOWNSELL],
    onCancel: [DOWNSELL, SPY],
    onError: [DOWNSELL, SPY],
    onPending: [DOWNSELL, SPY],
  } as ButtonAction;

  it("closed with nothing on screen: no onCancel, no trailing sibling, no downsell nobody asked for", async () => {
    const t = await mount();
    let first: unknown;
    await t.present("upgrade", (r) => (first = r));
    await t.press([SLOW, BUY_WITH_EVERY_BRANCH, SPY, DOWNSELL]);
    await act(async () => t.live.close!());
    await settle();
    expect(first).toEqual({ status: "dismissed" });
    expect(t.live.host.activePaywall).toBeNull();

    await act(async () => t.slow.resolve());
    await settle();
    expect(t.storePurchases()).toBe(0);
    expect(t.presentPaywallCalls).toEqual([]);
    expect(t.spyCalls()).toBe(0);
    expect(t.live.host.activePaywall).toBeNull();
    expect(t.observed).not.toContain("start downsell");
  });

  it("with B on screen, a purchase nested in A's branch ends A's whole chain, outer siblings included", async () => {
    const t = await mount();
    await t.present("upgrade", () => void t.live.host.present("downsell"));
    await t.press([{ ...SLOW, onResolve: [BUY_WITH_EVERY_BRANCH, SPY] } as ButtonAction, SPY, DOWNSELL]);
    await act(async () => t.live.close!());
    await settle();
    expect(t.live.host.activePaywall?.moment).toBe("downsell");

    await act(async () => t.slow.resolve());
    await settle();
    expect(t.storePurchases()).toBe(0);
    expect(t.presentPaywallCalls).toEqual([]);
    expect(t.spyCalls()).toBe(0);
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
  });

  it("a purchase on the presentation still showing runs its branch as before (control)", async () => {
    const t = await mount();
    await t.present("upgrade");
    await t.press([BUY_WITH_EVERY_BRANCH]);
    await t.settlePurchase({ status: "cancelled" });
    expect(t.presentPaywallCalls).toEqual(["downsell"]);
    expect(t.spyCalls()).toBe(1);
  });

  it("a purchase that STARTED on screen and settles after the close still runs onSuccess", async () => {
    const t = await mount();
    await t.present("upgrade");
    await t.press([BUY_WITH_EVERY_BRANCH]);
    await act(async () => t.live.close!());
    await settle();
    await t.settlePurchase({ status: "purchased", productKey: "annual" });
    expect(t.spyCalls()).toBe(1);
  });
});

describe("present(): a presentation that takes a still-visible surface is acknowledged (round 6)", () => {
  const ACK_MS = 40;
  const wait = async (ms: number) => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
    await settle();
  };

  it("a same-moment re-present in one batch is shown and never torn down by the ack timeout", async () => {
    const t = await mount({ presentAckTimeoutMs: ACK_MS });
    let second: unknown;
    await t.present("upgrade", () => void t.live.host.present("upgrade").then((r: unknown) => (second = r)));
    expect(t.observed).toEqual(["start upgrade", "shown upgrade"]);
    await act(async () => t.live.close!());
    await settle();
    await wait(ACK_MS * 3);
    expect(second).toBeUndefined();
    expect(t.live.host.activePaywall?.moment).toBe("upgrade");
    expect(t.observed).toEqual([
      "start upgrade",
      "shown upgrade",
      "end upgrade dismissed",
      "start upgrade",
      "shown upgrade",
    ]);
  });

  it("so is a downsell opened by the `await present()` continuation in the same batch", async () => {
    const t = await mount({ presentAckTimeoutMs: ACK_MS });
    let second: unknown;
    await t.present("upgrade", () => void t.live.host.present("downsell").then((r: unknown) => (second = r)));
    await act(async () => t.live.close!());
    await settle();
    await wait(ACK_MS * 3);
    expect(second).toBeUndefined();
    expect(t.live.host.activePaywall?.moment).toBe("downsell");
    expect(t.observed.slice(-2)).toEqual(["start downsell", "shown downsell"]);
  });

  it("a later present in its own commit is still acknowledged through onShow, as before", async () => {
    const t = await mount({ presentAckTimeoutMs: ACK_MS });
    // Acknowledged once, closed, and a LATER present (its own commit) that the
    // modeled Modal does show: control for the carry-over above.
    let first: unknown;
    await t.present("upgrade", (r) => (first = r));
    await act(async () => t.live.close!());
    await settle();
    expect(first).toEqual({ status: "dismissed" });
    let next: unknown;
    await t.present("downsell", (r) => (next = r));
    await wait(ACK_MS * 3);
    expect(next).toBeUndefined();
    expect(t.observed.slice(-2)).toEqual(["start downsell", "shown downsell"]);
  });

  it("still abandons a presentation the platform refuses after a commit gap: the carry-over is per commit", async () => {
    const t = await mount({ presentAckTimeoutMs: ACK_MS });
    await t.present("upgrade");
    await act(async () => t.live.close!());
    await settle();
    t.live.refuseShow = true;
    let next: unknown;
    await t.present("downsell", (r) => (next = r));
    await wait(ACK_MS * 3);
    expect(next).toEqual({ status: "error", reason: "host-never-presented" });
  });
});
