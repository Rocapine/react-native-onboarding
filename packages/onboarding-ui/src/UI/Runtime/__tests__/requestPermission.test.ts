import { describe, it, expect, vi } from "vitest";
import { runActions } from "../elements/runActions";
import type { RenderContext } from "../elements/shared";
import {
  ButtonActionSchema as UiButtonActionSchema,
  PERMISSION_KINDS as UI_PERMISSION_KINDS,
} from "../elements/actions";
import {
  ButtonActionSchema as HeadlessButtonActionSchema,
  PERMISSION_KINDS as HEADLESS_PERMISSION_KINDS,
} from "../../../../../onboarding/src/steps/common.types";
import {
  actionsCanComplete as uiActionsCanComplete,
  completingActionKind as uiCompletingActionKind,
} from "../elements/completingActions";
import {
  actionsCanComplete as headlessActionsCanComplete,
  completingActionKind as headlessCompletingActionKind,
} from "../../../../../onboarding/src/screens/completingActions";
import {
  normalizePermissionResponse,
  pickPermissionRequester,
  requestPermissionViaExpoModules,
} from "../elements/permissions";
import { shouldAdvanceOnComplete } from "../../Pages/Paywall/shouldAdvanceOnComplete";

/**
 * The UI half of `requestPermission` (#196).
 *
 * Three things are covered here and nowhere else:
 *
 *  1. **Mirror parity.** `elements/actions.ts` re-declares the headless
 *     `ButtonAction` union, and TypeScript catches drift in NEITHER direction.
 *     Drift is not symmetric in consequence but it is symmetric in silence: a
 *     variant only in the mirror throws `invalid_union` at parse (the headless
 *     schema validates the payload), and one only in the headless schema
 *     renders a button whose press does nothing. Both schemas are imported here
 *     and fed the same payloads.
 *  2. **Dispatch**, against a stubbed resolver injected through the
 *     `ScreenHost.requestPermission` seam — the only way to exercise a
 *     grant/deny branch without a device. There is no device test framework in
 *     either repo (#216 is open), so the real OS prompt is NOT covered by
 *     anything here.
 *  3. **The unavailable path**, which is the one this SDK will actually hit in
 *     a bundle that did not install the Expo module.
 */

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

const ask = (kind: string, extra: Record<string, unknown> = {}) =>
  ({ type: "requestPermission", kind, ...extra }) as never;

describe("requestPermission — headless ↔ UI mirror parity", () => {
  it("declares the same permission kinds in both packages", () => {
    expect([...UI_PERMISSION_KINDS]).toEqual([...HEADLESS_PERMISSION_KINDS]);
  });

  it("both schemas accept the same requestPermission payloads", () => {
    const accepted = [
      { type: "requestPermission", kind: "notifications" },
      {
        type: "requestPermission",
        kind: "appTrackingTransparency",
        onGranted: ["continue"],
        onDenied: [{ type: "setVariable", name: "att", value: "no" }, "continue"],
        onUnavailable: ["continue"],
      },
      ...HEADLESS_PERMISSION_KINDS.map((kind) => ({ type: "requestPermission", kind })),
    ];
    for (const payload of accepted) {
      expect(HeadlessButtonActionSchema.safeParse(payload).success, `headless: ${JSON.stringify(payload)}`).toBe(true);
      expect(UiButtonActionSchema.safeParse(payload).success, `ui: ${JSON.stringify(payload)}`).toBe(true);
    }
  });

  it("both schemas reject the same malformed requestPermission payloads", () => {
    const rejected = [
      { type: "requestPermission" },
      { type: "requestPermission", kind: "healthkit" },
      { type: "requestPermission", kind: "notifications", onGranted: "continue" },
      { type: "requestPermission", kind: "notifications", onGranted: [{ type: "nope" }] },
    ];
    for (const payload of rejected) {
      expect(HeadlessButtonActionSchema.safeParse(payload).success, `headless: ${JSON.stringify(payload)}`).toBe(false);
      expect(UiButtonActionSchema.safeParse(payload).success, `ui: ${JSON.stringify(payload)}`).toBe(false);
    }
  });
});

/**
 * `actionsCanComplete` is declared in BOTH packages — the headless one is the
 * canonical definition (the #209 strip consults it through
 * `hasCompletingAction`), the UI one is what `runActions` consults at press time
 * before deciding whether a permission it could not ask for has left the user
 * with no way off the screen.
 *
 * A mirror, deliberately: the packages are joined by a peer-dependency range, so
 * this package's runtime must not branch on the other package's installed
 * implementation (`unknownElementTypes.test.ts` (2)) — and the headless index is
 * not importable from this Node suite at all. Held equal here, over one table,
 * because a divergence between them is invisible in both directions: the strip
 * would bolt an escape CTA onto a screen the runtime already rescues, or,
 * worse, decline to rescue a screen the strip called a trap.
 */
describe("actionsCanComplete — headless ↔ UI mirror parity", () => {
  const table: unknown[] = [
    ["continue"],
    [{ type: "dismiss" }],
    [{ type: "setVariable", name: "a", value: "b" }],
    [{ type: "setVariable", name: "a", value: "b" }, "continue"],
    [{ type: "custom", function: "doThing" }],
    // `custom` is the SECOND action read with AND across its outcomes (#191).
    // Round 1 of that change landed the rule in the headless walk only, so the
    // two packages disagreed about the PR's own headline shape (review round 2,
    // finding 5) — these five rows are what a name-only mirror could not catch.
    [{ type: "custom", function: "gen", onResolve: ["continue"] }],
    [{ type: "custom", function: "gen", onError: ["continue"] }],
    [{ type: "custom", function: "gen", onResolve: ["continue"], onError: ["continue"] }],
    [{ type: "custom", function: "gen", onResolve: [{ type: "dismiss" }], onError: ["continue"] }],
    // A sibling AFTER a custom action: it runs on both of the action's paths,
    // so it counts for both terms of the conjunction.
    [{ type: "custom", function: "gen" }, "continue"],
    [{ type: "custom", function: "gen", onError: ["continue"] }, "continue"],
    ["continue", { type: "custom", function: "gen" }],
    [{ type: "custom", function: "gen", variables: ["continue"] }],
    // A `custom` gate nested inside an ask's hook — both mirrors recurse.
    [
      {
        type: "requestPermission",
        kind: "notifications",
        onGranted: [{ type: "custom", function: "syncPush", onResolve: ["continue"] }],
        onDenied: [{ type: "setVariable", name: "push", value: "off" }],
      },
    ],
    [{ type: "presentPaywall", placement: "hard" }],
    [{ type: "purchase", product: "yearly", onSuccess: ["continue"] }],
    [{ type: "purchase", product: "yearly" }],
    [{ type: "restore", onNothingToRestore: [{ type: "dismiss" }] }],
    // A nested ask is where the AND-across-outcomes rule shows up.
    [{ type: "requestPermission", kind: "notifications", onGranted: ["continue"] }],
    [
      {
        type: "requestPermission",
        kind: "notifications",
        onGranted: ["continue"],
        onDenied: ["continue"],
      },
    ],
    [
      {
        type: "requestPermission",
        kind: "notifications",
        onGranted: ["continue"],
        onDenied: ["continue"],
        onUnavailable: [{ type: "setVariable", name: "a", value: "b" }],
      },
    ],
    [{ type: "requestPermission", kind: "notifications", onDeneid: ["continue"] }],
    // Junk: both must answer, neither may throw.
    undefined,
    null,
    "continue",
    [],
    [null, 3, { type: "continue" }],
  ];

  it("answers identically for every shape", () => {
    for (const actions of table) {
      expect(uiActionsCanComplete(actions), JSON.stringify(actions) ?? "undefined").toBe(
        headlessActionsCanComplete(actions)
      );
    }
  });

  // The same table against the KIND, not just the boolean. `runActions` picks
  // the outcome it reports to the host from this (review round 2, finding 1), so
  // a divergence here is a paywall gate that opens on one package pairing and
  // holds on another.
  it("names the same completing action in both packages", () => {
    for (const actions of [
      ...table,
      [{ type: "dismiss" }, "continue"],
      ["continue", { type: "dismiss" }],
      [{ type: "purchase", product: "yearly", onSuccess: [{ type: "dismiss" }] }],
    ]) {
      expect(uiCompletingActionKind(actions), JSON.stringify(actions) ?? "undefined").toBe(
        headlessCompletingActionKind(actions)
      );
    }
  });

  // Both mirrors, one rule: reachable dismiss wins over reachable continue.
  it("prefers dismiss over continue in both packages", () => {
    for (const kind of [uiCompletingActionKind, headlessCompletingActionKind]) {
      expect(kind(["continue"])).toBe("continue");
      expect(kind([{ type: "dismiss" }])).toBe("dismiss");
      expect(kind(["continue", { type: "dismiss" }])).toBe("dismiss");
      expect(kind([{ type: "setVariable", name: "a", value: "b" }])).toBeUndefined();
      expect(kind(undefined)).toBeUndefined();
    }
  });
});

describe("runActions — requestPermission dispatch", () => {
  it("runs onGranted when the resolver grants", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const ctx = makeCtx({ requestPermission });
    await runActions(
      [ask("notifications", { onGranted: [{ type: "setVariable", name: "push", value: "on" }], onDenied: [{ type: "setVariable", name: "push", value: "off" }] })],
      ctx
    );
    expect(requestPermission).toHaveBeenCalledWith("notifications");
    expect(ctx.getVariables().push.value).toBe("on");
  });

  it("runs onDenied when the resolver denies", async () => {
    const ctx = makeCtx({ requestPermission: vi.fn().mockResolvedValue("denied") });
    await runActions(
      [ask("camera", { onGranted: [{ type: "setVariable", name: "cam", value: "on" }], onDenied: [{ type: "setVariable", name: "cam", value: "off" }] })],
      ctx
    );
    expect(ctx.getVariables().cam.value).toBe("off");
  });

  // Same-press divergence is the whole point of the atom: `[{custom}, "continue"]`
  // could ask and advance, but never advance DIFFERENTLY on a refusal.
  it("lets one press advance on a grant and dismiss on a refusal", async () => {
    const onContinue = vi.fn();
    await runActions(
      [ask("notifications", { onGranted: ["continue"], onDenied: [{ type: "dismiss" }] })],
      makeCtx({ onContinue, requestPermission: vi.fn().mockResolvedValue("denied") })
    );
    expect(onContinue).toHaveBeenCalledWith({ status: "dismissed" });
  });

  // Review round 1, finding 4. A terminal action nested in an outcome hook now
  // STOPS the outer list, exactly as a top-level `"continue"` does. The first
  // version let the outer `for` carry on after the recursion returned, so a
  // defensive trailing `"continue"` — a shape `hasCompletingAction` accepts —
  // called `onContinue` TWICE: a duplicate `router.push` in the example host,
  // and a silently skipped screen in a host that advances by incrementing an
  // index.
  it("stops the outer loop when a nested outcome hook is terminal", async () => {
    const onContinue = vi.fn();
    const ctx = makeCtx({
      onContinue,
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });
    await runActions(
      [
        ask("notifications", { onGranted: ["continue"] }),
        { type: "setVariable", name: "after", value: "written" },
      ] as never,
      ctx
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(ctx.getVariables().after).toBeUndefined();
  });

  // The exact shape from the finding: an author who adds a trailing `"continue"`
  // as a belt-and-braces escape must not get two advances.
  it("advances once for an ask whose hooks continue, followed by a trailing continue", async () => {
    const onContinue = vi.fn();
    await runActions(
      [
        ask("notifications", { onGranted: ["continue"], onDenied: ["continue"] }),
        "continue",
      ] as never,
      makeCtx({ onContinue, requestPermission: vi.fn().mockResolvedValue("granted") })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("continues the outer loop when the outcome hook is not terminal", async () => {
    const ctx = makeCtx({ requestPermission: vi.fn().mockResolvedValue("granted") });
    await runActions(
      [
        ask("notifications", { onGranted: [{ type: "setVariable", name: "push", value: "on" }] }),
        { type: "setVariable", name: "after", value: "written" },
      ] as never,
      ctx
    );
    expect(ctx.getVariables().after.value).toBe("written");
  });

  it("warns rather than silently doing nothing when the resolved outcome has no hook", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runActions(
      [ask("notifications", { onGranted: ["continue"] })],
      makeCtx({ requestPermission: vi.fn().mockResolvedValue("denied") })
    );
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain("onDenied");
    warn.mockRestore();
  });

  it("recurses — a nested requestPermission inside onGranted also dispatches", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const ctx = makeCtx({ requestPermission });
    await runActions(
      [
        ask("appTrackingTransparency", {
          onGranted: [ask("notifications", { onGranted: [{ type: "setVariable", name: "both", value: "yes" }] })],
        }),
      ],
      ctx
    );
    expect(requestPermission.mock.calls.map((c) => c[0])).toEqual([
      "appTrackingTransparency",
      "notifications",
    ]);
    expect(ctx.getVariables().both.value).toBe("yes");
  });

  it("treats a throwing host resolver as unavailable rather than killing the press", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeCtx({
      requestPermission: vi.fn().mockRejectedValue(new Error("boom")),
    });
    // Resolves rather than rejecting. `false` = "the press ran to the end
    // without completing the screen" (see `runActions`' return contract).
    await expect(
      runActions(
        [ask("camera", { onUnavailable: [{ type: "setVariable", name: "cam", value: "n/a" }] })],
        ctx
      )
    ).resolves.toBe(false);
    expect(ctx.getVariables().cam.value).toBe("n/a");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("runActions — requestPermission when the build cannot ask", () => {
  // In plain Node no Expo module resolves, so the bundled resolver answers
  // "unavailable" for every kind. That is exactly the shape of an app bundle
  // that skipped the optional peer dep, which makes this the honest default
  // path — not an edge case.
  it("resolves unavailable for every kind with no Expo module present", async () => {
    for (const kind of UI_PERMISSION_KINDS) {
      await expect(requestPermissionViaExpoModules(kind)).resolves.toBe("unavailable");
    }
  });

  it("runs onUnavailable when declared", async () => {
    const ctx = makeCtx();
    await runActions(
      [ask("notifications", { onGranted: ["continue"], onUnavailable: [{ type: "setVariable", name: "why", value: "module-missing" }] })],
      ctx
    );
    expect(ctx.getVariables().why.value).toBe("module-missing");
  });

  // Review round 1, finding 2. The first version ran `onDenied` when
  // `onUnavailable` was absent. That advanced the user — but it also ran
  // everything ELSE in the refusal branch, so a screen authored the way both
  // LLM skills recommend recorded `att = "denied"` for a user who was never
  // asked. Analytics, `renderWhen` gates and `resolveNextStepNumber` branching
  // all then read a decision nobody made, signalled only by a console.warn in
  // an app where nothing watches the JS console.
  //
  // The substitution is now a bare advance: no authored side effect from a
  // branch whose precondition did not happen.
  it("does not run onDenied's side effects when the build could not ask", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    const ctx = makeCtx({ onContinue });
    await runActions(
      [
        ask("appTrackingTransparency", {
          onGranted: [{ type: "setVariable", name: "att", value: "granted" }, "continue"],
          onDenied: [{ type: "setVariable", name: "att", value: "denied" }, "continue"],
        }),
      ],
      ctx
    );
    expect(ctx.getVariables().att).toBeUndefined();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(error.mock.calls.some((c) => String(c[0]).includes("onUnavailable"))).toBe(true);
    error.mockRestore();
  });

  // Review round 1, finding 1. THE dead end: an `onGranted`-only CTA on a build
  // that installed no permission module. Every user pressed it, the resolver
  // answered "unavailable", no hook matched, one console.error was emitted, and
  // nothing ran — no CTA, no back chevron on a `displayProgressHeader: false`
  // step, for 100% of that build's users.
  //
  // A press the author authored as a way OFF the screen now leaves the screen,
  // whatever the module situation is.
  it("still leaves the screen when the ask was its only way forward", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions([ask("notifications", { onGranted: ["continue"] })], makeCtx({ onContinue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toContain("onUnavailable");
    error.mockRestore();
  });

  // The asymmetry that keeps the escape honest: it fires only when the AUTHOR
  // put a completing action somewhere in the ask. An ask that was never a way
  // forward (a "turn on notifications" button beside its own Skip CTA) must not
  // start advancing the flow because a module is missing.
  it("does not invent an advance for an ask that was never a way forward", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [ask("notifications", { onGranted: [{ type: "setVariable", name: "push", value: "on" }] })],
      makeCtx({ onContinue })
    );
    expect(onContinue).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  // Review round 2, finding 1. The escape substitutes the AUTHOR'S OWN escape,
  // which means its OUTCOME too — not a bare `onContinue()`.
  //
  // `onContinue()` with no outcome is the one call every host reads as "advance",
  // including `Pages/Paywall/Renderer`'s hard gate
  // (`shouldAdvanceOnComplete(undefined) === true`). So on a `Paywall` step whose
  // ask declared `{dismiss}` on BOTH outcomes — an author who never wrote a way
  // past the paywall at all — a build missing the optional module used to walk
  // the user straight through a paid gate, signalled by one console.error.
  //
  // The rule now: reuse the outcome the author put in the ask, and when the ask
  // offers both shapes, take the NON-advancing one. Nobody was asked anything,
  // so the SDK must not claim the more permissive of the two answers.
  it("substitutes the authored dismiss rather than a bare advance", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        ask("appTrackingTransparency", {
          onGranted: [{ type: "dismiss" }],
          onDenied: [{ type: "dismiss" }],
        }),
      ],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({ status: "dismissed" });
    error.mockRestore();
  });

  // The same assertion stated as the harm, through the real gate rather than a
  // paraphrase of it.
  it("leaves a hard paywall gate closed when the authored escape was a dismiss", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        ask("appTrackingTransparency", {
          onGranted: [{ type: "dismiss" }],
          onDenied: [{ type: "dismiss" }],
        }),
      ],
      makeCtx({ onContinue })
    );
    expect(shouldAdvanceOnComplete(onContinue.mock.calls[0][0])).toBe(false);
    error.mockRestore();
  });

  it("takes the non-advancing outcome when the ask authored both", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        ask("notifications", {
          onGranted: ["continue"],
          onDenied: [{ type: "dismiss" }],
        }),
      ],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledWith({ status: "dismissed" });
    error.mockRestore();
  });

  // An ask whose only authored escape IS a bare `"continue"` still advances —
  // that is the author's own declared way forward, and withholding it would put
  // back the dead end finding 1 of round 1 closed.
  it("still advances bare when the authored escape was a continue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [ask("notifications", { onGranted: ["continue"], onDenied: ["continue"] })],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledWith();
    error.mockRestore();
  });

  // A declared `onUnavailable` is authored intent and always wins — including an
  // empty one, which is how an author says "do nothing here".
  it("prefers a declared onUnavailable over the escape", async () => {
    const onContinue = vi.fn();
    const ctx = makeCtx({ onContinue });
    await runActions(
      [
        ask("notifications", {
          onGranted: ["continue"],
          onUnavailable: [{ type: "setVariable", name: "why", value: "module-missing" }],
        }),
      ],
      ctx
    );
    expect(ctx.getVariables().why.value).toBe("module-missing");
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("prefers the host resolver over the bundled Expo one", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const ctx = makeCtx({ requestPermission });
    await runActions(
      [ask("notifications", { onGranted: [{ type: "setVariable", name: "push", value: "on" }] })],
      ctx
    );
    expect(ctx.getVariables().push.value).toBe("on");
  });

  // The seam HealthKit / Screen Time will use: a host resolver that only knows
  // some kinds returns `undefined` for the rest and the bundled resolver runs.
  it("falls back to the bundled resolver when the host resolver returns undefined", async () => {
    const requestPermission = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx({
      requestPermission,
      onContinue: vi.fn(),
    });
    await runActions(
      [ask("camera", { onGranted: ["continue"], onUnavailable: [{ type: "setVariable", name: "cam", value: "n/a" }] })],
      ctx
    );
    expect(requestPermission).toHaveBeenCalledWith("camera");
    expect(ctx.getVariables().cam.value).toBe("n/a");
  });
});

describe("normalizePermissionResponse", () => {
  it("reads the Expo PermissionResponse shape", () => {
    expect(normalizePermissionResponse({ status: "granted", granted: true })).toBe("granted");
    expect(normalizePermissionResponse({ status: "denied", granted: false })).toBe("denied");
    expect(normalizePermissionResponse({ status: "undetermined", granted: false })).toBe("denied");
  });

  // expo-tracking-transparency resolves `{ status: "restricted" }` with no
  // `granted` field on a device where ATT is disabled by policy.
  it("treats a status with no granted field as authoritative", () => {
    expect(normalizePermissionResponse({ status: "granted" })).toBe("granted");
    expect(normalizePermissionResponse({ status: "restricted" })).toBe("denied");
  });

  // A module whose API changed shape must not read as a grant.
  it("treats an unreadable response as unavailable, never as granted", () => {
    expect(normalizePermissionResponse(undefined)).toBe("unavailable");
    expect(normalizePermissionResponse(null)).toBe("unavailable");
    expect(normalizePermissionResponse("granted")).toBe("unavailable");
    expect(normalizePermissionResponse({})).toBe("unavailable");
  });
});

describe("pickPermissionRequester", () => {
  it("finds the first declared function present on the module", () => {
    const fn = () => Promise.resolve({ status: "granted" });
    expect(pickPermissionRequester({ b: fn }, ["a", "b"])).toBe(fn);
  });

  // expo-camera moved `requestCameraPermissionsAsync` between the `Camera`
  // namespace and the module root across SDK versions.
  it("looks one level into a namespace export", () => {
    const fn = () => Promise.resolve({ status: "granted" });
    expect(pickPermissionRequester({ Camera: { req: fn } }, ["req"])).toBe(fn);
  });

  it("returns null for a module that has none of them", () => {
    expect(pickPermissionRequester({ somethingElse: 1 }, ["req"])).toBeNull();
    expect(pickPermissionRequester(null, ["req"])).toBeNull();
  });
});
