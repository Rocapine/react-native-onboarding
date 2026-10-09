import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  openPaywallPresentation,
  type PaywallObserver,
  type PaywallPresentationSource,
} from "../observer";

const PAYWALL: PaywallPresentationSource = {
  id: "pw-1",
  moment: "onboarding_end",
  audienceId: 42,
  billing: "store",
  products: [
    { key: "annual", ios: "com.app.annual.ios", android: "com.app.annual.android" },
    { key: "monthly", ios: "com.app.monthly" },
  ],
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

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("openPaywallPresentation — the info handed to start()", () => {
  it("stringifies audienceId, defaults renderMode to elements, and names the surface", () => {
    const { observer, calls } = recordingObserver();
    openPaywallPresentation(observer, PAYWALL, "present", "ios");
    expect(calls).toEqual([
      [
        "start",
        {
          moment: "onboarding_end",
          paywallId: "pw-1",
          audienceId: "42",
          renderMode: "elements",
          billing: "store",
          surface: "present",
        },
      ],
    ]);
    // variantKey, deploymentId and onboardingRun stay UNSET, not undefined-valued.
    const info = calls[0][1] as Record<string, unknown>;
    expect(Object.keys(info)).not.toContain("variantKey");
    expect(Object.keys(info)).not.toContain("deploymentId");
    expect(Object.keys(info)).not.toContain("onboardingRun");
  });

  it("keeps a null audienceId null, passes renderMode custom through, and defaults a missing billing to store", () => {
    const { observer, calls } = recordingObserver();
    openPaywallPresentation(
      observer,
      { id: "pw-2", moment: "m", audienceId: null, renderMode: "custom" },
      "paywall_step",
      "android"
    );
    expect(calls[0][1]).toMatchObject({
      audienceId: null,
      renderMode: "custom",
      billing: "store",
      surface: "paywall_step",
    });
  });
});

describe("openPaywallPresentation — once-guards", () => {
  it("calls end() exactly once, however often it is asked", () => {
    const { observer, calls } = recordingObserver();
    const p = openPaywallPresentation(observer, PAYWALL, "present", "ios");
    p.end({ status: "dismissed" });
    p.end({ status: "error", reason: "render-error" });
    p.end({ status: "purchased" }, "annual");
    expect(calls.filter(([n]) => n === "end")).toEqual([["end", { status: "dismissed" }]]);
  });

  it("calls shown() at most once, and never after end()", () => {
    const { observer, calls } = recordingObserver();
    const p = openPaywallPresentation(observer, PAYWALL, "present", "ios");
    p.shown();
    p.shown();
    expect(calls.filter(([n]) => n === "shown")).toHaveLength(1);

    const { observer: o2, calls: c2 } = recordingObserver();
    const q = openPaywallPresentation(o2, PAYWALL, "present", "ios");
    q.end({ status: "dismissed" });
    q.shown();
    expect(c2.map(([n]) => n)).toEqual(["start", "end"]);
  });
});

describe("openPaywallPresentation — the outcome handed to end()", () => {
  it("forwards an error reason as a string and sends no transaction", () => {
    const { observer, calls } = recordingObserver();
    openPaywallPresentation(observer, PAYWALL, "present", "ios").end({
      status: "error",
      reason: "host-never-presented",
    });
    expect(calls[1]).toEqual(["end", { status: "error", reason: "host-never-presented" }]);
  });

  it("resolves a purchase's productId from the purchased slot for the running platform", () => {
    const ios = recordingObserver();
    openPaywallPresentation(ios.observer, PAYWALL, "present", "ios").end({ status: "purchased" }, "annual");
    expect(ios.calls[1]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.annual.ios" } },
    ]);

    const android = recordingObserver();
    openPaywallPresentation(android.observer, PAYWALL, "present", "android").end(
      { status: "purchased" },
      "annual"
    );
    expect(android.calls[1]).toEqual([
      "end",
      { status: "purchased", transaction: { productId: "com.app.annual.android" } },
    ]);
  });

  it("omits transaction entirely when no id resolves (unknown key, empty platform slot, web, no key)", () => {
    for (const [key, platform] of [
      ["nope", "ios"],
      ["monthly", "android"],
      ["annual", "web"],
      [undefined, "ios"],
    ] as const) {
      const { observer, calls } = recordingObserver();
      openPaywallPresentation(observer, PAYWALL, "present", platform).end({ status: "purchased" }, key);
      expect(calls[1]).toEqual(["end", { status: "purchased" }]);
    }
  });

  it("never sends a transaction with a status other than purchased", () => {
    const { observer, calls } = recordingObserver();
    openPaywallPresentation(observer, PAYWALL, "present", "ios").end({ status: "cancelled" }, "annual");
    expect(calls[1]).toEqual(["end", { status: "cancelled" }]);
  });
});

describe("openPaywallPresentation — a hostile observer cannot hurt the caller", () => {
  it("is a silent no-op with no observer at all", () => {
    const p = openPaywallPresentation(undefined, PAYWALL, "present", "ios");
    expect(() => {
      p.shown();
      p.end({ status: "dismissed" });
    }).not.toThrow();
  });

  it("accepts a start() that returns void, or a non-handle", () => {
    for (const returned of [undefined, null, 42, "x", {}, { shown: 1, end: 2 }]) {
      const observer = { start: () => returned } as unknown as PaywallObserver;
      const p = openPaywallPresentation(observer, PAYWALL, "present", "ios");
      expect(() => {
        p.shown();
        p.end({ status: "dismissed" });
      }).not.toThrow();
    }
  });

  it("swallows a throw from start(), shown() and end()", () => {
    const boom = () => {
      throw new Error("observer bug");
    };
    const throwingStart = { start: boom } as unknown as PaywallObserver;
    expect(() => openPaywallPresentation(throwingStart, PAYWALL, "present", "ios")).not.toThrow();

    const throwingHandle: PaywallObserver = { start: () => ({ shown: boom, end: boom }) };
    const p = openPaywallPresentation(throwingHandle, PAYWALL, "present", "ios");
    expect(() => {
      p.shown();
      p.end({ status: "dismissed" });
    }).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("tolerates an observer that is not an object, or whose start is not a function", () => {
    for (const observer of [42, "x", {}, { start: "nope" }]) {
      expect(() =>
        openPaywallPresentation(observer as unknown as PaywallObserver, PAYWALL, "present", "ios").end({
          status: "dismissed",
        })
      ).not.toThrow();
    }
  });

  it("swallows a rejected promise returned by an async observer", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const observer = {
        start: () => ({
          shown: () => Promise.reject(new Error("async shown")),
          end: () => Promise.reject(new Error("async end")),
        }),
      } as unknown as PaywallObserver;
      const p = openPaywallPresentation(observer, PAYWALL, "present", "ios");
      p.shown();
      p.end({ status: "dismissed" });
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
