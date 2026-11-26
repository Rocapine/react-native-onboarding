import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { StepShownInfo } from "@rocapine/react-native-onboarding";
import { createStepCaptureHandler, type StepCaptureDeps } from "../capture";

const { setPaywallDevHook, setStepDevHook } = vi.hoisted(() => ({
  setPaywallDevHook: vi.fn(),
  setStepDevHook: vi.fn(),
}));
vi.mock("@rocapine/react-native-onboarding", () => ({ setPaywallDevHook, setStepDevHook }));
vi.mock("react-native-view-shot", () => ({ captureRef: vi.fn(), captureScreen: vi.fn() }));
vi.mock("react-native", () => ({
  PixelRatio: { get: () => 3 },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}));

const info = (over: Partial<StepShownInfo> = {}): StepShownInfo => ({
  onboardingId: "o1",
  stepId: "s1",
  stepName: "Welcome",
  customScreenId: "welcome-screen",
  locale: "en",
  draft: false,
  platform: "ios",
  appVersion: "2.3.0",
  sdkVersion: "1.80.0",
  projectId: "proj",
  functionsBaseUrl: "https://x/functions/v1",
  viewRef: { current: {} },
  isActive: () => true,
  ...over,
});

type FakeDeps = {
  [K in keyof StepCaptureDeps]: StepCaptureDeps[K] extends (...args: any[]) => any
    ? Mock<StepCaptureDeps[K]>
    : StepCaptureDeps[K];
};

function fakeDeps(over: Partial<FakeDeps> = {}): FakeDeps {
  return {
    captureRef: vi.fn<StepCaptureDeps["captureRef"]>(async () => "BASE64"),
    captureScreen: vi.fn<StepCaptureDeps["captureScreen"]>(async () => "SCREEN64"),
    screen: vi.fn<StepCaptureDeps["screen"]>(() => ({ width: 390, height: 844 })),
    measure: vi.fn<StepCaptureDeps["measure"]>(async () => ({ width: 390, height: 844 })),
    pixelRatio: 3,
    fetch: vi.fn<StepCaptureDeps["fetch"]>(async () => ({ ok: true, status: 200 })),
    wait: vi.fn<StepCaptureDeps["wait"]>(async () => {}),
    warn: vi.fn<StepCaptureDeps["warn"]>(),
    ...over,
  };
}

const OPTS = { token: "onbs_dev_abc", delayMs: 1000, maxWidth: 390, quality: 0.7 };

describe("createStepCaptureHandler", () => {
  it("uploads once per onboarding, step and platform, whatever the locale", async () => {
    const deps = fakeDeps();
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info({ locale: "fr", draft: true }));
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(deps.fetch).toHaveBeenCalledWith("https://x/functions/v1/upload-step-screenshot", {
      method: "POST",
      headers: { Authorization: "Bearer onbs_dev_abc", "Content-Type": "application/json" },
      body: JSON.stringify({
        onboardingId: "o1",
        stepId: "s1",
        platform: "ios",
        customScreenId: "welcome-screen",
        locale: "en",
        draft: false,
        appVersion: "2.3.0",
        sdkVersion: "1.80.0",
        image: "BASE64",
      }),
    });
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it("another platform or step is a different key", async () => {
    const deps = fakeDeps();
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info({ platform: "android" }));
    await hook(info({ stepId: "s2" }));
    expect(deps.fetch).toHaveBeenCalledTimes(3);
  });

  it("viewRef with a view → captureRef, sized from the measured view", async () => {
    const deps = fakeDeps();
    const i = info();
    await createStepCaptureHandler(deps, OPTS)(i);
    expect(deps.measure).toHaveBeenCalledWith(i.viewRef);
    expect(deps.captureRef).toHaveBeenCalledWith(i.viewRef, {
      format: "jpg",
      quality: 0.7,
      result: "base64",
      width: 130,
      height: 844 / 3,
    });
    expect(deps.captureScreen).not.toHaveBeenCalled();
  });

  it("viewRef null → captureScreen sized from the screen, never captureRef", async () => {
    const deps = fakeDeps();
    await createStepCaptureHandler(deps, OPTS)(info({ viewRef: null }));
    expect(deps.captureRef).not.toHaveBeenCalled();
    expect(deps.measure).not.toHaveBeenCalled();
    expect(deps.captureScreen).toHaveBeenCalledWith({
      format: "jpg",
      quality: 0.7,
      result: "base64",
      width: 130,
      height: 844 / 3,
    });
    expect(JSON.parse(deps.fetch.mock.calls[0][1].body).image).toBe("SCREEN64");
  });

  it("viewRef attached to nothing → no capture, warned once naming the step, retried later", async () => {
    const deps = fakeDeps();
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info({ viewRef: { current: null } }));
    await hook(info({ viewRef: { current: null } }));
    expect(deps.captureRef).not.toHaveBeenCalled();
    expect(deps.captureScreen).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    expect(String(deps.warn.mock.calls[0][0])).toContain('step "Welcome"');
    await hook(info());
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("isActive false when the delay ends → no capture, no fetch, no warn; a later show uploads", async () => {
    const deps = fakeDeps();
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info({ isActive: () => false }));
    expect(deps.captureRef).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.warn).not.toHaveBeenCalled();
    await hook(info());
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("isActive turning false between capture and upload → no fetch, retried later", async () => {
    let active = true;
    const deps = fakeDeps({
      captureRef: vi
        .fn<StepCaptureDeps["captureRef"]>(async () => "BASE64")
        .mockImplementationOnce(async () => {
          active = false;
          return "BASE64";
        }),
    });
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info({ isActive: () => active }));
    expect(deps.captureRef).toHaveBeenCalledTimes(1);
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.warn).not.toHaveBeenCalled();
    active = true;
    await hook(info({ isActive: () => active }));
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("a concurrent show of the same key is ignored while one is in flight", async () => {
    let release!: () => void;
    const deps = fakeDeps({ wait: vi.fn<StepCaptureDeps["wait"]>(() => new Promise((r) => (release = r))) });
    const hook = createStepCaptureHandler(deps, OPTS);
    const first = hook(info());
    await hook(info());
    release();
    await first;
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("404 → warned once naming the step, key done", async () => {
    const deps = fakeDeps({ fetch: vi.fn<StepCaptureDeps["fetch"]>(async () => ({ ok: false, status: 404 })) });
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info());
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(deps.warn).toHaveBeenCalledTimes(1);
    expect(String(deps.warn.mock.calls[0][0])).toContain('step "Welcome"');
    expect(String(deps.warn.mock.calls[0][0])).toContain("HTTP 404");
  });

  it("503 → retried on the next show", async () => {
    const fetch = vi
      .fn<StepCaptureDeps["fetch"]>()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, status: 200 });
    const deps = fakeDeps({ fetch });
    const hook = createStepCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info());
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("413 → one recapture at quality 0.5", async () => {
    const fetch = vi
      .fn<StepCaptureDeps["fetch"]>()
      .mockResolvedValueOnce({ ok: false, status: 413 })
      .mockResolvedValue({ ok: true, status: 200 });
    const deps = fakeDeps({ fetch });
    await createStepCaptureHandler(deps, OPTS)(info());
    expect(deps.captureRef).toHaveBeenCalledTimes(2);
    expect(deps.captureRef.mock.calls[1][1].quality).toBe(0.5);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it("413, then the step loses focus during the recapture → no second fetch", async () => {
    let active = true;
    const fetch = vi.fn<StepCaptureDeps["fetch"]>().mockResolvedValueOnce({ ok: false, status: 413 });
    const captureRef = vi
      .fn<StepCaptureDeps["captureRef"]>()
      .mockResolvedValueOnce("BIG")
      .mockImplementationOnce(async () => {
        active = false;
        return "SMALL";
      });
    const deps = fakeDeps({ fetch, captureRef });
    await createStepCaptureHandler(deps, OPTS)(info({ isActive: () => active }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it("a failed capture warns naming the step and never rejects", async () => {
    const deps = fakeDeps({
      captureScreen: vi.fn<StepCaptureDeps["captureScreen"]>(async () => Promise.reject(new Error("no window"))),
    });
    await expect(createStepCaptureHandler(deps, OPTS)(info({ viewRef: null }))).resolves.toBeUndefined();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    expect(String(deps.warn.mock.calls[0][0])).toContain('step "Welcome"');
  });
});

describe("enableScreenCapture", () => {
  beforeEach(() => {
    setPaywallDevHook.mockReset();
    setStepDevHook.mockReset();
  });

  it("registers the paywall and step hooks by default; disable clears both", async () => {
    const { enableScreenCapture } = await import("../index");
    const disable = enableScreenCapture({ token: "onbs_dev_abc" });
    expect(setPaywallDevHook).toHaveBeenCalledWith(expect.any(Function));
    expect(setStepDevHook).toHaveBeenCalledWith(expect.any(Function));
    disable();
    expect(setPaywallDevHook).toHaveBeenLastCalledWith(null);
    expect(setStepDevHook).toHaveBeenLastCalledWith(null);
  });

  it("steps: false registers no step hook", async () => {
    const { enableScreenCapture } = await import("../index");
    const disable = enableScreenCapture({ token: "onbs_dev_abc", steps: false });
    expect(setPaywallDevHook).toHaveBeenCalledWith(expect.any(Function));
    disable();
    expect(setStepDevHook).not.toHaveBeenCalled();
  });

  it("enablePaywallCapture is the same function", async () => {
    const { enableScreenCapture, enablePaywallCapture } = await import("../index");
    expect(enablePaywallCapture).toBe(enableScreenCapture);
  });
});
