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
  normalizePermissionResponse,
  pickPermissionRequester,
  requestPermissionViaExpoModules,
} from "../elements/permissions";

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

  // CHARACTERIZATION, not an endorsement. A terminal action nested in an outcome
  // hook does NOT stop the OUTER list: `runActions` recurses, the recursive call
  // returns, and the outer `for` moves on. That is pre-existing behaviour shared
  // with `purchase.onSuccess` / `restore.onSuccess` (nothing in the suite pinned
  // it before), and `requestPermission` inherits it rather than diverging. Pinned
  // here so a later fix is a deliberate, cross-action decision — see the
  // follow-up on #196.
  it("does NOT stop the outer loop when a nested outcome hook is terminal", async () => {
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
    expect(ctx.getVariables().after.value).toBe("written");
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
    await expect(
      runActions(
        [ask("camera", { onUnavailable: [{ type: "setVariable", name: "cam", value: "n/a" }] })],
        ctx
      )
    ).resolves.toBeUndefined();
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

  // The decision this PR makes explicit: the repo's silent-no-op convention for
  // an optional press-time dep (haptics) would strand a user on a screen whose
  // only "continue" lives in onGranted. Falling back to onDenied means an author
  // who declared both real outcomes is safe by default.
  it("falls back to onDenied when onUnavailable is absent, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [ask("notifications", { onGranted: [{ type: "setVariable", name: "push", value: "on" }], onDenied: ["continue"] })],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("onUnavailable"))).toBe(true);
    warn.mockRestore();
  });

  it("reports an error when neither onUnavailable nor onDenied is declared", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runActions([ask("notifications", { onGranted: ["continue"] })], makeCtx());
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toContain("onUnavailable");
    error.mockRestore();
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
