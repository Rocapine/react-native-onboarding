import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { PaywallShownInfo } from "@rocapine/react-native-onboarding";
import { createCaptureHandler, type CaptureDeps } from "../capture";

const { setPaywallDevHook } = vi.hoisted(() => ({ setPaywallDevHook: vi.fn() }));
vi.mock("@rocapine/react-native-onboarding", () => ({ setPaywallDevHook }));
vi.mock("react-native-view-shot", () => ({ captureRef: vi.fn() }));
vi.mock("react-native", () => ({ PixelRatio: { get: () => 3 } }));

const info = (over: Partial<PaywallShownInfo> = {}): PaywallShownInfo => ({
  paywallId: "p1",
  paywallName: "Main paywall",
  renderMode: "elements",
  customScreenId: null,
  platform: "ios",
  appVersion: "2.3.0",
  sdkVersion: "1.79.0",
  projectId: "proj",
  functionsBaseUrl: "https://x/functions/v1",
  viewRef: { current: {} },
  ...over,
});

type FakeDeps = {
  [K in keyof CaptureDeps]: CaptureDeps[K] extends (...args: any[]) => any ? Mock<CaptureDeps[K]> : CaptureDeps[K];
};

function fakeDeps(over: Partial<FakeDeps> = {}): FakeDeps {
  return {
    captureRef: vi.fn<CaptureDeps["captureRef"]>(async () => "BASE64"),
    measure: vi.fn<CaptureDeps["measure"]>(async () => ({ width: 390, height: 844 })),
    pixelRatio: 3,
    fetch: vi.fn<CaptureDeps["fetch"]>(async () => ({ ok: true, status: 200 })),
    wait: vi.fn<CaptureDeps["wait"]>(async () => {}),
    warn: vi.fn<CaptureDeps["warn"]>(),
    ...over,
  };
}

const OPTS = { token: "onbs_dev_abc", delayMs: 1000, maxWidth: 390, quality: 0.7 };

describe("createCaptureHandler", () => {
  it("uploads once per paywall and platform per session", async () => {
    const deps = fakeDeps();
    const hook = createCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info());
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    await hook(info({ platform: "android" }));
    await hook(info({ paywallId: "p2" }));
    expect(deps.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not double-upload two overlapping shows", async () => {
    const deps = fakeDeps();
    const hook = createCaptureHandler(deps, OPTS);
    await Promise.all([hook(info()), hook(info())]);
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("posts the wire body", async () => {
    const deps = fakeDeps();
    await createCaptureHandler(deps, OPTS)(info());
    expect(deps.fetch).toHaveBeenCalledWith("https://x/functions/v1/upload-paywall-screenshot", {
      method: "POST",
      headers: { Authorization: "Bearer onbs_dev_abc", "Content-Type": "application/json" },
      body: expect.any(String),
    });
    const body = JSON.parse(deps.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      paywallId: "p1",
      platform: "ios",
      appVersion: "2.3.0",
      sdkVersion: "1.79.0",
      image: "BASE64",
    });
  });

  it("strips a data: prefix from the image", async () => {
    const deps = fakeDeps({ captureRef: vi.fn<CaptureDeps["captureRef"]>(async () => "data:image/jpeg;base64,QUJD") });
    await createCaptureHandler(deps, OPTS)(info());
    const body = JSON.parse(deps.fetch.mock.calls[0][1].body);
    expect(body.image).toBe("QUJD");
  });

  it("iOS: captures jpg at quality 0.7 after 1000ms, sized in points so the output is maxWidth px wide", async () => {
    const deps = fakeDeps();
    const i = info();
    await createCaptureHandler(deps, OPTS)(i);
    expect(deps.wait).toHaveBeenCalledWith(1000);
    expect(deps.measure).toHaveBeenCalledWith(i.viewRef);
    const [ref, opts] = deps.captureRef.mock.calls[0];
    expect(ref).toBe(i.viewRef);
    expect(opts).toMatchObject({ format: "jpg", quality: 0.7, result: "base64" });
    // view-shot on iOS renders `width`×`height` points at device scale (3).
    expect(opts.width! * 3).toBeCloseTo(390);
    expect(opts.height! * 3).toBeCloseTo(844 * 3 * (390 / 1170));
    expect(deps.wait.mock.invocationCallOrder[0]).toBeLessThan(
      deps.captureRef.mock.invocationCallOrder[0],
    );
  });

  it("Android: passes width and height in pixels, rounded, aspect ratio kept", async () => {
    const deps = fakeDeps({
      measure: vi.fn<CaptureDeps["measure"]>(async () => ({ width: 411, height: 914 })),
      pixelRatio: 2.625,
    });
    await createCaptureHandler(deps, OPTS)(info({ platform: "android" }));
    expect(deps.captureRef.mock.calls[0][1]).toMatchObject({ width: 390, height: 867 });
  });

  it("never upscales a view narrower than maxWidth", async () => {
    const deps = fakeDeps({
      measure: vi.fn<CaptureDeps["measure"]>(async () => ({ width: 300, height: 600 })),
      pixelRatio: 1,
    });
    await createCaptureHandler(deps, OPTS)(info({ platform: "android" }));
    expect(deps.captureRef.mock.calls[0][1]).toMatchObject({ width: 300, height: 600 });
  });

  it("measure fails or reports no size → captures without width/height", async () => {
    for (const measure of [
      vi.fn<CaptureDeps["measure"]>(async () => null),
      vi.fn<CaptureDeps["measure"]>(async () => ({ width: 0, height: 0 })),
      vi.fn<CaptureDeps["measure"]>(async () => Promise.reject(new Error("detached"))),
    ]) {
      const deps = fakeDeps({ measure });
      await createCaptureHandler(deps, OPTS)(info());
      const opts = deps.captureRef.mock.calls[0][1];
      expect(opts).not.toHaveProperty("width");
      expect(opts).not.toHaveProperty("height");
      expect(deps.fetch).toHaveBeenCalledTimes(1);
      expect(deps.warn).not.toHaveBeenCalled();
    }
  });

  it("a measure that never calls back times out and the capture still goes ahead", async () => {
    const deps = fakeDeps({ measure: vi.fn<CaptureDeps["measure"]>(() => new Promise(() => {})) });
    await createCaptureHandler(deps, OPTS)(info());
    expect(deps.captureRef.mock.calls[0][1]).not.toHaveProperty("width");
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("413 → recaptures once at quality 0.5, same size, and a success is done with no warning", async () => {
    const fetch = vi
      .fn<CaptureDeps["fetch"]>()
      .mockResolvedValueOnce({ ok: false, status: 413 })
      .mockResolvedValue({ ok: true, status: 200 });
    const deps = fakeDeps({ fetch });
    const hook = createCaptureHandler(deps, OPTS);
    await hook(info());
    expect(deps.captureRef).toHaveBeenCalledTimes(2);
    const [first, second] = deps.captureRef.mock.calls.map((c) => c[1]);
    expect(second).toEqual({ ...first, quality: 0.5 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deps.warn).not.toHaveBeenCalled();
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("413 twice → one warning, not retried this session", async () => {
    const fetch = vi.fn<CaptureDeps["fetch"]>(async () => ({ ok: false, status: 413 }));
    const deps = fakeDeps({ fetch });
    const hook = createCaptureHandler(deps, OPTS);
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deps.warn).toHaveBeenCalledTimes(1);
    expect(String(deps.warn.mock.calls[0][0])).toContain("413");
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("413 at quality <= 0.5 is not retried (it cannot shrink)", async () => {
    const fetch = vi.fn<CaptureDeps["fetch"]>(async () => ({ ok: false, status: 413 }));
    const deps = fakeDeps({ fetch });
    await createCaptureHandler(deps, { ...OPTS, quality: 0.4 })(info());
    expect(deps.captureRef).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(deps.warn).toHaveBeenCalledTimes(1);
  });

  it("413 then the recapture fails → one warning, retried on a later show", async () => {
    const captureRef = vi
      .fn<CaptureDeps["captureRef"]>()
      .mockResolvedValueOnce("BASE64")
      .mockRejectedValueOnce(new Error("view unmounted"))
      .mockResolvedValue("BASE64");
    const fetch = vi
      .fn<CaptureDeps["fetch"]>()
      .mockResolvedValueOnce({ ok: false, status: 413 })
      .mockResolvedValue({ ok: true, status: 200 });
    const deps = fakeDeps({ captureRef, fetch });
    const hook = createCaptureHandler(deps, OPTS);
    await expect(hook(info())).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(deps.warn).toHaveBeenCalledTimes(1);
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("dismissed before delay → no upload, one warn, retried on a later show", async () => {
    const captureRef = vi
      .fn<CaptureDeps["captureRef"]>()
      .mockRejectedValueOnce(new Error("view unmounted"))
      .mockResolvedValue("BASE64");
    const deps = fakeDeps({ captureRef });
    const hook = createCaptureHandler(deps, OPTS);
    await expect(hook(info())).resolves.toBeUndefined();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    await hook(info());
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("non-2xx response → warn with status and paywall name", async () => {
    const deps = fakeDeps({ fetch: vi.fn<CaptureDeps["fetch"]>(async () => ({ ok: false, status: 403 })) });
    await createCaptureHandler(deps, OPTS)(info());
    expect(deps.warn).toHaveBeenCalledTimes(1);
    const msg = String(deps.warn.mock.calls[0][0]);
    expect(msg).toContain("403");
    expect(msg).toContain("Main paywall");
  });

  it("a 4xx is not retried in the session, a 5xx is", async () => {
    const fetch = vi
      .fn<CaptureDeps["fetch"]>()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValue({ ok: true, status: 200 });
    const deps = fakeDeps({ fetch });
    const hook = createCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info());
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("408 and 429 are retried on the next show", async () => {
    const fetch = vi
      .fn<CaptureDeps["fetch"]>()
      .mockResolvedValueOnce({ ok: false, status: 408 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue({ ok: true, status: 200 });
    const deps = fakeDeps({ fetch });
    const hook = createCaptureHandler(deps, OPTS);
    await hook(info());
    await hook(info());
    await hook(info());
    await hook(info());
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("a network error never rejects", async () => {
    const deps = fakeDeps({ fetch: vi.fn<CaptureDeps["fetch"]>(async () => Promise.reject(new Error("offline"))) });
    await expect(createCaptureHandler(deps, OPTS)(info())).resolves.toBeUndefined();
    expect(deps.warn).toHaveBeenCalledTimes(1);
  });
});

describe("enablePaywallCapture", () => {
  beforeEach(() => setPaywallDevHook.mockReset());

  it("missing token → warns once and registers nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { enablePaywallCapture } = await import("../index");
    const disable = enablePaywallCapture({});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(setPaywallDevHook).not.toHaveBeenCalled();
    disable();
    expect(setPaywallDevHook).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("with a token, registers a hook and disable clears it", async () => {
    const { enablePaywallCapture } = await import("../index");
    const disable = enablePaywallCapture({ token: "onbs_dev_abc" });
    expect(setPaywallDevHook).toHaveBeenCalledWith(expect.any(Function));
    disable();
    expect(setPaywallDevHook).toHaveBeenLastCalledWith(null);
  });
});
