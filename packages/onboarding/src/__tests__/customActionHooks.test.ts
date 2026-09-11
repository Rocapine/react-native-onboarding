import { describe, it, expect } from "vitest";
import { ButtonActionSchema, CustomButtonActionSchema } from "../steps/common.types";
import { hasCompletingAction } from "../screens/completingActions";

// RNO#191 — the declarative half of an async gate. `custom` gains the same
// nested-`ButtonAction[]` outcome hooks `purchase`/`restore` already carry,
// plus a bounded retry. These assert the HEADLESS schema (the one that
// validates the payload); the UI mirror is asserted in
// `packages/onboarding-ui/src/UI/Runtime/__tests__/runActions.test.ts`.

describe("CustomButtonAction schema — outcome hooks", () => {
  // Asserting the PARSED OUTPUT, not just `success`: Zod strips unrecognized
  // keys, so an unimplemented hook parses "successfully" and silently vanishes
  // before it ever reaches `runActions`.
  it("accepts onResolve and onError action lists and keeps them", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      variables: ["goal"],
      onResolve: ["continue"],
      onError: [{ type: "setVariable", name: "planError", value: "true" }],
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.onResolve).toEqual(["continue"]);
    expect((parsed as any).data.onError).toEqual([
      { type: "setVariable", name: "planError", value: "true" },
    ]);
  });

  it("accepts a nested custom action inside onError (recursion)", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      onError: [{ type: "custom", function: "reportFailure" }],
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.onError[0].function).toBe("reportFailure");
  });

  it("still accepts the pre-#191 three-field shape", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      variables: ["goal"],
    });
    expect(parsed.success).toBe(true);
  });

  it("is reachable through the ButtonAction union with its hooks", () => {
    const parsed = ButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      onResolve: ["continue"],
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.onResolve).toEqual(["continue"]);
  });
});

describe("CustomButtonAction schema — bounded retry", () => {
  it("accepts an explicit attempt cap", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      retry: { maxAttempts: 3, delayMs: 500 },
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.retry).toEqual({ maxAttempts: 3, delayMs: 500 });
  });

  // The cap is what makes the retry BOUNDED — a payload that forgets it, or
  // asks for an unbounded/absurd number of attempts, must fail at parse time
  // rather than hang a screen behind a dead service.
  it("rejects a retry with no attempt cap", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      retry: { delayMs: 500 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects fewer than one attempt", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      retry: { maxAttempts: 0 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more attempts than the runtime will make", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      retry: { maxAttempts: 11 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a fractional attempt cap", () => {
    const parsed = CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      retry: { maxAttempts: 2.5 },
    });
    expect(parsed.success).toBe(false);
  });
});

// RNO#264 — `maxAttempts` bounds the NUMBER of attempts; nothing bounded ONE
// attempt's duration, so a handler whose promise never settles held the
// single-flight claim for the life of the screen and the documented
// `disabledWhen: actions.pending.<id>` payload greyed the CTA out permanently.
describe("CustomActionRetry schema — per-attempt timeoutMs (#264)", () => {
  const retry = (retry: Record<string, unknown>) =>
    CustomButtonActionSchema.safeParse({
      type: "custom",
      function: "generatePlan",
      retry,
    });

  it("accepts a per-attempt timeout and keeps it", () => {
    const parsed = retry({ maxAttempts: 3, delayMs: 400, timeoutMs: 15000 });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.retry).toEqual({
      maxAttempts: 3,
      delayMs: 400,
      timeoutMs: 15000,
    });
  });

  // A timeout without retries is the #264 repro itself — one attempt that never
  // answers — so it must be authorable without pretending to want retries.
  it("accepts a timeout on a single-attempt policy", () => {
    const parsed = retry({ maxAttempts: 1, timeoutMs: 30000 });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.retry.timeoutMs).toBe(30000);
  });

  it("is optional — an absent timeout means unbounded, as before", () => {
    const parsed = retry({ maxAttempts: 2 });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.retry.timeoutMs).toBeUndefined();
  });

  // A sub-second timeout cannot be met by any real network call, so it is a
  // typo (milliseconds meant as seconds), not a policy.
  it("rejects a timeout too short for any real handler", () => {
    expect(retry({ maxAttempts: 1, timeoutMs: 0 }).success).toBe(false);
    expect(retry({ maxAttempts: 1, timeoutMs: 250 }).success).toBe(false);
  });

  // Generous on purpose: a legitimate LLM call can take 60s+, and cutting one
  // off would be a worse bug than the hang. Five minutes is the ceiling.
  it("accepts a generous timeout and rejects one past the ceiling", () => {
    expect(retry({ maxAttempts: 1, timeoutMs: 300000 }).success).toBe(true);
    expect(retry({ maxAttempts: 1, timeoutMs: 300001 }).success).toBe(false);
  });

  it("rejects a non-numeric timeout", () => {
    expect(retry({ maxAttempts: 1, timeoutMs: "5000" }).success).toBe(false);
  });
});

describe("hasCompletingAction and a custom action's hooks (#209 guard)", () => {
  // Round 1 asserted the opposite of this — that `onResolve: ["continue"]` alone
  // makes the screen completable — and review round 1, finding 6 refuted it.
  // The resolve path is not the user's to reach: `ScreenHost`'s default is
  // `customActions: {}`, and an unregistered name runs `onError` and whatever
  // follows the action, never `onResolve`. So a `"continue"` in `onResolve`
  // alone is not a way off the screen. Read with AND across the outcomes, like
  // `requestPermission` (`completingActions.ts` — `customActionEscapes`), over
  // the action's two paths: the handler resolved, and the handler failed.
  const cta = (actions: unknown[]) => [
    { type: "Button", id: "cta", props: { label: "Generate", actions } },
  ];

  it("does not count a continue reachable only on the resolve path", () => {
    expect(
      hasCompletingAction(
        cta([{ type: "custom", function: "generatePlan", onResolve: ["continue"] }])
      )
    ).toBe(false);
  });

  it("counts it when the error path also reaches a way off the screen", () => {
    expect(
      hasCompletingAction(
        cta([
          {
            type: "custom",
            function: "generatePlan",
            onResolve: ["continue"],
            onError: ["continue"],
          },
        ])
      )
    ).toBe(true);
  });

  it("counts a sibling continue after the custom action", () => {
    // The trailing `"continue"` runs on both of the action's paths — handler
    // resolved, and handler failed however it failed — so it IS the screen's
    // way forward. It used to be reachable on only two of three paths, the
    // throw path having aborted the list; the semantics decision of 2026-09-11
    // removed that path, so this row no longer rests on a retryability
    // argument.
    //
    // Round 2 of this PR required `onError` here, which read every
    // `[{custom}, "continue"]` payload in the field as a trap: Studio's action
    // editor cannot author `onResolve`/`onError` until
    // `rocapine/onboarding-studio#288` lands, so the prescribed fix was not
    // available to anyone the verdict applied to.
    expect(
      hasCompletingAction(cta([{ type: "custom", function: "generatePlan" }, "continue"]))
    ).toBe(true);
    expect(
      hasCompletingAction(
        cta([{ type: "custom", function: "generatePlan", onError: ["continue"] }, "continue"])
      )
    ).toBe(true);
  });
});
