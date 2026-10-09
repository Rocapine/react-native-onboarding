// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useContext } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PaywallObserver } from "../observer";
import type { PaywallContextValue } from "../PaywallProvider";
import type { ProductRuntime, ProductProvider, ResolvedProduct } from "../../products/types";

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

type Captured = { ctx: PaywallContextValue; runtime: ProductRuntime | null };

/** Mounts a real provider and returns live accessors into its context. */
const mount = async (props: {
  catalog?: ReturnType<typeof catalogOf>;
  observer?: unknown;
  presentAckTimeoutMs?: number | null;
}) => {
  vi.resetModules();
  const [{ PaywallProvider, PaywallContext }, { ProductRuntimeContext }] = await Promise.all([
    import("../PaywallProvider"),
    import("../../products/ProductRuntimeContext"),
  ]);
  const captured = {} as Captured;
  const Capture = () => {
    captured.ctx = useContext(PaywallContext);
    captured.runtime = useContext(ProductRuntimeContext);
    return null;
  };
  const client = makeClient(props.catalog ?? catalogOf("upgrade", "downsell"));
  const element = (observer: unknown, catalogClient = client) => (
    <PaywallProvider
      client={catalogClient}
      productProvider={productProvider}
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
    rerender: async (observer: unknown, catalogClient?: any) => {
      await act(async () => {
        root!.render(element(observer, catalogClient));
      });
      await settle();
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
