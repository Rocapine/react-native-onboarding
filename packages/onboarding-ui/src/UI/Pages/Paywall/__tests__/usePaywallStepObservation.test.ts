// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React, { Component, StrictMode, act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PaywallPresentation } from "@rocapine/react-native-onboarding";
import {
  usePaywallStepObservation,
  type PaywallStepObservation,
} from "../usePaywallStepObservation";

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
  observe: (p: Paywall) => PaywallPresentation;
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
    api.recordPurchase("annual");
    api.advance(undefined);
    await unmount();
    expect(calls).toEqual([
      ["start", "pw-a"],
      ["shown", "pw-a"],
      ["end", "pw-a", { status: "purchased" }, "annual"],
    ]);
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
    api.recordPurchase("annual");
    await render(createElement(Probe, { observe, paywall: B }));
    api.advance(undefined);
    expect(calls[calls.length - 1]).toEqual(["end", "pw-b", { status: "dismissed" }, null]);
  });
});

describe("usePaywallStepObservation — render errors", () => {
  class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
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
