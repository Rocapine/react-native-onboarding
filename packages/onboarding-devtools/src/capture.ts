import type { PaywallDevHook, PaywallShownInfo } from "@rocapine/react-native-onboarding";

export type PaywallCaptureOptions = {
  /** Project dev token (`onbs_dev_…`) minted in the Studio. Required. */
  token?: string;
  /** Wait after the paywall is shown, so entrance animations settle. Default 1000. */
  delayMs?: number;
  /**
   * Width in pixels the capture is scaled down to, aspect ratio kept. A view
   * already narrower is not upscaled. Default 390.
   */
  maxWidth?: number;
  /** JPEG quality, 0–1. Default 0.7. */
  quality?: number;
};

export type ResolvedCaptureOptions = Required<PaywallCaptureOptions> & { token: string };

export type CaptureRefOptions = {
  format: "jpg";
  quality: number;
  result: "base64";
  width?: number;
  height?: number;
};

/** Every device API the handler touches, injected so the logic runs under node. */
export type CaptureDeps = {
  captureRef: (ref: PaywallShownInfo["viewRef"], options: CaptureRefOptions) => Promise<string>;
  /** The view's layout size in points, or null when it cannot be measured. */
  measure: (ref: PaywallShownInfo["viewRef"]) => Promise<{ width: number; height: number } | null>;
  /** Device pixels per point (`PixelRatio.get()`). */
  pixelRatio: number;
  fetch: (
    url: string,
    init: { method: "POST"; headers: Record<string, string>; body: string },
  ) => Promise<{ ok: boolean; status: number }>;
  wait: (ms: number) => Promise<void>;
  warn: (...args: unknown[]) => void;
};

export const DEFAULTS = { delayMs: 1000, maxWidth: 390, quality: 0.7 } as const;

const TAG = "[onboarding-devtools]";

/** How long a `measure` that never calls back (a detached view) is waited for. */
const MEASURE_TIMEOUT_MS = 500;

/** Quality of the one recapture after a 413 (image over the server's limit). */
const RETRY_QUALITY_413 = 0.5;

/**
 * The `width`/`height` to hand react-native-view-shot so the image is
 * `min(maxWidth, view width in px)` pixels wide, aspect ratio kept. view-shot
 * resizes only when it gets BOTH, and in different units per platform: iOS
 * renders that size in points at device scale (so points = px / pixelRatio),
 * Android scales the bitmap to exactly that many pixels (integers). No usable
 * size → `{}`, i.e. view-shot's own full-resolution capture.
 */
export function captureSize(
  size: { width: number; height: number } | null,
  maxWidth: number,
  pixelRatio: number,
  platform: PaywallShownInfo["platform"],
): { width?: number; height?: number } {
  if (!size || !(size.width > 0) || !(size.height > 0) || !(pixelRatio > 0)) return {};
  const widthPx = Math.min(maxWidth, size.width * pixelRatio);
  const heightPx = (widthPx * size.height) / size.width;
  if (platform === "ios") return { width: widthPx / pixelRatio, height: heightPx / pixelRatio };
  return { width: Math.max(1, Math.round(widthPx)), height: Math.max(1, Math.round(heightPx)) };
}

/** 4xx answers that can change on a later try (timeout, rate limit). */
const RETRYABLE_4XX = new Set([408, 429]);

/**
 * Captures each paywall once per (paywallId, platform) per session and uploads it.
 * Never throws or rejects: every failure is one `warn`.
 *
 * A 413 (image too large) is retried once at once, recaptured at quality 0.5.
 *
 * A pair is marked done on success and on a 4xx other than 408/429 (bad token, wrong project, still
 * too large — showing it again will not change the answer, so retrying would only
 * repeat the warning). A failed capture (paywall dismissed before the delay), a
 * 408, 429, 5xx or a network error leaves it open, so the next show retries.
 */
export function createCaptureHandler(deps: CaptureDeps, opts: ResolvedCaptureOptions): PaywallDevHook {
  const done = new Set<string>();
  const inFlight = new Set<string>();

  return async (info) => {
    const key = `${info.paywallId}\u0000${info.platform}`;
    if (done.has(key) || inFlight.has(key)) return;
    inFlight.add(key);
    try {
      await deps.wait(opts.delayMs);

      const size = await Promise.race([
        deps.measure(info.viewRef).catch(() => null),
        deps.wait(MEASURE_TIMEOUT_MS).then(() => null),
      ]);
      const shot: CaptureRefOptions = {
        format: "jpg",
        quality: opts.quality,
        result: "base64",
        ...captureSize(size, opts.maxWidth, deps.pixelRatio, info.platform),
      };

      const captureAndUpload = async (quality: number) => {
        let image: string;
        try {
          image = await deps.captureRef(info.viewRef, { ...shot, quality });
        } catch (e) {
          deps.warn(`${TAG} could not capture paywall "${info.paywallName}" (dismissed within ${opts.delayMs}ms?)`, e);
          return null;
        }
        return deps.fetch(`${info.functionsBaseUrl}/upload-paywall-screenshot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            paywallId: info.paywallId,
            platform: info.platform,
            appVersion: info.appVersion,
            sdkVersion: info.sdkVersion,
            image: image.replace(/^data:[^,]*,/, ""),
          }),
        });
      };

      let res = await captureAndUpload(opts.quality);
      if (res?.status === 413 && opts.quality > RETRY_QUALITY_413) res = await captureAndUpload(RETRY_QUALITY_413);
      if (!res) return;
      if (res.ok) {
        done.add(key);
        return;
      }
      if (res.status >= 400 && res.status < 500 && !RETRYABLE_4XX.has(res.status)) done.add(key);
      deps.warn(`${TAG} screenshot upload for paywall "${info.paywallName}" failed: HTTP ${res.status}`);
    } catch (e) {
      deps.warn(`${TAG} screenshot upload for paywall "${info.paywallName}" failed`, e);
    } finally {
      inFlight.delete(key);
    }
  };
}
