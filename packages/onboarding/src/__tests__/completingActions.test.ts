import { describe, it, expect } from "vitest";
import { hasCompletingAction } from "../screens/completingActions";

/**
 * "Can the user still get off this screen?" (#209, review finding 1).
 *
 * The unknown-element strip removes a subtree, and a ComposableScreen's CTA is
 * authored INSIDE that tree — `ComposableScreenRenderer` passes no `button` to
 * `OnboardingTemplate`, so nothing outside `ScreenRenderer` can call
 * `onContinue`. Strip the element that happened to be the screen's root
 * container and the payload parses cleanly to `elements: []`: a blank screen,
 * no CTA, and with `displayProgressHeader: false` no back chevron either. The
 * throw that at least reached an error boundary became a silent trap.
 *
 * This predicate is what the renderer consults to decide whether it must supply
 * its own escape. `runActions` is the only thing in the runtime that ever calls
 * `onContinue`, and it does so for exactly two actions — `"continue"` and
 * `{type:"dismiss"}` — so those two, wherever they are reachable from a press,
 * are the whole definition of "this screen can be completed".
 */

const button = (id: string, actions: unknown[]) => ({
  id,
  type: "Button",
  props: { label: "Go", actions },
});

describe("hasCompletingAction", () => {
  it("finds a Button whose actions continue", () => {
    expect(hasCompletingAction([button("cta", ["continue"])])).toBe(true);
  });

  it("finds a continue nested inside a container", () => {
    const tree = [
      { id: "root", type: "YStack", props: {}, children: [button("cta", ["continue"])] },
    ];
    expect(hasCompletingAction(tree)).toBe(true);
  });

  it("reports no way forward for a screen of static content", () => {
    const tree = [
      {
        id: "root",
        type: "YStack",
        props: {},
        children: [{ id: "t", type: "Text", props: { content: "hello" } }],
      },
    ];
    expect(hasCompletingAction(tree)).toBe(false);
  });

  it("reports no way forward for an empty screen — the exact post-strip case", () => {
    expect(hasCompletingAction([])).toBe(false);
  });

  it("accepts the deprecated `action: \"continue\"` shorthand", () => {
    expect(hasCompletingAction([{ id: "cta", type: "Button", props: { label: "Go", action: "continue" } }])).toBe(
      true
    );
  });

  it("accepts the generic `onPress` any element can carry", () => {
    const tree = [{ id: "card", type: "YStack", props: { onPress: ["continue"] }, children: [] }];
    expect(hasCompletingAction(tree)).toBe(true);
  });

  it("ignores an `onPress` on a Button, which renderElement never wires", () => {
    // `PRESS_HANDLED_TYPES` in `renderElement.tsx`: Button and the other
    // self-handling elements dispatch their own actions, so the generic
    // `onPress` from BaseBoxProps is not wired for them. Counting it would read
    // as "the user can leave" on a screen whose only control does nothing.
    const tree = [{ id: "cta", type: "Button", props: { label: "Go", onPress: ["continue"] } }];
    expect(hasCompletingAction(tree)).toBe(false);
  });

  it("counts `dismiss`, which completes the screen just as `continue` does", () => {
    expect(hasCompletingAction([button("x", [{ type: "dismiss" }])])).toBe(true);
  });

  it("finds a continue in a purchase action's onSuccess branch", () => {
    const tree = [
      button("buy", [
        { type: "purchase", product: "p1", onSuccess: ["continue"] },
      ]),
    ];
    expect(hasCompletingAction(tree)).toBe(true);
  });

  it("finds a continue in a restore action's onNothingToRestore branch", () => {
    const tree = [
      button("restore", [{ type: "restore", onNothingToRestore: ["continue"] }]),
    ];
    expect(hasCompletingAction(tree)).toBe(true);
  });

  it("does not count setVariable, which leaves the user on the screen", () => {
    const tree = [button("pick", [{ type: "setVariable", name: "goal", value: "lose" }])];
    expect(hasCompletingAction(tree)).toBe(false);
  });

  it("does not count presentPaywall — a modal opens over the screen, the step does not advance", () => {
    const tree = [button("open", [{ type: "presentPaywall", placement: "hard_paywall" }])];
    expect(hasCompletingAction(tree)).toBe(false);
  });

  it("does not count a host `custom` action, whose effect this SDK cannot know", () => {
    // Deliberate, and the safer of the two errors: a host handler that
    // navigates by itself would get a redundant escape CTA on an
    // already-degraded screen, whereas guessing the other way re-creates the
    // trap. `runActions` does not call `onContinue` for `custom`.
    const tree = [button("skip", [{ type: "custom", name: "skipOnboarding" }])];
    expect(hasCompletingAction(tree)).toBe(false);
  });

  it("looks inside a Repeat's children, where a CTA can legitimately live", () => {
    const tree = [
      {
        id: "rep",
        type: "Repeat",
        props: { over: "goals" },
        children: [button("cta", ["continue"])],
      },
    ];
    expect(hasCompletingAction(tree)).toBe(true);
  });

  it("survives a malformed payload rather than throwing", () => {
    expect(hasCompletingAction([null, 3, "x", { id: "a" }, { props: null }])).toBe(false);
    expect(hasCompletingAction(undefined)).toBe(false);
    expect(hasCompletingAction({ not: "an array" })).toBe(false);
  });

  it("ignores a bare `{type:\"continue\"}` object — that is not an action this runtime runs", () => {
    // `ButtonActionSchema` declares continue as the string literal `"continue"`.
    // An object is not it, so the runtime would never advance on it; reading it
    // as a way forward would leave the user stuck with no escape.
    expect(hasCompletingAction([button("cta", [{ type: "continue" }])])).toBe(false);
  });
});
