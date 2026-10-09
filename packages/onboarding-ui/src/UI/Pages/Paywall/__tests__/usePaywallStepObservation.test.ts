// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React, { Component, StrictMode, act, createElement, useEffect, type ReactNode } from "react";
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

type FocusEffect = (effect: () => void | (() => void)) => void;

/**
 * A controllable `navigation.useFocusEffect`, with expo-router's semantics:
 * the effect runs on focus (and on mount while focused), its cleanup on blur
 * and on unmount. `blur()`/`focus()` model a push-based Stack, where an
 * advanced step stays MOUNTED underneath the next one and is focused again on
 * back (r1-5).
 */
const focusController = () => {
  let effect: (() => void | (() => void)) | null = null;
  let cleanup: void | (() => void);
  let focused = true;
  const runCleanup = () => {
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
  };
  const useFocusEffect: FocusEffect = (e) => {
    effect = e;
    useEffect(() => {
      if (focused) cleanup = e();
      return runCleanup;
    }, [e]);
  };
  return {
    useFocusEffect,
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

const Probe = ({
  observe,
  paywall,
  renderable = false,
  useFocusEffect,
  children,
}: {
  observe: ((p: Paywall) => PaywallPresentation) | undefined;
  paywall: Paywall | null;
  renderable?: boolean;
  useFocusEffect?: FocusEffect;
  children?: ReactNode;
}) => {
  api = usePaywallStepObservation(observe, paywall, { renderable, useFocusEffect });
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
    await render(createElement(Probe, { observe, paywall: A, renderable: true }));
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

  it("keeps ONE presentation when the moment's variant swaps mid-step, as present() does (r1-1)", async () => {
    // `PaywallProvider` ends a presentation only when its paywall becomes null
    // (`PaywallProvider.tsx:703-706`); a different id under the same moment
    // leaves it open. A step visit is one presentation for the same reason.
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    await render(createElement(Probe, { observe, paywall: B }));
    api.advance(undefined);
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
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
  it("records a purchase still in flight when the variant swaps, so the conversion is reported (r1-1)", async () => {
    // The reviewer's sequence: buy on A, a re-key swaps the moment to B while
    // the store sheet is open, the store says purchased, onSuccess continues.
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A }));
    const record = api.beginPurchase();
    await render(createElement(Probe, { observe, paywall: B }));
    record({ status: "purchased", productKey: "annual" });
    api.advance(undefined);
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
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

describe("usePaywallStepObservation — nothing after the step is gone (r1-2)", () => {
  it("reports nothing for an advance, fail or purchase that arrives after unmount", async () => {
    // The real runtime: a purchase settles after unmount, `record` is dropped,
    // then onSuccess `continue` reaches `complete()` -> `advance()` through a
    // stale closure. A custom screen's stale `complete({status:"purchased"})`
    // takes the same path.
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A, renderable: true }));
    const record = api.beginPurchase();
    await unmount();
    const before = [...calls];
    record({ status: "purchased", productKey: "annual" });
    api.advance(undefined);
    api.advance({ status: "purchased" });
    api.fail("render-error");
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    expect(calls).toEqual(before);
  });

  it("reports nothing for a late advance while the step is blurred under the next one", async () => {
    const { observe, calls } = recorder();
    const nav = focusController();
    await render(createElement(Probe, { observe, paywall: A, useFocusEffect: nav.useFocusEffect }));
    await nav.blur();
    const before = [...calls];
    api.advance({ status: "purchased" });
    expect(calls).toEqual(before);
  });
});

describe("usePaywallStepObservation — focus: one presentation per VISIT (r1-5)", () => {
  it("starts a fresh presentation when an advanced step is focused again, and records a purchase there", async () => {
    // A push-based Stack keeps the advanced step mounted; back focuses it
    // again. `present()` would open a new presentation for a second showing.
    const { observe, calls } = recorder();
    const nav = focusController();
    await render(
      createElement(Probe, { observe, paywall: A, renderable: true, useFocusEffect: nav.useFocusEffect }),
    );
    api.advance(undefined); // a plain continue, then router.push
    await nav.blur();
    await nav.focus(); // the user swipes back
    api.beginPurchase()({ status: "purchased", productKey: "annual" });
    api.advance(undefined);
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "dismissed" }, null],
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
  });

  it("ends an open presentation dismissed on blur, upgraded to the store outcome", async () => {
    const { observe, calls } = recorder();
    const nav = focusController();
    await render(createElement(Probe, { observe, paywall: A, useFocusEffect: nav.useFocusEffect }));
    api.beginPurchase()({ status: "cancelled" });
    await nav.blur(); // still mounted: the end must come from the blur itself
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["end", "pw-a", { status: "cancelled" }, null],
    ]);
    await unmount();
    expect(calls).toHaveLength(2);
  });

  it("does not end and restart on a re-render (an unmemoized effect would)", async () => {
    const { observe, calls } = recorder();
    const nav = focusController();
    await render(createElement(Probe, { observe, paywall: A, useFocusEffect: nav.useFocusEffect }));
    await render(createElement(Probe, { observe, paywall: { ...A }, useFocusEffect: nav.useFocusEffect }));
    await render(
      createElement(Probe, { observe: (p) => observe(p), paywall: A, useFocusEffect: nav.useFocusEffect }),
    );
    expect(calls).toEqual([["start", "pw-a"]]);
  });
});

describe("usePaywallStepObservation — shown", () => {
  it("reports shown once the content is renderable, once per presentation", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A, renderable: false }));
    await render(createElement(Probe, { observe, paywall: A, renderable: true }));
    await render(createElement(Probe, { observe, paywall: B, renderable: true }));
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
    ]);
  });

  it("never reports shown for content that is not renderable", async () => {
    const { observe, calls } = recorder();
    await render(createElement(Probe, { observe, paywall: A, renderable: false }));
    api.fail("parse-error");
    await unmount();
    expect(calls.map(([n]) => n)).toEqual(["start", "end"]);
  });
});

describe("usePaywallStepObservation — older headless (no observePresentation)", () => {
  it("reports nothing and never throws when the headless predates observePresentation", async () => {
    await render(createElement(Probe, { observe: undefined, paywall: A }));
    expect(() => {
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
