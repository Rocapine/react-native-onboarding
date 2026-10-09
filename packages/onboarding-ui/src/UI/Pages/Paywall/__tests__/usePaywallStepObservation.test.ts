// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React, { Component, StrictMode, act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PaywallPresentation } from "@rocapine/react-native-onboarding";
import {
  usePaywallStepObservation,
  purchaseOutcomeFromResult as uiPurchaseOutcomeFromResult,
  resolvePresentedOutcome as uiResolvePresentedOutcome,
  type PaywallStepObservation,
} from "../usePaywallStepObservation";
// The headless originals, imported by source path to hold the UI mirror equal —
// the `completingActions` / `requestPermission.test.ts` precedent. A runtime
// import of them from the package would key this package's behaviour on
// whichever headless version a host resolved within the peer range.
import {
  purchaseOutcomeFromResult as headlessPurchaseOutcomeFromResult,
  resolvePresentedOutcome as headlessResolvePresentedOutcome,
} from "../../../../../../onboarding/src/paywalls/present";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Paywall = { id: string; moment: string };
const A: Paywall = { id: "pw-a", moment: "step" };
const B: Paywall = { id: "pw-b", moment: "step" };

/**
 * A recording `observePresentation`. Deliberately WITHOUT the real handle's
 * once-guards: these tests assert the hook's own calls, so a double `end()`
 * from the hook shows up here instead of being hidden by the provider.
 */
const recorder = () => {
  const calls: Array<[string, ...unknown[]]> = [];
  const observe = (paywall: Paywall): PaywallPresentation => {
    calls.push(["start", paywall.id]);
    return {
      shown: () => void calls.push(["shown", paywall.id]),
      end: (result, key) => void calls.push(["end", paywall.id, result, key ?? null]),
    };
  };
  return { observe, calls };
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let api: PaywallStepObservation;

const Probe = ({
  observe,
  paywall,
  children,
}: {
  observe: ((p: Paywall) => PaywallPresentation) | undefined;
  paywall: Paywall | null;
  children?: ReactNode;
}) => {
  api = usePaywallStepObservation(observe, paywall);
  return createElement(React.Fragment, null, children);
};

const render = async (element: React.ReactElement) => {
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(element));
};

const unmount = async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
};

afterEach(unmount);

describe("usePaywallStepObservation — start", () => {
  it("starts nothing while there is no paywall to show", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: null }));
    expect(calls).toEqual([]);
  });

  it("starts once when the paywall resolves, and not again on re-render", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: null }));
    await render(createElement(Probe, { observe, paywall: A }));
    await render(createElement(Probe, { observe, paywall: { ...A } }));
    expect(calls).toEqual([["start", "pw-a"]]);
  });
});

describe("usePaywallStepObservation — end", () => {
  it("ends dismissed on unmount without an end", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "dismissed" }, null],
    ]);
  });

  it("ends purchased with the recorded product key when a purchase advances, and not again on unmount", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.shown();
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    api.advance(undefined);
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
  });

  it("upgrades an unmount to purchased when a purchase happened but did not advance (purchase → dismiss)", async () => {
    // Spec §4.6's canonical `{type:"purchase", onSuccess:[{type:"dismiss"}]}`:
    // in a step the dismiss does not advance, so the end comes from unmount.
    // A paying user must not read as a non-conversion — same rule as
    // `present()`'s `resolvePresentedOutcome`.
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    await unmount();
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "purchased" }, "annual"]);
  });

  it("ends purchased when the outcome itself says purchased (a custom screen), with no key", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.advance({ status: "purchased" });
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "purchased" }, null]);
  });

  it("does NOT report a purchase for an advance no purchase preceded (a plain continue)", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.advance(undefined);
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "dismissed" }, null]);
  });

  it("ends error with the reason on a post-resolution failure", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.fail("parse-error");
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "parse-error" }, null],
    ]);
  });

  it("ends error paywall-disappeared when the paywall leaves the catalog mid-step, and starts afresh when one returns", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    await render(createElement(Probe, { observe, paywall: null }));
    await render(createElement(Probe, { observe, paywall: B }));
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "paywall-disappeared" }, null],
      ["start", "pw-b"],
    ]);
  });

  it("drops a purchase recorded under a previous paywall", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    await render(createElement(Probe, { observe, paywall: B }));
    api.advance(undefined);
    expect(calls[calls.length - 1]).toEqual(["end", "pw-b", { status: "dismissed" }, null]);
  });
});

describe("usePaywallStepObservation — cancelled (parity with present())", () => {
  it("ends cancelled when a purchase was cancelled and the user leaves (unmount)", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "cancelled" });
    await unmount();
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "cancelled" }, null]);
  });

  it("ends cancelled when a plain continue follows a cancelled purchase", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "cancelled" });
    api.advance(undefined);
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "cancelled" }, null]);
  });

  it("lets the LAST store outcome win, as the provider does: purchased then cancelled ends cancelled, with no key", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    api.beginPurchase()({ status: "cancelled" });
    await unmount();
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "cancelled" }, null]);
  });

  it("ignores pending and error store results, as the provider does", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "pending" });
    api.beginPurchase()({ status: "error" });
    await unmount();
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "dismissed" }, null]);
  });

  it("mirrors the headless purchaseOutcomeFromResult + resolvePresentedOutcome exactly", () => {
    const results = [
      { status: "purchased", productKey: "annual" } as const,
      { status: "cancelled" } as const,
      { status: "pending" } as const,
      { status: "error", error: new Error("x") } as const,
    ];
    const reported = [
      { status: "dismissed" } as const,
      { status: "purchased" } as const,
      { status: "cancelled" } as const,
      { status: "error", reason: "render-error" } as const,
    ];
    for (const r of results) {
      const ui = uiPurchaseOutcomeFromResult(r);
      expect(ui).toEqual(headlessPurchaseOutcomeFromResult(r));
      for (const rep of reported) {
        for (const outcome of [ui, null]) {
          expect(uiResolvePresentedOutcome(rep, outcome)).toEqual(
            headlessResolvePresentedOutcome(rep, outcome),
          );
        }
      }
    }
  });
});

describe("usePaywallStepObservation — purchase generation guard", () => {
  it("does not credit a purchase started on A to B when the variant swaps while it is in flight", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    const record = api.beginPurchase();
    await render(createElement(Probe, { observe, paywall: B }));
    record({ status: "purchased", productKey: "annual" });
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "paywall-disappeared" }, null],
      ["start", "pw-b"],
      ["end", "pw-b", { status: "dismissed" }, null],
    ]);
  });

  it("does not credit a purchase to a LATER presentation of the same paywall id", async () => {
    // Identity, not id: the same reasoning as the provider's monotonic
    // generation rather than a moment-string compare.
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    const record = api.beginPurchase();
    await render(createElement(Probe, { observe, paywall: null }));
    await render(createElement(Probe, { observe, paywall: A }));
    record({ status: "purchased", productKey: "annual" });
    await unmount();
    expect(calls[calls.length - 1]).toEqual(["end", "pw-a", { status: "dismissed" }, null]);
  });

  it("starts nothing when a purchase settles after the step unmounted", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    const record = api.beginPurchase();
    await unmount();
    const before = [...calls];
    record({ status: "purchased", productKey: "annual" });
    expect(calls).toEqual(before);
  });
});

describe("usePaywallStepObservation — older headless (no observePresentation)", () => {
  it("reports nothing and never throws when the headless predates observePresentation", async () => {
    await render(createElement(Probe, { observe: undefined, paywall: A }));
    expect(() => {
      api.shown();
      api.beginPurchase()({ status: "purchased", productKey: "annual" });
      api.advance(undefined);
      api.fail("render-error");
    }).not.toThrow();
    await unmount();
  });
});

describe("usePaywallStepObservation — render errors", () => {
  class Boundary extends Component<{ onError: () => void; children?: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch() {
      this.props.onError();
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  const Throws = (): never => {
    throw new Error("element renderer bug");
  };

  it("reports start then end(render-error) when the paywall throws on its FIRST render", async () => {
    // componentDidCatch runs in the layout phase, BEFORE the hook's own start
    // effect: the failure must still be attributed to a started presentation.
    const { observe, calls } = recorder();
    const errors = console.error;
    console.error = () => {};
    try {
      await render(
        createElement(
          Probe,
          { observe, paywall: A },
          createElement(Boundary, { onError: () => api.fail("render-error") }, createElement(Throws)),
        ),
      );
    } finally {
      console.error = errors;
    }
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "error", reason: "render-error" }, null],
    ]);
  });
});

describe("usePaywallStepObservation — StrictMode", () => {
  it("reports start, dismissed, start for the dev-only double mount, then dismissed on unmount", async () => {
    const { observe, calls } = recorder();
    await render(createElement(StrictMode, null, createElement(Probe, { observe, paywall: A })));
    await unmount();
    expect(calls.map(([n]) => n)).toEqual(["start", "end", "start", "end"]);
  });
});
