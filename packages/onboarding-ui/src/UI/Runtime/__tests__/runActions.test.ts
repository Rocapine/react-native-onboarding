import { describe, it, expect, vi } from "vitest";
import { runActions, runGuardedActions } from "../elements/runActions";
import { createInFlightRegistry } from "../inFlight";
import type { RenderContext } from "../elements/shared";

/**
 * `runActions` resolves `true` when the press completed the screen and `false`
 * when it ran to the end without doing so, so the three "does not throw"
 * assertions below read `.resolves.toBe(false)` rather than `toBeUndefined()`.
 * The value exists for the recursion — see the bottom of this file.
 */
const makeCtx = (overrides: Partial<RenderContext> = {}): RenderContext => {
  const variables: Record<string, { value: string; label?: string }> = {};
  return {
    theme: {} as RenderContext["theme"],
    getVariables: () => variables,
    setVariable: (key, entry) => {
      variables[key] = entry;
    },
    onContinue: vi.fn(),
    customActions: {},
    renderChildren: () => null,
    ...overrides,
  } as RenderContext;
};

describe("runActions", () => {
  it("invokes the host continue callback for the 'continue' action", async () => {
    const onContinue = vi.fn();
    await runActions(["continue"], makeCtx({ onContinue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // 'continue' is terminal — this is what lets a paywall map it to "dismiss"
  // without later actions leaking through after the screen is gone.
  it("stops the loop after 'continue'", async () => {
    const ctx = makeCtx();
    await runActions(
      ["continue", { type: "setVariable", name: "after", value: "written" }],
      ctx
    );
    expect(ctx.getVariables().after).toBeUndefined();
  });

  it("writes a variable for the setVariable action", async () => {
    const ctx = makeCtx();
    await runActions([{ type: "setVariable", name: "plan", value: "yearly" }], ctx);
    expect(ctx.getVariables().plan.value).toBe("yearly");
  });

  it("invokes a registered custom action", async () => {
    const handler = vi.fn();
    const ctx = makeCtx({ customActions: { doThing: handler } });
    await runActions([{ type: "custom", function: "doThing" }], ctx);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("runActions — dismiss", () => {
  it("calls the host continue callback with a dismissed outcome", async () => {
    const onContinue = vi.fn();
    await runActions([{ type: "dismiss" }], makeCtx({ onContinue }));
    expect(onContinue).toHaveBeenCalledWith({ status: "dismissed" });
  });

  // Same structural guarantee as "continue" — a paywall host relies on nothing
  // running after the screen is gone.
  it("stops the loop after 'dismiss'", async () => {
    const ctx = makeCtx();
    await runActions(
      [{ type: "dismiss" }, { type: "setVariable", name: "after", value: "written" }],
      ctx
    );
    expect(ctx.getVariables().after).toBeUndefined();
  });
});

describe("runActions — presentPaywall", () => {
  // An authoring mistake (no host support) must warn loudly, not crash the
  // host app mid-flow.
  it("warns and does not throw when the host has no presentPaywall handler", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      runActions([{ type: "presentPaywall", placement: "hard_paywall" }], makeCtx())
    ).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("calls the host's presentPaywall with the placement when supported", async () => {
    const presentPaywall = vi.fn();
    const ctx = makeCtx({ presentPaywall });
    await runActions([{ type: "presentPaywall", placement: "hard_paywall" }], ctx);
    expect(presentPaywall).toHaveBeenCalledWith("hard_paywall");
  });

  it("does not stop the loop after 'presentPaywall'", async () => {
    const ctx = makeCtx({ presentPaywall: vi.fn() });
    await runActions(
      [
        { type: "presentPaywall", placement: "hard_paywall" },
        { type: "setVariable", name: "after", value: "written" },
      ],
      ctx
    );
    expect(ctx.getVariables().after.value).toBe("written");
  });
});

const makeProducts = (over: Partial<any> = {}) => ({
  products: {
    yearly: { key: "yearly", productId: "com.app.yearly", price: "$59.99" },
  },
  status: "ready" as const,
  purchasing: false,
  purchase: vi.fn(async () => ({ status: "purchased" as const, productKey: "yearly" })),
  restore: vi.fn(async () => ({ status: "restored" as const, entitlements: ["pro"] })),
  ...over,
});

describe("runActions — purchase", () => {
  it("purchases the named product key", async () => {
    const products = makeProducts();
    await runActions([{ type: "purchase", product: "yearly" }], makeCtx({ products } as any));
    expect(products.purchase).toHaveBeenCalledWith("yearly");
  });

  it("interpolates the product key so a RadioGroup can drive it", async () => {
    const products = makeProducts();
    const ctx = makeCtx({ products } as any);
    ctx.setVariable("plan", { value: "yearly" });
    await runActions([{ type: "purchase", product: "{{plan}}" }], ctx);
    expect(products.purchase).toHaveBeenCalledWith("yearly");
  });

  // Regression: a RadioGroup item's `value` ("yearly") and `label` ("Yearly")
  // commonly differ — the standard authoring pattern (see
  // `onboarding-example.ts`'s `hero-radio`). `product: "{{plan}}"` must
  // resolve the KEY, not the display label, or the purchase silently fails to
  // find a matching product no matter what the user selected.
  it("resolves the product key by value, not by label, when they differ", async () => {
    const products = makeProducts();
    const ctx = makeCtx({ products } as any);
    ctx.setVariable("plan", { value: "yearly", label: "Yearly" });
    await runActions([{ type: "purchase", product: "{{plan}}" }], ctx);
    expect(products.purchase).toHaveBeenCalledWith("yearly");
  });

  it("runs onSuccess actions after a purchase", async () => {
    const ctx = makeCtx({ products: makeProducts() } as any);
    await runActions(
      [{ type: "purchase", product: "yearly", onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }] }],
      ctx
    );
    expect(ctx.getVariables().bought.value).toBe("yes");
  });

  it("runs onCancel — not onSuccess — when the user cancels", async () => {
    const products = makeProducts({ purchase: vi.fn(async () => ({ status: "cancelled" as const })) });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{
        type: "purchase", product: "yearly",
        onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }],
        onCancel: [{ type: "setVariable", name: "bailed", value: "yes" }],
      }],
      ctx
    );
    expect(ctx.getVariables().bought).toBeUndefined();
    expect(ctx.getVariables().bailed.value).toBe("yes");
  });

  // "pending" is not an edge case on every path: a Stripe Payment Link purchase
  // ALWAYS resolves pending, because the browser takes over and nothing is
  // confirmed yet. So an author must be able to react to it — before
  // `onPending` existed, a Stripe buy button could not dismiss the paywall or
  // navigate, and the user came back from Safari to an untouched screen.
  it("runs onPending when the purchase is pending", async () => {
    const products = makeProducts({ purchase: vi.fn(async () => ({ status: "pending" as const })) });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [
        {
          type: "purchase",
          product: "yearly",
          onPending: [{ type: "setVariable", name: "awaiting", value: "yes" }],
          onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }],
        },
      ],
      ctx
    );
    expect(ctx.getVariables().awaiting.value).toBe("yes");
    // Pending is NOT success — a deferred or link-out purchase is unconfirmed,
    // so onSuccess must stay untouched or the UI grants access unpaid.
    expect(ctx.getVariables().bought).toBeUndefined();
  });

  // Kept from before `onPending`: silence is the wrong default for a purchase
  // that is genuinely in flight, so an undeclared hook still warns.
  it("warns when the purchase is pending and no onPending is declared", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const products = makeProducts({ purchase: vi.fn(async () => ({ status: "pending" as const })) });
    const ctx = makeCtx({ products } as any);
    await expect(
      runActions(
        [{ type: "purchase", product: "yearly", onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }] }],
        ctx
      )
    ).resolves.toBe(false);
    expect(ctx.getVariables().bought).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // The other three branches must not have been re-routed by adding a fourth.
  it("still routes purchased/cancelled/error to their own hooks, not onPending", async () => {
    for (const [status, hook] of [
      ["purchased", "onSuccess"],
      ["cancelled", "onCancel"],
      ["error", "onError"],
    ] as const) {
      const products = makeProducts({
        purchase: vi.fn(async () => ({ status, ...(status === "error" ? { error: new Error("x") } : {}) }) as any),
      });
      const ctx = makeCtx({ products } as any);
      await runActions(
        [
          {
            type: "purchase",
            product: "yearly",
            [hook]: [{ type: "setVariable", name: "hit", value: hook }],
            onPending: [{ type: "setVariable", name: "hit", value: "onPending" }],
          } as any,
        ],
        ctx
      );
      expect(ctx.getVariables().hit.value).toBe(hook);
    }
  });

  // Without a provider the action must be inert and loud, never a silent no-op
  // that looks like a working buy button.
  it("warns and does not throw when no product runtime is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      runActions([{ type: "purchase", product: "yearly" }], makeCtx())
    ).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns when the product key is not among the resolved products", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const products = makeProducts();
    await runActions([{ type: "purchase", product: "nope" }], makeCtx({ products } as any));
    expect(products.purchase).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // A real host (no productProvider configured) still publishes a runtime whose
  // purchase/restore resolve {status:"error"} — the `!ctx.products` guard above
  // never fires there. Without this warn, a store-level failure with no `onError`
  // declared was a completely silent no-op.
  it("warns with the underlying error when purchase fails and no onError is declared", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = new Error("boom");
    const products = makeProducts({ purchase: vi.fn(async () => ({ status: "error" as const, error: boom })) });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{ type: "purchase", product: "yearly", onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }] }],
      ctx
    );
    expect(ctx.getVariables().bought).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("purchase"), boom);
    warn.mockRestore();
  });

  it("runs onError — and does not warn — when purchase fails with onError declared", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const products = makeProducts({
      purchase: vi.fn(async () => ({ status: "error" as const, error: new Error("boom") })),
    });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{
        type: "purchase", product: "yearly",
        onError: [{ type: "setVariable", name: "failed", value: "yes" }],
      }],
      ctx
    );
    expect(ctx.getVariables().failed.value).toBe("yes");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("runActions — restore", () => {
  it("restores and runs onSuccess", async () => {
    const products = makeProducts();
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{ type: "restore", onSuccess: [{ type: "setVariable", name: "restored", value: "yes" }] }],
      ctx
    );
    expect(products.restore).toHaveBeenCalled();
    expect(ctx.getVariables().restored.value).toBe("yes");
  });

  it("runs onNothingToRestore when there was nothing to restore", async () => {
    const products = makeProducts({
      restore: vi.fn(async () => ({ status: "nothing_to_restore" as const })),
    });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{
        type: "restore",
        onSuccess: [{ type: "setVariable", name: "restored", value: "yes" }],
        onNothingToRestore: [{ type: "setVariable", name: "none", value: "yes" }],
      }],
      ctx
    );
    expect(ctx.getVariables().restored).toBeUndefined();
    expect(ctx.getVariables().none.value).toBe("yes");
  });

  it("warns with the underlying error when restore fails and no onError is declared", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = new Error("boom");
    const products = makeProducts({ restore: vi.fn(async () => ({ status: "error" as const, error: boom })) });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{ type: "restore", onSuccess: [{ type: "setVariable", name: "restored", value: "yes" }] }],
      ctx
    );
    expect(ctx.getVariables().restored).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("restore"), boom);
    warn.mockRestore();
  });

  it("runs onError — and does not warn — when restore fails with onError declared", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const products = makeProducts({
      restore: vi.fn(async () => ({ status: "error" as const, error: new Error("boom") })),
    });
    const ctx = makeCtx({ products } as any);
    await runActions(
      [{ type: "restore", onError: [{ type: "setVariable", name: "failed", value: "yes" }] }],
      ctx
    );
    expect(ctx.getVariables().failed.value).toBe("yes");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("runActions — a failing expression must not kill the action list", () => {
  // The whole point of degrading a broken expression to a warning plus "" is
  // that the press survives it. An exception thrown by the evaluator escapes
  // here instead: `ButtonElement` awaits `runActions` inside an async onPress
  // and `renderElement` calls `void runActions(...)`, so nothing catches it and
  // a Continue button carrying a bad expression becomes a dead button with no
  // console output at all — later actions never run and the host never
  // advances. This pins the observable consequence, not just the return value.
  it("keeps writing later variables and still continues after a bad expression", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onContinue = vi.fn();
    const ctx = makeCtx({ onContinue });

    await runActions(
      [
        { type: "setVariable", name: "before", value: "written" },
        {
          type: "setVariable",
          name: "goalDate",
          // A units mistake: seconds where days were meant. The resulting
          // instant is outside the representable Date range.
          value: 'addDays("now", 90 * 365 * 24 * 60 * 60)',
          valueMode: "expression",
        },
        { type: "setVariable", name: "after", value: "written" },
        "continue",
      ],
      ctx
    );

    expect(ctx.getVariables().before?.value).toBe("written");
    expect(ctx.getVariables().goalDate?.value).toBe("");
    expect(ctx.getVariables().after?.value).toBe("written");
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

/**
 * Terminal propagation out of a nested branch list (review round 1, finding 4).
 *
 * `runActions` recurses for every branch hook — `purchase.onSuccess`,
 * `restore.onNothingToRestore`, `requestPermission.onGranted` — and the first
 * version let the OUTER `for` carry on after the recursion returned. A trailing
 * `"continue"` after any of them therefore called `onContinue` twice: a
 * duplicate `router.push` in the example host, and a silently skipped screen in
 * a host that advances by incrementing an index.
 *
 * Fixed once, centrally, for every branching action rather than only for the
 * one the review found it through — the defect is in the recursion, not in
 * `requestPermission`.
 */
describe("runActions — a terminal nested action ends the whole press", () => {
  it("advances once for purchase.onSuccess followed by a trailing continue", async () => {
    const onContinue = vi.fn();
    const ctx = makeCtx({ onContinue, products: makeProducts() } as any);
    await runActions(
      [
        { type: "purchase", product: "yearly", onSuccess: ["continue"] },
        "continue",
      ] as never,
      ctx
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("stops the outer list after a nested dismiss", async () => {
    const onContinue = vi.fn();
    const ctx = makeCtx({ onContinue, products: makeProducts() } as any);
    await runActions(
      [
        { type: "purchase", product: "yearly", onSuccess: [{ type: "dismiss" }] },
        { type: "setVariable", name: "after", value: "written" },
      ] as never,
      ctx
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({ status: "dismissed" });
    expect(ctx.getVariables().after).toBeUndefined();
  });

  it("advances once for restore.onSuccess followed by a trailing continue", async () => {
    const onContinue = vi.fn();
    const ctx = makeCtx({ onContinue, products: makeProducts() } as any);
    await runActions(
      [{ type: "restore", onSuccess: ["continue"] }, "continue"] as never,
      ctx
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // A non-terminal hook must still leave the rest of the list running — the
  // stop is about `continue`/`dismiss`, not about "a hook ran".
  it("keeps running the outer list when the nested hook is not terminal", async () => {
    const ctx = makeCtx({ products: makeProducts() } as any);
    await runActions(
      [
        {
          type: "purchase",
          product: "yearly",
          onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }],
        },
        { type: "setVariable", name: "after", value: "written" },
      ] as never,
      ctx
    );
    expect(ctx.getVariables().bought.value).toBe("yes");
    expect(ctx.getVariables().after.value).toBe("written");
  });

  it("reports whether the press completed the screen", async () => {
    await expect(runActions(["continue"], makeCtx())).resolves.toBe(true);
    await expect(runActions([{ type: "dismiss" }], makeCtx())).resolves.toBe(true);
    await expect(
      runActions([{ type: "setVariable", name: "a", value: "b" }], makeCtx())
    ).resolves.toBe(false);
  });
});

/**
 * Review round 2, finding 2 — the OTHER half of the return contract.
 *
 * A `custom` handler that throws has always aborted the rest of ITS list: the
 * host's code failed, so the actions the author sequenced after it are running
 * on a state nobody can vouch for. Round 1's propagation fix accidentally
 * widened that to the whole press, and the two are not the same thing. A
 * throwing analytics call in `purchase.onSuccess` would then eat the trailing
 * `"continue"` and strand a user who had ALREADY PAID on the paywall, with
 * re-pressing re-running `purchase()`.
 *
 * So: a terminal action propagates outward (the screen really is gone), an
 * abort does not (the screen is still there, and an outer escape is still the
 * author's). `false` from the recursion says "not completed", which is the only
 * thing the outer loop needs to know.
 */
describe("runActions — a throwing custom handler aborts its own list only", () => {
  it("still runs a trailing continue after a nested handler throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    const ctx = makeCtx({
      onContinue,
      products: makeProducts(),
      customActions: {
        logPurchase: () => {
          throw new Error("analytics not initialised");
        },
      },
    } as any);
    await runActions(
      [
        {
          type: "purchase",
          product: "yearly",
          onSuccess: [{ type: "custom", function: "logPurchase" }],
        },
        "continue",
      ] as never,
      ctx
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("keeps running the outer list after a nested handler throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({
      products: makeProducts(),
      customActions: {
        logPurchase: () => {
          throw new Error("boom");
        },
        trackPurchase: vi.fn(),
      },
    } as any);
    await runActions(
      [
        {
          type: "purchase",
          product: "yearly",
          onSuccess: [{ type: "custom", function: "logPurchase" }],
        },
        { type: "custom", function: "trackPurchase" },
      ] as never,
      ctx
    );
    expect(ctx.customActions.trackPurchase).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  // Unchanged, and the reason the abort exists at all: within one list, nothing
  // after a thrown handler runs.
  it("does not run the rest of its own list after throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({
      customActions: {
        boom: () => {
          throw new Error("boom");
        },
      },
    });
    await expect(
      runActions(
        [
          { type: "custom", function: "boom" },
          { type: "setVariable", name: "after", value: "written" },
        ] as never,
        ctx
      )
    ).resolves.toBe(false);
    expect(ctx.getVariables().after).toBeUndefined();
    error.mockRestore();
  });
});

// ── RNO#191 — declarative async gate ────────────────────────────────────────
//
// `custom` gets the nested-`ButtonAction[]` outcome hooks `purchase`/`restore`
// already carry, plus a bounded retry. The one deliberate divergence from
// `purchase` is documented on each test below: an error is TERMINAL for the
// outer list whether or not `onError` is declared, because "log and abort" is
// the behaviour the absent-hook case has to keep and quietly falling through
// into a trailing `"continue"` after a failed generation is worse than
// stopping.

describe("runActions — custom onResolve", () => {
  it("runs onResolve after the handler resolves", async () => {
    const ctx = makeCtx({ customActions: { generatePlan: vi.fn(async () => {}) } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          onResolve: [{ type: "setVariable", name: "planReady", value: "yes" }],
        },
      ],
      ctx
    );
    expect(ctx.getVariables().planReady?.value).toBe("yes");
  });

  it("does not run onResolve when the handler throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({
      customActions: {
        generatePlan: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          onResolve: [{ type: "setVariable", name: "planReady", value: "yes" }],
        },
      ],
      ctx
    );
    expect(ctx.getVariables().planReady).toBeUndefined();
    error.mockRestore();
  });

  // onResolve is NOT terminal — the success path is the ordinary one, and the
  // list carries on exactly as it does today for a handler with no hooks.
  it("continues the outer list after onResolve", async () => {
    const onContinue = vi.fn();
    const ctx = makeCtx({
      onContinue,
      customActions: { generatePlan: vi.fn(async () => {}) },
    });
    await runActions(
      [
        { type: "custom", function: "generatePlan", onResolve: [] },
        "continue",
      ],
      ctx
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("runActions — custom onError", () => {
  it("runs onError when the handler throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({
      customActions: {
        generatePlan: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          onError: [{ type: "setVariable", name: "planError", value: "true" }],
        },
      ],
      ctx
    );
    expect(ctx.getVariables().planError?.value).toBe("true");
    error.mockRestore();
  });

  // The divergence from `purchase`: a declared onError replaces the silence,
  // not the abort. A trailing "continue" after a failed generation would send
  // the user to a screen that reads a variable the handler never wrote.
  it("aborts the rest of the outer list after onError", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    const ctx = makeCtx({
      onContinue,
      customActions: {
        generatePlan: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          onError: [{ type: "setVariable", name: "planError", value: "true" }],
        },
        "continue",
      ],
      ctx
    );
    expect(ctx.getVariables().planError?.value).toBe("true");
    expect(onContinue).not.toHaveBeenCalled();
    error.mockRestore();
  });

  // Pre-#191 behaviour, pinned: no hook means log and abort.
  it("still logs and aborts when no onError is declared", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    const ctx = makeCtx({
      onContinue,
      customActions: {
        generatePlan: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    await runActions(
      [{ type: "custom", function: "generatePlan" }, "continue"],
      ctx
    );
    expect(onContinue).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("runActions — custom bounded retry", () => {
  it("calls the handler once when no retry is declared", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    await runActions(
      [{ type: "custom", function: "generatePlan" }],
      makeCtx({ customActions: { generatePlan: handler } })
    );
    expect(handler).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("retries up to the attempt cap and then gives up", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const ctx = makeCtx({ customActions: { generatePlan: handler } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 3 },
          onError: [{ type: "setVariable", name: "planError", value: "true" }],
        },
      ],
      ctx
    );
    expect(handler).toHaveBeenCalledTimes(3);
    expect(ctx.getVariables().planError?.value).toBe("true");
    error.mockRestore();
    warn.mockRestore();
  });

  it("stops retrying as soon as an attempt resolves", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let attempts = 0;
    const handler = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient");
    });
    const ctx = makeCtx({ customActions: { generatePlan: handler } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 5 },
          onResolve: [{ type: "setVariable", name: "planReady", value: "yes" }],
          onError: [{ type: "setVariable", name: "planError", value: "true" }],
        },
      ],
      ctx
    );
    expect(handler).toHaveBeenCalledTimes(3);
    expect(ctx.getVariables().planReady?.value).toBe("yes");
    expect(ctx.getVariables().planError).toBeUndefined();
    warn.mockRestore();
  });

  it("waits between attempts when delayMs is set", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const started = Date.now();
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 3, delayMs: 20 },
        },
      ],
      makeCtx({ customActions: { generatePlan: handler } })
    );
    // Two gaps between three attempts.
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
    expect(handler).toHaveBeenCalledTimes(3);
    error.mockRestore();
    warn.mockRestore();
  });
});

describe("runGuardedActions — one press at a time per element (#191)", () => {
  // Real registry, not a mock: the guard is only worth anything if the
  // synchronous claim and the async action list actually compose.
  const makeGuardedCtx = (customActions: RenderContext["customActions"]) => {
    const registry = createInFlightRegistry(() => {});
    return makeCtx({
      customActions,
      beginActions: registry.claim,
      endActions: registry.release,
    } as Partial<RenderContext>);
  };

  it("ignores a second press while the first is still awaiting", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const handler = vi.fn(async () => {
      await gate;
    });
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    const first = runGuardedActions("cta", actions, ctx);
    await runGuardedActions("cta", actions, ctx); // second tap, mid-flight
    expect(handler).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it("accepts a press again once the first has finished", async () => {
    const handler = vi.fn(async () => {});
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    await runGuardedActions("cta", actions, ctx);
    await runGuardedActions("cta", actions, ctx);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  // A handler that rejects must not leave the button permanently dead. The
  // release lives in a `finally` for exactly this.
  it("releases the slot when the action list throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    await runGuardedActions("cta", actions, ctx);
    await runGuardedActions("cta", actions, ctx);
    expect(handler).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("does not block a different element's press", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const handler = vi.fn(async () => {
      await gate;
    });
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    const first = runGuardedActions("cta", actions, ctx);
    void runGuardedActions("secondary", actions, ctx);
    expect(handler).toHaveBeenCalledTimes(2);

    release();
    await first;
  });
});
