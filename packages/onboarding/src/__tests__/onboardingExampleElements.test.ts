import { describe, it, expect } from "vitest";
import { ScreenElementsSchema } from "../screens/types";
import { actionsCanComplete, hasCompletingAction } from "../screens/completingActions";
import { onboardingExample } from "../onboarding-example";

// The default onboarding is the payload every example app and the studio's
// seed data render, and CLAUDE.md's element procedure (step 1) requires keeping
// it in sync with the schema. Nothing enforced that: a `setVariable` action or
// element prop added to the example but not to the Zod union would ship a
// payload the runtime refuses to parse, and the only symptom would be a broken
// example app. This test closes that hole for the ComposableScreen steps.
describe("onboarding-example ComposableScreen payloads", () => {
  const composableSteps = onboardingExample.steps.filter(
    (s) => s.type === "ComposableScreen"
  );

  it("has ComposableScreen steps to check", () => {
    expect(composableSteps.length).toBeGreaterThan(0);
  });

  for (const step of composableSteps) {
    it(`step "${step.name}" validates against ScreenElementsSchema`, () => {
      const result = ScreenElementsSchema.safeParse(step.payload?.elements);
      // Surface the actual zod issues rather than a bare `false`.
      expect(result.success ? [] : result.error.issues).toEqual([]);
    });
  }
});

/**
 * The exported payload is also the documented `fallbackOnboarding`
 * (`getting-started.mdx`), rendered by apps that pass no `customActions` at all
 * — `ScreenHost`'s default is `{}`. So no step in it may depend on a registered
 * handler for its way forward (review round 1, findings 1 and 7).
 *
 * Round 1 of #191 moved the hero button's only `"continue"` into the
 * `onResolve` of a `{type:"custom", function:"trackCta"}` action. `trackCta` is
 * registered nowhere in the SDK, so on the fallback path the primary CTA logged
 * one line and did nothing: a step with no way off it.
 */
describe("onboarding-example ComposableScreen steps stay navigable", () => {
  const composableSteps = onboardingExample.steps.filter(
    (s) => s.type === "ComposableScreen"
  );

  for (const step of composableSteps) {
    it(`step "${step.name}" can be completed with no customActions registered`, () => {
      expect(hasCompletingAction(step.payload?.elements)).toBe(true);
    });
  }

  // Tree-wide is not enough for the PRIMARY CTA: the screen keeping SOME way
  // forward elsewhere in the tree does not make a dead "Get Started" button
  // acceptable. This asserts the button itself.
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

  it("the hero CTA advances on a host with no customActions", () => {
    const step = composableSteps[0];
    const hero = findById(step.payload?.elements, "hero-button");
    expect(hero, "hero-button not found in the example payload").toBeTruthy();
    expect(actionsCanComplete(hero.props.actions)).toBe(true);
  });
});
