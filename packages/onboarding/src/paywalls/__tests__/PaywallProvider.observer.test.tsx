// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useContext } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PaywallObserver } from "../observer";
import type { PaywallContextValue } from "../PaywallProvider";
import type { ProductRuntime, ProductProvider, PurchaseResult, ResolvedProduct } from "../../products/types";
import { LATE_PURCHASE_TIMEOUT_MS } from "../present";
import type { QueryClient } from "@tanstack/react-query";

/**
 * `PaywallProvider`'s observer wiring, end to end through a real render
 * (react-dom under jsdom, `react-native` stubbed — the same harness as
 * `__tests__/OnboardingDataGate.test.tsx`). Every test loads a fresh module
 * graph: the provider's `QueryClient` and the user-property store are module
 * singletons.
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

const paywall = (moment: string, id = `pw-${moment}`) => ({
  id,
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

const makeClient = (catalog: ReturnType<typeof catalogOf>) =>
  ({
    projectId: "p1",
    options: { isSandbox: true },
    getPaywalls: vi.fn(async () => ({ data: catalog, headers: {} })),
  }) as any;

const resolved = (key: string): ResolvedProduct => ({
  key,
  productId: `store-${key}`,
  store: "app_store",
  title: key,
  description: "",
  price: "$1",
  priceAmount: 1,
  currencyCode: "USD",
  period: "year",
  periodCount: 1,
  periodIso: "P1Y",
});

const productProvider: ProductProvider = {
  getProducts: async (refs) => refs.map((r) => resolved(r.key)),
  purchase: async (p) => ({ status: "purchased", productKey: p.key }),
  restore: async () => ({ status: "nothing_to_restore" }),
};

const recordingObserver = () => {
  const calls: Array<[string, unknown?]> = [];
  const observer: PaywallObserver = {
    start: (info) => {
      calls.push(["start", info]);
      return {
        shown: () => void calls.push(["shown"]),
        end: (outcome) => void calls.push(["end", outcome]),
      };
    },
  };
  return { observer, calls };
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

type Captured = { ctx: PaywallContextValue; runtime: ProductRuntime | null; queryClient: QueryClient };

/** Mounts a real provider and returns live accessors into its context. */
const mount = async (props: {
  catalog?: ReturnType<typeof catalogOf>;
  observer?: unknown;
  presentAckTimeoutMs?: number | null;
  productProvider?: ProductProvider;
}) => {
  vi.resetModules();
  const [{ PaywallProvider, PaywallContext }, { ProductRuntimeContext }, { useQueryClient }] = await Promise.all([
    import("../PaywallProvider"),
    import("../../products/ProductRuntimeContext"),
    // After the reset, so it is the instance the provider's QueryClientProvider uses.
    import("@tanstack/react-query"),
  ]);
  const captured = {} as Captured;
  const Capture = () => {
    captured.ctx = useContext(PaywallContext);
    captured.runtime = useContext(ProductRuntimeContext);
    captured.queryClient = useQueryClient();
    return null;
  };
  const client = makeClient(props.catalog ?? catalogOf("upgrade", "downsell"));
  const element = (observer: unknown, catalogClient = client) => (
    <PaywallProvider
      client={catalogClient}
      productProvider={props.productProvider ?? productProvider}
      observer={observer as PaywallObserver}
      presentAckTimeoutMs={props.presentAckTimeoutMs === undefined ? null : props.presentAckTimeoutMs}
    >
      <Capture />
    </PaywallProvider>
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(element(props.observer));
  });
  await settle();
  return {
    captured,
    /** `{ settle: false }` under fake timers: `settle()` waits on a real `setTimeout`. */
    rerender: async (observer: unknown, catalogClient?: any, options?: { settle?: boolean }) => {
      await act(async () => {
        root!.render(element(observer, catalogClient));
      });
      if (options?.settle !== false) await settle();
    },
  };
};

/** For `present()` calls that resolve IMMEDIATELY (a refusal): returns the result. */
const presentImmediate = async (captured: Captured, moment: string) => {
  let result: unknown;
  await act(async () => {
    result = await captured.ctx.present(moment);
  });
  return result;
};

/**
 * A background revalidation that swaps a moment's variant: same query key, a
 * fresh catalog (what `getPaywalls.query.ts`'s detached `fetchAndCache` pushes).
 */
const revalidate = async (captured: Captured, catalog: unknown) => {
  await act(async () => {
    captured.queryClient.setQueriesData({ queryKey: ["paywallCatalog"] }, catalog);
  });
  await settle();
};

const act_ = async (fn: () => void | Promise<unknown>) => {
  await act(async () => {
    await fn();
  });
  await settle();
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe("PaywallProvider observer — present()", () => {
  it("reports start, shown and end for a presentation, with the contract's info", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    await act(async () => void captured.ctx.present("upgrade"));
    await settle();
    await act_(() => captured.ctx.acknowledgePresentation());
    await act_(() => captured.ctx.complete({ status: "dismissed" }));

    expect(calls).toEqual([
      [
        "start",
        {
          moment: "upgrade",
          paywallId: "pw-upgrade",
          audienceId: "7",
          renderMode: "elements",
          billing: "store",
          surface: "present",
        },
      ],
      ["shown"],
      ["end", { status: "dismissed" }],
    ]);
  });

  it("calls nothing for unknown-moment and already-presenting refusals", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    expect(await presentImmediate(captured, "nope")).toEqual({ status: "error", reason: "unknown-moment" });
    expect(calls).toEqual([]);

    await act(async () => void captured.ctx.present("upgrade"));
    await settle();
    expect(await presentImmediate(captured, "downsell")).toMatchObject({ reason: "already-presenting" });
    expect(calls.map(([n]) => n)).toEqual(["start"]);
  });

  it("ends a never-acknowledged presentation with error host-never-presented", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer, presentAckTimeoutMs: 20 });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    await settle();
    expect(settled).toEqual({ status: "error", reason: "host-never-presented" });
    expect(calls.map(([n]) => n)).toEqual(["start", "end"]);
    expect(calls[1]).toEqual(["end", { status: "error", reason: "host-never-presented" }]);
  });

  it("ends with error paywall-disappeared when the moment leaves the catalog mid-presentation", async () => {
    const { observer, calls } = recordingObserver();
    const { captured, rerender } = await mount({ observer });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await act_(() => captured.ctx.acknowledgePresentation());
    // A different client = a different query key, whose catalog lacks the moment.
    const next = makeClient(catalogOf("downsell"));
    next.projectId = "p2";
    await rerender(observer, next);
    expect(settled).toEqual({ status: "error", reason: "paywall-disappeared" });
    expect(calls.map(([n]) => n)).toEqual(["start", "shown", "end"]);
    expect(calls[2]).toEqual(["end", { status: "error", reason: "paywall-disappeared" }]);
    // The END carries the paywall that was started, not whatever is in the catalog now.
    expect((calls[0][1] as { paywallId: string }).paywallId).toBe("pw-upgrade");
  });

  it("reports a dismiss upgraded to purchased as purchased, with the slot's productId for this platform", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await act_(() => captured.runtime!.purchase("annual"));
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(settled).toEqual({ status: "purchased" });
    expect(calls[calls.length - 1]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.annual.ios" } },
    ]);
  });

  it("does not credit a purchase from a previous presentation to the next one", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    await act(async () => void captured.ctx.present("upgrade"));
    await settle();
    await act_(() => captured.runtime!.purchase("annual"));
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    await act(async () => void captured.ctx.present("downsell"));
    await settle();
    await act_(() => captured.ctx.complete({ status: "purchased" }));
    // Purchased reported by the closing action itself, with no SDK purchase in
    // THIS presentation: no transaction rather than the previous one's.
    expect(calls[calls.length - 1]).toEqual(["end", { status: "purchased" }]);
  });

  it("ends each presentation exactly once even when complete() is called twice, and starts the downsell clean", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    await act(async () => void captured.ctx.present("upgrade"));
    await settle();
    await act_(() => {
      captured.ctx.complete({ status: "dismissed" });
      captured.ctx.complete({ status: "dismissed" });
    });
    expect(calls.filter(([n]) => n === "end")).toHaveLength(1);
  });

  it("never changes present()'s result when the observer throws or is malformed", async () => {
    const boom = () => {
      throw new Error("observer bug");
    };
    for (const observer of [
      { start: boom },
      { start: () => ({ shown: boom, end: boom }) },
      { start: () => 42 },
      { start: () => undefined },
      42,
    ]) {
      const { captured } = await mount({ observer });
      let settled: unknown;
      await act(async () => {
        captured.ctx.present("upgrade").then((r) => (settled = r));
      });
      await settle();
      await act_(() => captured.ctx.acknowledgePresentation());
      await act_(() => captured.ctx.complete({ status: "cancelled" }));
      expect(settled).toEqual({ status: "cancelled" });
      // The surface is free again: the next present() starts normally.
      expect(captured.ctx.activePaywall).toBeNull();
      await act(async () => root!.unmount());
      root = null;
    }
  });

  it("with no observer, behaves exactly as before", async () => {
    const { captured } = await mount({});
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(settled).toEqual({ status: "dismissed" });
  });

  it("reads the CURRENT observer prop, not the one captured at mount", async () => {
    const first = recordingObserver();
    const second = recordingObserver();
    const { captured, rerender } = await mount({ observer: first.observer });
    await rerender(second.observer);
    await act(async () => void captured.ctx.present("upgrade"));
    await settle();
    expect(first.calls).toEqual([]);
    expect(second.calls.map(([n]) => n)).toEqual(["start"]);
  });
});

describe("PaywallProvider observer — present() after a variant swap", () => {
  const variantB = (products: Array<{ key: string; ios: string; android: string }>) => {
    const catalog = catalogOf("upgrade", "downsell");
    catalog.paywalls.upgrade = { ...paywall("upgrade", "pw-upgrade-b"), products };
    return catalog;
  };

  it("reports the store id of the variant the purchase was made on, for the same slot key", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await revalidate(captured, variantB([{ key: "annual", ios: "com.app.b.annual.ios", android: "b.android" }]));
    expect(captured.ctx.activePaywall?.id).toBe("pw-upgrade-b");
    await act_(() => captured.runtime!.purchase("annual"));
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(settled).toEqual({ status: "purchased" });
    // Credited to the presentation of the FIRST variant...
    expect((calls[0][1] as { paywallId: string }).paywallId).toBe("pw-upgrade");
    // ...with the id of the slot actually bought.
    expect(calls[calls.length - 1]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.b.annual.ios" } },
    ]);
  });

  it("carries a transaction for a slot only the swapped-in variant has", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    await act(async () => void captured.ctx.present("upgrade"));
    await settle();
    await revalidate(captured, variantB([{ key: "monthly", ios: "com.app.b.monthly.ios", android: "b.m.android" }]));
    await act_(() => captured.runtime!.purchase("monthly"));
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(calls[calls.length - 1]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.b.monthly.ios" } },
    ]);
  });
});

describe("PaywallProvider observer — a purchase wins over the paywall disappearing (owner decision)", () => {
  /** A store whose purchases settle only when the test says so. */
  const deferredStore = () => {
    const waiting: Array<(r: PurchaseResult) => void> = [];
    const provider: ProductProvider = {
      ...productProvider,
      purchase: () => new Promise<PurchaseResult>((resolve) => void waiting.push(resolve)),
    };
    const settleNext = async (result: PurchaseResult) => {
      await act(async () => {
        waiting.shift()!(result);
      });
      await settle();
    };
    return { provider, settleNext, waiting };
  };

  /** A different query key whose catalog lacks "upgrade": `data` goes undefined, then lacks it. */
  const withoutUpgrade = () => {
    const next = makeClient(catalogOf("downsell"));
    next.projectId = "p2";
    return next;
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends purchased with its key when a purchase SETTLED before the paywall disappeared", async () => {
    const { observer, calls } = recordingObserver();
    const { captured, rerender } = await mount({ observer });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await act_(() => captured.ctx.acknowledgePresentation());
    await act_(() => captured.runtime!.purchase("annual"));
    await rerender(observer, withoutUpgrade());
    expect(settled).toEqual({ status: "purchased" });
    expect(calls.map(([n]) => n)).toEqual(["start", "shown", "end"]);
    expect(calls[2]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.annual.ios" } },
    ]);
  });

  it("waits for a purchase in flight, then ends and resolves with the store outcome", async () => {
    const store = deferredStore();
    const { observer, calls } = recordingObserver();
    const { captured, rerender } = await mount({ observer, productProvider: store.provider });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await act(async () => void captured.runtime!.purchase("annual"));
    await settle();
    expect(store.waiting).toHaveLength(1);
    await rerender(observer, withoutUpgrade());
    expect(settled).toBeUndefined();
    expect(calls.map(([n]) => n)).toEqual(["start"]);
    // The surface is free meanwhile: nothing is left holding `activeMoment`.
    expect(captured.ctx.activePaywall).toBeNull();
    await store.settleNext({ status: "purchased", productKey: "annual" });
    expect(settled).toEqual({ status: "purchased" });
    expect(calls).toEqual([
      ["start", expect.objectContaining({ paywallId: "pw-upgrade" })],
      ["end", { status: "purchased", transaction: { productId: "com.app.annual.ios" } }],
    ]);
  });

  it("ends dismissed after LATE_PURCHASE_TIMEOUT_MS when the purchase in flight never settles", async () => {
    const store = deferredStore();
    const { observer, calls } = recordingObserver();
    const { captured, rerender } = await mount({ observer, productProvider: store.provider });
    let settled: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (settled = r));
    });
    await settle();
    await act(async () => void captured.runtime!.purchase("annual"));
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await rerender(observer, withoutUpgrade(), { settle: false });
    await act(async () => {
      vi.advanceTimersByTime(LATE_PURCHASE_TIMEOUT_MS - 1);
    });
    expect(settled).toBeUndefined();
    expect(calls.map(([n]) => n)).toEqual(["start"]);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(settled).toEqual({ status: "dismissed" });
    expect(calls[1]).toEqual(["end", { status: "dismissed" }]);
    vi.useRealTimers();
    // A purchase settling after the bound changes nothing.
    await store.settleNext({ status: "purchased", productKey: "annual" });
    expect(calls).toHaveLength(2);
    expect(settled).toEqual({ status: "dismissed" });
  });

  it("drops a purchase that settles after its presentation was DISMISSED, and never credits it to the next", async () => {
    // The race the old generation counter guarded: A's purchase is in flight,
    // the user dismisses A, B is presented, then A's purchase settles.
    const store = deferredStore();
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer, productProvider: store.provider });
    let first: unknown;
    let second: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (first = r));
    });
    await settle();
    await act(async () => void captured.runtime!.purchase("annual"));
    await settle();
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(first).toEqual({ status: "dismissed" });
    await act(async () => {
      captured.ctx.present("downsell").then((r) => (second = r));
    });
    await settle();
    await store.settleNext({ status: "purchased", productKey: "annual" });
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(second).toEqual({ status: "dismissed" });
    expect(calls.filter(([n]) => n === "end")).toEqual([
      ["end", { status: "dismissed" }],
      ["end", { status: "dismissed" }],
    ]);
  });

  it("lets a downsell present() run while it waits, and never crosses the two presentations", async () => {
    const store = deferredStore();
    const { observer, calls } = recordingObserver();
    const { captured, rerender } = await mount({ observer, productProvider: store.provider });
    let first: unknown;
    let second: unknown;
    await act(async () => {
      captured.ctx.present("upgrade").then((r) => (first = r));
    });
    await settle();
    await act(async () => void captured.runtime!.purchase("annual"));
    await settle();
    await rerender(observer, withoutUpgrade());
    await act(async () => {
      captured.ctx.present("downsell").then((r) => (second = r));
    });
    await settle();
    expect(captured.ctx.activePaywall?.moment).toBe("downsell");
    expect(calls.map(([n]) => n)).toEqual(["start", "start"]);

    await store.settleNext({ status: "purchased", productKey: "annual" });
    expect(first).toEqual({ status: "purchased" });
    expect(second).toBeUndefined();
    expect(calls[2]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.annual.ios" } },
    ]);
    // The downsell is still showing, and its end owes nothing to the old purchase.
    expect(captured.ctx.activePaywall?.moment).toBe("downsell");
    await act_(() => captured.ctx.complete({ status: "dismissed" }));
    expect(second).toEqual({ status: "dismissed" });
    expect(calls[3]).toEqual(["end", { status: "dismissed" }]);
  });
});

describe("PaywallProvider observer — observePresentation (the inline step's seam)", () => {
  it("opens a paywall_step presentation through the same observer", async () => {
    const { observer, calls } = recordingObserver();
    const { captured } = await mount({ observer });
    const p = captured.ctx.observePresentation(paywall("upgrade"));
    p.shown();
    p.end({ status: "purchased" }, "annual");
    expect(calls).toEqual([
      ["start", expect.objectContaining({ surface: "paywall_step", paywallId: "pw-upgrade" })],
      ["shown"],
      ["end", { status: "purchased", transaction: { productId: "com.app.annual.ios" } }],
    ]);
  });
});
