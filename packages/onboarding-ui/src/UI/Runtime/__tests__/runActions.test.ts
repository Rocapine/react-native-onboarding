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
 * `true` from the recursion means THE SCREEN IS GONE, and a failed handler
 * leaves it very much present. Round 1's propagation fix briefly conflated the
 * two: a throwing analytics call in `purchase.onSuccess` returned `true` and
 * ate the trailing `"continue"`, stranding a user who had ALREADY PAID on the
 * paywall, with re-pressing re-running `purchase()`.
 *
 * So a terminal action propagates outward and a failure does not — `false` says
 * "not completed", which is the only thing the outer loop needs to know. Since
 * the semantics decision on #191 a failure does not stop the enclosing list
 * either (see the `custom onError` block below); this block is about the return
 * VALUE, which is unchanged.
 */
describe("runActions — a failed custom handler never reports the screen complete", () => {
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

  // Semantics decision 1 (#191, 2026-09-11) INVERTED this one: the rest of the
  // list used to be dropped, and now runs. The return value is what did not
  // move — `false`, because nothing completed the screen — which is the whole
  // point of keeping the two apart.
  it("runs the rest of its own list after throwing, still reporting false", async () => {
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
    expect(ctx.getVariables().after?.value).toBe("written");
    error.mockRestore();
  });
});

// ── RNO#191 — declarative async gate ────────────────────────────────────────
//
// `custom` gets the nested-`ButtonAction[]` outcome hooks `purchase`/`restore`
// already carry, plus a bounded retry. There is NO divergence from `purchase`
// left: a failure runs `onError` and the enclosing list carries on, whether the
// handler threw, never settled, or was never registered (semantics decisions 1
// and 2, recorded on #191 on 2026-09-11; #266 is the ticket). What must only
// run on success goes in `onResolve` — that, not an abort, is how an author
// keeps a trailing `"continue"` off the failure path.

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

  // Decision 1, and the assertion that used to read `not.toHaveBeenCalled()`.
  // A declared `onError` replaces the silence; it stops nothing. The reason the
  // abort went: `custom` was the only action in the union where a declared
  // error hook dropped the rest of the list, so two spellings of "on error"
  // behaved differently with no signal anywhere (#266).
  it("keeps running the outer list after onError", async () => {
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
    expect(onContinue).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  // An escaping `onError` beside a trailing `"continue"` is the double-fire
  // shape #266 named as the hazard this decision imports from `purchase`. It
  // does not fire twice, because the recursion propagates: `onError`'s
  // `"continue"` returns `true` and the outer loop stops there.
  it("does not complete twice when onError escapes and a continue trails it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        { type: "custom", function: "generatePlan", onError: ["continue"] },
        "continue",
      ],
      makeCtx({
        onContinue,
        customActions: {
          generatePlan: vi.fn(async () => {
            throw new Error("boom");
          }),
        },
      })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  // Pre-#191 behaviour, restored by decision 1: no hook means log and move on,
  // so `[{custom}, "continue"]` — the only `custom` shape Studio can author
  // until `rocapine/onboarding-studio#288` lands — stays navigable whatever the
  // handler does.
  it("still logs, and lets a trailing continue advance, with no onError declared", async () => {
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
    expect(onContinue).toHaveBeenCalledTimes(1);
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

/**
 * RNO#264 — `retry.timeoutMs` bounds ONE attempt's duration.
 *
 * The bug it closes is a DEAD screen, not a slow one: a handler whose promise
 * never settles is awaited while `runGuardedActions` holds the single-flight
 * claim, so `actions.pending.<elementId>` reads `"true"` for the life of the
 * screen — and the payload the docs recommend disables the CTA on exactly that,
 * with no back chevron on a `displayProgressHeader: false` step. Neither
 * `onResolve` nor `onError` ever ran.
 *
 * The timeouts below are milliseconds where the schema's floor is 1000ms:
 * `runActions` does not re-validate its input (nothing in this file is parsed),
 * and a suite that waited a real second per case would be paid for on every CI
 * run. The floor is asserted where it lives, in
 * `packages/onboarding/src/__tests__/customActionHooks.test.ts`.
 */
describe("runActions — custom per-attempt timeout (#264)", () => {
  /** The shape of the bug: a promise nobody will ever settle. */
  const hangs = () => new Promise<void>(() => {});

  it("treats an attempt that never settles as a failure and runs onError", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({ customActions: { generatePlan: vi.fn(hangs) } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 1, timeoutMs: 20 },
          onError: [{ type: "setVariable", name: "planError", value: "true" }],
        },
      ] as never,
      ctx
    );
    expect(ctx.getVariables().planError?.value).toBe("true");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  // The log has to say WHICH failure it was: "threw" sends a host developer
  // looking for an exception that does not exist.
  it("says the handler did not settle, not that it threw", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 1, timeoutMs: 20 },
        },
      ] as never,
      makeCtx({ customActions: { generatePlan: vi.fn(hangs) } })
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("did not settle in time"),
      expect.anything()
    );
    error.mockRestore();
  });

  it("does not run onResolve — nothing resolved", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 1, timeoutMs: 20 },
          onResolve: ["continue"],
        },
      ] as never,
      makeCtx({ onContinue, customActions: { generatePlan: vi.fn(hangs) } })
    );
    expect(onContinue).not.toHaveBeenCalled();
    error.mockRestore();
  });

  // A timed-out attempt is a FAILED attempt, so the retry budget covers it —
  // otherwise a single hang would spend the whole press.
  it("counts a timed-out attempt against the retry budget and can recover", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let attempts = 0;
    const handler = vi.fn(() => {
      attempts += 1;
      return attempts === 1 ? hangs() : Promise.resolve();
    });
    const ctx = makeCtx({ customActions: { generatePlan: handler } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 2, timeoutMs: 20 },
          onResolve: [{ type: "setVariable", name: "planReady", value: "true" }],
        },
      ] as never,
      ctx
    );
    expect(handler).toHaveBeenCalledTimes(2);
    expect(ctx.getVariables().planReady?.value).toBe("true");
    warn.mockRestore();
  });

  // Absent `timeoutMs` must stay unbounded: an LLM call can legitimately take
  // 60s+, and a default cut-off would be a worse bug than the hang.
  it("does not bound an attempt when no timeout is declared", async () => {
    const handler = vi.fn(async () => {
      await new Promise<void>((r) => setTimeout(r, 40));
    });
    const ctx = makeCtx({ customActions: { generatePlan: handler } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 1 },
          onResolve: [{ type: "setVariable", name: "planReady", value: "true" }],
        },
      ] as never,
      ctx
    );
    expect(ctx.getVariables().planReady?.value).toBe("true");
  });

  // A handler that settles well inside its timeout must not be delayed by it,
  // and must not leave a pending timer holding the event loop open.
  it("resolves immediately when the handler beats the timeout", async () => {
    const started = Date.now();
    const ctx = makeCtx({ customActions: { generatePlan: vi.fn(async () => {}) } });
    await runActions(
      [
        {
          type: "custom",
          function: "generatePlan",
          retry: { maxAttempts: 1, timeoutMs: 5000 },
          onResolve: [{ type: "setVariable", name: "planReady", value: "true" }],
        },
      ] as never,
      ctx
    );
    expect(ctx.getVariables().planReady?.value).toBe("true");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  // The point of the whole field: the claim is released, so the CTA comes back.
  // Before it, this second press was dropped forever.
  it("releases the in-flight claim, so the CTA works again", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = createInFlightRegistry(() => {});
    const handler = vi.fn(hangs);
    const ctx = makeCtx({
      customActions: { generatePlan: handler },
      beginActions: registry.claim,
      endActions: registry.release,
    } as Partial<RenderContext>);
    const actions = [
      {
        type: "custom",
        function: "generatePlan",
        retry: { maxAttempts: 1, timeoutMs: 20 },
      },
    ] as never;

    await runGuardedActions("cta", actions, ctx);
    await runGuardedActions("cta", actions, ctx);
    expect(handler).toHaveBeenCalledTimes(2);
    error.mockRestore();
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

  /**
   * The claim is keyed on the AUTHORED id, and the schema declares
   * `id: z.string()` with no `.min(1)` — so a payload can hand the guard an
   * empty string. Two unrelated elements would then share one claim and block
   * each other's presses silently (review round 2, finding 4). An id that
   * identifies nothing buys no guard, so it gets none: the pre-guard behaviour,
   * which double-fires at worst, rather than a dead control.
   */
  it("does not let a blank id block an unrelated element", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const handler = vi.fn(async () => {
      await gate;
    });
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    const first = runGuardedActions("", actions, ctx);
    const second = runGuardedActions("", actions, ctx);
    // Both ran: neither press was swallowed by the other's claim.
    expect(handler).toHaveBeenCalledTimes(2);

    release();
    await Promise.all([first, second]);
  });

  it("still guards every element that HAS an id", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const handler = vi.fn(async () => {
      await gate;
    });
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    const a = runGuardedActions("cta-a", actions, ctx);
    const b = runGuardedActions("cta-b", actions, ctx);
    const again = runGuardedActions("cta-a", actions, ctx);
    // Two distinct elements run; the repeat press on the first does not.
    expect(handler).toHaveBeenCalledTimes(2);

    release();
    await Promise.all([a, b, again]);
  });

  it("accepts a press again once the first has finished", async () => {
    const handler = vi.fn(async () => {});
    const ctx = makeGuardedCtx({ generatePlan: handler });
    const actions = [{ type: "custom" as const, function: "generatePlan" }];

    await runGuardedActions("cta", actions, ctx);
    await runGuardedActions("cta", actions, ctx);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  // A handler that rejects must not leave the button permanently dead.
  // `runActions` swallows a handler throw itself, so this one proves the RETRY
  // path releases, not the `finally` — the test below is the one that lands on
  // the `finally`.
  it("releases the slot when a custom handler rejects", async () => {
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

  // The `finally` itself: an exception that ESCAPES `runActions` (review round 1,
  // finding 5 — the handler-throw test above never reaches here, because
  // `runActions` catches a throwing handler and resolves normally). A host whose
  // `setVariable` throws is the real shape of it. Replace the try/finally with a
  // sequential `const r = await runActions(...); ctx.endActions(id); return r;`
  // and the SECOND press below never runs: the slot is still held.
  it("releases the slot when the action list itself throws", async () => {
    const setVariable = vi.fn(() => {
      throw new Error("host setVariable exploded");
    });
    const ctx = makeCtx({
      setVariable,
      beginActions: undefined,
      endActions: undefined,
    } as Partial<RenderContext>);
    const registry = createInFlightRegistry(() => {});
    ctx.beginActions = registry.claim;
    ctx.endActions = registry.release;
    const actions = [{ type: "setVariable" as const, name: "x", value: "1" }];

    await expect(runGuardedActions("cta", actions, ctx)).rejects.toThrow(
      "host setVariable exploded"
    );
    await expect(runGuardedActions("cta", actions, ctx)).rejects.toThrow(
      "host setVariable exploded"
    );
    expect(setVariable).toHaveBeenCalledTimes(2);
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

/**
 * A `function` name the host never registered (review round 1, findings 1 and
 * 7). It is a payload/build mismatch — a typo, or a payload published ahead of
 * the app build that registers the handler — and the runtime used to answer it
 * by skipping the whole action, hooks included. That turned the documented async
 * gate (`onResolve: ["continue"]`) into a permanently dead CTA signalled by one
 * console line.
 *
 * The rule now: the requested work did not happen, so the ERROR path runs; and
 * the enclosing list still carries on, which is the pre-#191 behaviour a
 * `[{custom}, "continue"]` payload depends on to stay navigable.
 */
describe("runActions — custom action with no registered handler", () => {
  const missing = (extra: Record<string, unknown> = {}) => [
    { type: "custom" as const, function: "generatePlan", ...extra },
  ];

  it("runs onError so the payload can show its failure state", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({ customActions: {} });
    await runActions(
      missing({ onError: [{ type: "setVariable", name: "planError", value: "true" }] }),
      ctx
    );
    expect(ctx.getVariables().planError?.value).toBe("true");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not run onResolve — nothing resolved", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(missing({ onResolve: ["continue"] }), makeCtx({ onContinue }));
    expect(onContinue).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("lets the rest of the list run, so a trailing continue still advances", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [...missing({ onError: [{ type: "setVariable", name: "planError", value: "true" }] }), "continue"],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("names the handler and the screen in the log", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runActions(missing(), makeCtx());
    expect(error).toHaveBeenCalledWith(expect.stringContaining("generatePlan"));
    error.mockRestore();
  });
});
