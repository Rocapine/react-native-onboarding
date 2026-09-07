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

/**
 * `requestPermission` (#196) is the one action whose branch lists must NOT be
 * read with the generic "any nested list completes it" rule, and review round 1
 * caught the first version doing exactly that.
 *
 * The question this predicate answers is "can the user still get off this
 * screen?", and for a permission ask the honest answer is "only on the outcomes
 * the author covered". The runtime has three: a grant runs `onGranted`, a
 * refusal runs `onDenied`, and "this build cannot ask" runs
 * `onUnavailable ?? onDenied`. A CTA holding its only `"continue"` in
 * `onGranted` traps every user who refuses — and traps EVERY user on a build
 * that never installed the optional Expo module, which is a packaging fact the
 * person pressing the button cannot do anything about.
 *
 * So the rule is AND across the outcomes, not OR: the action counts as a way
 * forward only when a grant AND a non-grant both reach `"continue"` /
 * `{dismiss}`. That is the file's stated bias ("errs toward no") applied to the
 * one action whose result the user does not fully control. `purchase` and
 * `restore` keep the OR reading deliberately — a cancelled purchase leaves the
 * user free to press again, whereas a standing OS denial cannot be retried.
 */
describe("hasCompletingAction — requestPermission outcome hooks", () => {
  const ask = (hooks: Record<string, unknown[]>) => [
    button("cta", [{ type: "requestPermission", kind: "notifications", ...hooks }]),
  ];

  it("counts an ask that advances on a grant AND on a refusal", () => {
    expect(hasCompletingAction(ask({ onGranted: ["continue"], onDenied: ["continue"] }))).toBe(true);
  });

  it("counts a grant path that continues and a refusal path that dismisses", () => {
    expect(
      hasCompletingAction(ask({ onGranted: ["continue"], onDenied: [{ type: "dismiss" }] }))
    ).toBe(true);
  });

  // The trap. `onGranted` alone reads as NO way forward, so the #209 strip
  // supplies its own escape CTA.
  it("reports no way forward when only the grant path advances", () => {
    expect(hasCompletingAction(ask({ onGranted: ["continue"] }))).toBe(false);
  });

  it("reports no way forward when only the refusal path advances", () => {
    expect(hasCompletingAction(ask({ onDenied: ["continue"] }))).toBe(false);
  });

  // `onUnavailable` covers the module-absent outcome only; a denial still needs
  // `onDenied`, so this shape strands the user who taps "Don't Allow".
  it("reports no way forward when onDenied is missing but onUnavailable advances", () => {
    expect(
      hasCompletingAction(ask({ onGranted: ["continue"], onUnavailable: ["continue"] }))
    ).toBe(false);
  });

  // All three declared: every runtime path advances.
  it("counts an ask that covers all three outcomes", () => {
    expect(
      hasCompletingAction(
        ask({ onGranted: ["continue"], onDenied: ["continue"], onUnavailable: ["continue"] })
      )
    ).toBe(true);
  });

  // `onUnavailable` present but dead, while `onDenied` advances: the
  // module-absent build runs onUnavailable and stays put, so this is a trap the
  // OR reading would have missed too.
  it("reports no way forward when a declared onUnavailable does not advance", () => {
    expect(
      hasCompletingAction(
        ask({
          onGranted: ["continue"],
          onDenied: ["continue"],
          onUnavailable: [{ type: "setVariable", name: "push", value: "n/a" }],
        })
      )
    ).toBe(false);
  });

  // A typo'd hook name is stripped by the (deliberately non-strict) schema, so
  // the payload validates clean and the denial path is dead. The AND rule is
  // what turns that into a visible escape CTA rather than a silent trap.
  it("reports no way forward when the refusal hook is misspelled", () => {
    expect(
      hasCompletingAction(ask({ onGranted: ["continue"], onDeneid: ["continue"] }))
    ).toBe(false);
  });

  it("reports no way forward for a permission ask with no terminal hook", () => {
    expect(
      hasCompletingAction(ask({ onGranted: [{ type: "setVariable", name: "push", value: "on" }] }))
    ).toBe(false);
  });

  // A separate CTA elsewhere on the screen is still a way forward — the rule
  // narrows what the ASK itself counts for, nothing else.
  it("still finds a sibling skip button", () => {
    expect(
      hasCompletingAction([
        button("cta", [{ type: "requestPermission", kind: "notifications", onGranted: ["continue"] }]),
        button("skip", ["continue"]),
      ])
    ).toBe(true);
  });

  // Nesting: an ask inside another action's branch list is walked the same way.
  it("counts a fully covered ask nested inside purchase.onSuccess", () => {
    expect(
      hasCompletingAction([
        button("cta", [
          {
            type: "purchase",
            product: "yearly",
            onSuccess: [
              {
                type: "requestPermission",
                kind: "notifications",
                onGranted: ["continue"],
                onDenied: ["continue"],
              },
            ],
          },
        ]),
      ])
    ).toBe(true);
  });
});
