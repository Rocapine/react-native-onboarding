// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The REAL `PaywallHost`, to pin its acknowledgement wiring: the Modal's
 * `visible` comes from the decision, `onShow` is the hook's, and a swap is
 * acknowledged only over a Modal `onShow` confirmed during its current
 * visible stretch (round 8).
 *
 * Mocked, because they pull in native modules or every element renderer:
 * `react-native` (its `Modal` records its props so a test fires `onShow` when
 * it chooses, late included), safe-area, the headless package (the host seam
 * reads `h.host`), the theme, `ScreenRenderer` and `ScreenElementsSchema` (an
 * array parses). The `PaywallStepRenderer.observer.test.ts` harness.
 */

const h = vi.hoisted(() => ({
  host: null as any,
  modal: null as null | { visible: boolean; onShow: () => void },
}));

vi.mock("react-native", async () => {
  const { createElement: ce } = await import("react");
  const box = ({ children }: { children?: unknown }) => ce("div", null, children as any);
  return {
    View: box,
    ScrollView: box,
    Text: box,
    StyleSheet: { create: <T,>(s: T) => s },
    Platform: { OS: "ios" },
    Modal: (props: { visible: boolean; onShow: () => void; children?: unknown }) => {
      h.modal = { visible: props.visible, onShow: props.onShow };
      return props.visible ? ce("div", null, props.children as any) : null;
    },
  };
});
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children?: unknown }) => children,
}));
vi.mock("@rocapine/react-native-onboarding", () => ({
  usePaywallHost: () => h.host,
  usePaywall: () => ({ present: async () => ({ status: "dismissed" }) }),
  useProductRuntime: () => null,
}));
vi.mock("../../Theme/useTheme", () => ({
  useTheme: () => ({ theme: { colors: { neutral: { lowest: "#fff" } } } }),
}));
vi.mock("../../Runtime/types", () => ({
  ScreenElementsSchema: {
    safeParse: (x: unknown) =>
      Array.isArray(x) ? { success: true, data: x } : { success: false, error: new Error("bad elements") },
  },
}));
vi.mock("../../Runtime/ScreenRenderer", () => ({ ScreenRenderer: () => null }));

const { PaywallHost } = await import("../PaywallHost");

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  vi.restoreAllMocks();
});

const paywall = (id: string, elements: unknown = []) => ({ id, name: id, moment: id, elements });

const setup = async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const acks: string[] = [];
  const ended: Array<[string, unknown]> = [];
  let label = "none";
  /** One commit with `pw` on the surface, bound to its own `complete` (one identity per presentation). */
  const commit = async (pw: ReturnType<typeof paywall> | null) => {
    label = pw?.id ?? "none";
    const id = label;
    h.host = {
      activePaywall: pw,
      complete: (r: unknown) => void ended.push([id, r]),
      acknowledgePresentation: () => void acks.push(label),
      customActions: {},
      customScreens: {},
    };
    if (!root) root = createRoot(document.createElement("div"));
    await act(async () => root!.render(createElement(PaywallHost)));
  };
  const fireOnShow = async () => {
    await act(async () => h.modal!.onShow());
  };
  await commit(null);
  return { acks, ended, commit, fireOnShow, modal: () => h.modal! };
};

describe("PaywallHost: acknowledgement wiring", () => {
  it("acknowledges through onShow, then a swap that keeps the Modal visible", async () => {
    const t = await setup();
    await t.commit(paywall("a"));
    expect(t.modal().visible).toBe(true);
    expect(t.acks).toEqual([]);
    await t.fireOnShow();
    await t.commit(paywall("b"));
    expect(t.modal().visible).toBe(true);
    expect(t.acks).toEqual(["a", "b"]);
  });

  it("a successor that fails to parse hides the Modal, ends parse-error, and is never acknowledged", async () => {
    const t = await setup();
    await t.commit(paywall("a"));
    await t.fireOnShow();
    await t.commit(paywall("broken", "not-a-list"));
    expect(t.modal().visible).toBe(false);
    expect(t.ended).toEqual([["broken", { status: "error", reason: "parse-error" }]]);
    // A late onShow for `a`, while hidden.
    await t.fireOnShow();
    expect(t.acks).toEqual(["a"]);
  });

  it("a late onShow while hidden does not confirm the next presentation", async () => {
    const t = await setup();
    await t.commit(paywall("a"));
    // `a` ends before its present animation completes.
    await t.commit(null);
    await t.fireOnShow();
    await t.commit(paywall("c"));
    expect(t.acks).toEqual([]);
    await t.fireOnShow();
    expect(t.acks).toEqual(["c"]);
  });
});
