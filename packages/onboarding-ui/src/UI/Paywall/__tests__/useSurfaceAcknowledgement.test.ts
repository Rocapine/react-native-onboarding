// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useSurfaceAcknowledgement } from "../useSurfaceAcknowledgement";

/**
 * The real hook, with `onShow` fired at chosen times — including late, after
 * the Modal was hidden, which is what iOS does: it emits `onShow` from the
 * present completion with no visibility check, and `PaywallHost` keeps its
 * Modal mounted with `visible={false}`, so the event still arrives (round 8).
 *
 * `acknowledge` records the presentation committed when it is called, which
 * is what the provider's `acknowledgePresentation` acknowledges.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
});

const setup = async () => {
  const acks: string[] = [];
  const current = { label: "none" };
  let onShow: () => void = () => {};
  const acknowledge = () => void acks.push(current.label);
  const Probe = ({ visible, presentation }: { visible: boolean; presentation: string }) => {
    onShow = useSurfaceAcknowledgement(visible, presentation, acknowledge);
    return null;
  };
  root = createRoot(document.createElement("div"));
  /** One commit: the Modal's `visible` and the presentation on the surface. */
  const commit = async (visible: boolean, presentation: string) => {
    current.label = presentation;
    await act(async () => root!.render(createElement(Probe, { visible, presentation })));
  };
  const fireOnShow = async () => {
    await act(async () => onShow());
  };
  await commit(false, "none");
  return { acks, commit, fireOnShow };
};

describe("useSurfaceAcknowledgement", () => {
  it("an onShow that arrives while the Modal is hidden does not confirm the next showing", async () => {
    const t = await setup();
    await t.commit(true, "A");
    // A ends before its present animation completes.
    await t.commit(false, "none");
    // A's onShow reaches JS late, with the Modal hidden.
    await t.fireOnShow();
    await t.commit(true, "C");
    expect(t.acks).toEqual([]);
    // C's own onShow is what confirms it.
    await t.fireOnShow();
    expect(t.acks).toEqual(["C"]);
  });

  it("a late onShow for a hidden successor is not an acknowledgement of it", async () => {
    const t = await setup();
    await t.commit(true, "A");
    await t.fireOnShow();
    // Same-commit successor the host will not render (parse error).
    await t.commit(false, "X");
    await t.fireOnShow();
    expect(t.acks).toEqual(["A"]);
  });

  it("onShow during the visible stretch confirms it, and a same-commit swap is acknowledged", async () => {
    const t = await setup();
    await t.commit(true, "A");
    await t.fireOnShow();
    await t.commit(true, "B");
    expect(t.acks).toEqual(["A", "B"]);
  });

  it("a swap before A's onShow is acknowledged when A's onShow arrives, still visible", async () => {
    const t = await setup();
    await t.commit(true, "A");
    await t.commit(true, "B");
    expect(t.acks).toEqual([]);
    await t.fireOnShow();
    expect(t.acks).toEqual(["B"]);
  });

  it("a confirmation does not survive a hide", async () => {
    const t = await setup();
    await t.commit(true, "A");
    await t.fireOnShow();
    await t.commit(false, "none");
    await t.commit(true, "C");
    expect(t.acks).toEqual(["A"]);
  });
});
