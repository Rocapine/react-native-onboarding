import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { PaywallShownInfo } from "@rocapine/react-native-onboarding";
import { createCaptureHandler, type CaptureDeps } from "../capture";

const { setPaywallDevHook } = vi.hoisted(() => ({ setPaywallDevHook: vi.fn() }));
vi.mock("@rocapine/react-native-onboarding", () => ({ setPaywallDevHook }));
vi.mock("react-native-view-shot", () => ({ captureRef: vi.fn() }));

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

type FakeDeps = { [K in keyof CaptureDeps]: Mock<CaptureDeps[K]> };

function fakeDeps(over: Partial<FakeDeps> = {}): FakeDeps {
  return {
    captureRef: vi.fn<CaptureDeps["captureRef"]>(async () => "BASE64"),
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

  it("captures with jpg, quality 0.7, width 390 after 1000ms", async () => {
    const deps = fakeDeps();
    const i = info();
    await createCaptureHandler(deps, OPTS)(i);
    expect(deps.wait).toHaveBeenCalledWith(1000);
    expect(deps.captureRef).toHaveBeenCalledWith(i.viewRef, {
      format: "jpg",
      quality: 0.7,
      width: 390,
      result: "base64",
    });
    expect(deps.wait.mock.invocationCallOrder[0]).toBeLessThan(
      deps.captureRef.mock.invocationCallOrder[0],
    );
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
