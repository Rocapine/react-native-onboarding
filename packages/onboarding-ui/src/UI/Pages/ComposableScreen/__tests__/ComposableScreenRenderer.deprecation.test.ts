// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The #353 deprecation warning through a real render: react-dom under jsdom,
 * with the `PaywallStepRenderer.observer.test.ts` harness's stubs. Mounts the
 * ComposableScreen step adapter and the `Paywall` step renderer, both of which
 * render through `ScreenRenderer` inside `OnboardingTemplate`, and asserts that
 * only the first warns.
 *
 * Mocked, because they pull in native modules or every element renderer:
 * `react-native`, the headless package, the UI progress provider, the theme,
 * the template, `ScreenRenderer`, `Runtime/types` and the two step schemas.
 * Each test re-imports after `vi.resetModules()`, so the once-per-session latch
 * starts unset.
 */

vi.mock("react-native", async () => {
  const { createElement: ce } = await import("react");
  const box = ({ children }: { children?: unknown }) => ce("div", null, children as any);
  return {
    View: box,
    ScrollView: box,
    Text: box,
    TouchableOpacity: box,
    ActivityIndicator: () => ce("progress"),
    StyleSheet: { create: <T,>(s: T) => s },
    Platform: { OS: "ios" },
  };
});

vi.mock("@rocapine/react-native-onboarding", async () => {
  const { createContext: cc } = await import("react");
  return {
    OnboardingProgressContext: cc({ setVariable: () => {}, customActions: {}, products: {} }),
    useOnboardingHeaderHeight: () => ({ headerHeight: 0 }),
    usePaywall: () => ({
      catalog: { paywalls: { m: { id: "pw", name: "pw", moment: "m", elements: [{ type: "Text" }] } } },
      catalogStatus: "success",
      isProviderMounted: true,
      present: () => {},
    }),
    usePaywallHost: () => ({ observePresentation: undefined }),
    formatUnknownElementTypes: () => "",
    resolveRenderableStep: (step: unknown) => ({ step, omitted: [], needsEscape: false }),
  };
});

vi.mock("../../../Provider/OnboardingProgressProvider", async () => {
  const { createContext: cc } = await import("react");
  return {
    OnboardingProgressContext: cc({ composableVariables: {}, setComposableVariable: () => {} }),
  };
});

vi.mock("../../../Theme/useTheme", () => ({
  useTheme: () => ({ theme: { colors: { neutral: { lowest: "#fff" } } } }),
}));

vi.mock("../../../Templates/OnboardingTemplate", () => ({
  OnboardingTemplate: ({ children }: { children?: unknown }) => children,
}));

vi.mock("../../../Runtime/ScreenRenderer", () => ({ ScreenRenderer: () => null }));

vi.mock("../../../Runtime/renderableElementTypes", () => ({ getRenderableElementTypes: () => [] }));

vi.mock("../../../Runtime/types", () => ({
  ScreenElementsSchema: { safeParse: (x: unknown) => ({ success: true, data: x }) },
}));

vi.mock("../types", () => ({
  ComposableScreenStepTypeSchema: { parse: (x: unknown) => x },
}));

const g = globalThis as { __DEV__?: boolean; IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const composableStep = {
  id: "c1",
  type: "ComposableScreen",
  name: "Composable step",
  displayProgressHeader: false,
  payload: { elements: [] },
  customPayload: null,
};

const paywallStep = {
  id: "p1",
  type: "Paywall",
  name: "Paywall step",
  displayProgressHeader: true,
  payload: { moment: "m" },
  customPayload: null,
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const mount = async (component: unknown, step: unknown) => {
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(createElement(component as any, { step, onContinue: () => {} })));
};

const unmount = async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
};

const load = async () => {
  vi.resetModules();
  const { COMPOSABLE_SCREEN_DEPRECATION_WARNING } = await import("../deprecationWarning");
  const { ComposableScreenRenderer } = await import("../Renderer");
  const { PaywallStepRenderer } = await import("../../Paywall/Renderer");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const deprecationWarnings = () =>
    warn.mock.calls.filter(([message]) => message === COMPOSABLE_SCREEN_DEPRECATION_WARNING).length;
  return { ComposableScreenRenderer, PaywallStepRenderer, deprecationWarnings };
};

afterEach(async () => {
  await unmount();
  delete g.__DEV__;
  vi.restoreAllMocks();
});

describe("ComposableScreen step deprecation warning (#353)", () => {
  it("warns once for a ComposableScreen step, across re-renders and remounts", async () => {
    g.__DEV__ = true;
    const { ComposableScreenRenderer, deprecationWarnings } = await load();
    await mount(ComposableScreenRenderer, composableStep);
    await mount(ComposableScreenRenderer, { ...composableStep, name: "re-rendered" });
    await unmount();
    await mount(ComposableScreenRenderer, { ...composableStep, id: "c2" });
    expect(deprecationWarnings()).toBe(1);
  });

  it("never warns when __DEV__ is false", async () => {
    g.__DEV__ = false;
    const { ComposableScreenRenderer, deprecationWarnings } = await load();
    await mount(ComposableScreenRenderer, composableStep);
    expect(deprecationWarnings()).toBe(0);
  });

  it("never warns for a paywall, and a paywall does not use up the warning", async () => {
    g.__DEV__ = true;
    const { ComposableScreenRenderer, PaywallStepRenderer, deprecationWarnings } = await load();
    await mount(PaywallStepRenderer, paywallStep);
    await unmount();
    expect(deprecationWarnings()).toBe(0);
    // The latch was armed the whole time: the same session's first
    // ComposableScreen step still warns.
    await mount(ComposableScreenRenderer, composableStep);
    expect(deprecationWarnings()).toBe(1);
  });
});
