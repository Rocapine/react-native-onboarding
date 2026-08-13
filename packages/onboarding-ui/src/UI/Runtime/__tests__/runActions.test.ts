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
