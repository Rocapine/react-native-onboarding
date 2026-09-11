import { describe, it, expect, vi } from "vitest";
// Deep `/dist/` import of the BUILT payload, the pattern exampleExpressions.test.ts
// and repeatRowGating.test.ts use to reach the headless package from this
// workspace (it needs `npm run build` first and pulls in no react-native code).
import { onboardingExample } from "@rocapine/react-native-onboarding/dist/onboarding-example";
import { runActions } from "../elements/runActions";
import type { RenderContext } from "../elements/shared";

/**
 * The exported payload is the documented `fallbackOnboarding`, so it is rendered
 * by apps that pass no `customActions` — `ScreenHost`'s default is `{}` — and by
 * the studio's seed data. Its primary CTA must advance there.
 *
 * The headless half of this lives in `onboardingExampleElements.test.ts` and is
 * a static walk (`actionsCanComplete`). This one RUNS the list through the real
 * dispatcher, which is how review round 1 (findings 1 and 7) demonstrated the
 * regression: `onContinue` called 0 times, one `console` line, user stranded.
 */
const findById = (nodes: unknown, id: string): any => {
  if (!Array.isArray(nodes)) return undefined;
  for (const node of nodes) {
    if (node && typeof node === "object") {
      const n = node as any;
      if (n.id === id) return n;
      const inner = findById(n.children, id);
      if (inner) return inner;
    }
  }
  return undefined;
};

describe("the exported example's hero CTA on a host with no customActions", () => {
  const step = (onboardingExample.steps as any[]).find(
    (s) => s.type === "ComposableScreen"
  );
  const hero = findById(step?.payload?.elements, "hero-button");

  it("finds the hero button in the built payload", () => {
    expect(hero?.props?.actions).toBeTruthy();
  });

  it("still advances the flow", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    const ctx = {
      theme: {} as RenderContext["theme"],
      getVariables: () => ({}),
      setVariable: () => {},
      onContinue,
      customActions: {},
      renderChildren: () => null,
    } as unknown as RenderContext;

    await runActions(hero.props.actions, ctx);
    expect(onContinue).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
