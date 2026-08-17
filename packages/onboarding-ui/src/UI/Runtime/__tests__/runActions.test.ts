import { describe, it, expect, vi } from "vitest";
import { runActions } from "../elements/runActions";
import type { RenderContext } from "../elements/shared";

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
    ).resolves.toBeUndefined();
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

  // Ask-to-Buy / deferred transactions resolve "pending" — the purchase is
  // genuinely in flight, so this must warn rather than silently doing nothing.
  it("warns and runs no follow-up actions when the purchase is pending", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const products = makeProducts({ purchase: vi.fn(async () => ({ status: "pending" as const })) });
    const ctx = makeCtx({ products } as any);
    await expect(
      runActions(
        [{ type: "purchase", product: "yearly", onSuccess: [{ type: "setVariable", name: "bought", value: "yes" }] }],
        ctx
      )
    ).resolves.toBeUndefined();
    expect(ctx.getVariables().bought).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // Without a provider the action must be inert and loud, never a silent no-op
  // that looks like a working buy button.
  it("warns and does not throw when no product runtime is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      runActions([{ type: "purchase", product: "yearly" }], makeCtx())
    ).resolves.toBeUndefined();
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
