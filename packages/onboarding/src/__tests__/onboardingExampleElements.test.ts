import { describe, it, expect } from "vitest";
import { ScreenElementsSchema } from "../screens/types";
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
