import type {
  PaywallDevHook,
  PaywallShownInfo,
  StepDevHook,
  StepShownInfo,
} from "@rocapine/react-native-onboarding";

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
  /** Also capture custom onboarding steps. Default true. */
  steps?: boolean;
};

export type ResolvedCaptureOptions = Required<Omit<PaywallCaptureOptions, "steps">> & { token: string };

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

/** What the step handler needs on top of `CaptureDeps`: the whole-screen capture. */
export type StepCaptureDeps = CaptureDeps & {
  captureScreen: (options: CaptureRefOptions) => Promise<string>;
  /** Screen size in points (`Dimensions.get("screen")`), to size a whole-screen capture. */
  screen: () => { width: number; height: number };
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

/** "done": never try this key again this session. "retry": the next show tries again. */
type Outcome = "done" | "retry";

type Attempt = {
  /** Captures the image at the given JPEG quality (base64, with or without a data: prefix). */
  shoot: (quality: number) => Promise<string>;
  url: string;
  /** The JSON body, given the bare base64 image. */
  body: (image: string) => Record<string, unknown>;
  /** e.g. `paywall "Main"`, used in every warning. */
  label: string;
  /** Appended to the capture-failure warning, e.g. `(dismissed within 1000ms?)`. */
  captureHint: string;
  /** Checked after every capture, before its upload; false → abort silently, retry later. */
  stillWanted: () => boolean;
};

/**
 * Capture, upload, and the retry rules, shared by paywalls and steps.
 * Never throws: every failure is one `warn` (except an abort from `stillWanted`, silent).
 *
 * A 413 (image too large) is retried once at once, recaptured at quality 0.5.
 * "done" on success and on a 4xx other than 408/429 (bad token, wrong project,
 * still too large: showing it again will not change the answer, so retrying
 * would only repeat the warning). A failed capture, an abort, a 408, 429, 5xx
 * or a network error is "retry".
 */
async function captureAndUploadWithRetries(
  deps: CaptureDeps,
  opts: ResolvedCaptureOptions,
  attempt: Attempt,
): Promise<Outcome> {
  try {
    const captureAndUpload = async (quality: number) => {
      let image: string;
      try {
        image = await attempt.shoot(quality);
      } catch (e) {
        // Left while the shot was being taken (e.g. unmounted during measure): an abort, not a failure.
        if (!attempt.stillWanted()) return null;
        deps.warn(`${TAG} could not capture ${attempt.label} ${attempt.captureHint}`, e);
        return null;
      }
      if (!attempt.stillWanted()) return null;
      return deps.fetch(attempt.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(attempt.body(image.replace(/^data:[^,]*,/, ""))),
      });
    };

    let res = await captureAndUpload(opts.quality);
    if (res?.status === 413 && opts.quality > RETRY_QUALITY_413) res = await captureAndUpload(RETRY_QUALITY_413);
    if (!res) return "retry";
    if (res.ok) return "done";
    const outcome: Outcome =
      res.status >= 400 && res.status < 500 && !RETRYABLE_4XX.has(res.status) ? "done" : "retry";
    deps.warn(`${TAG} screenshot upload for ${attempt.label} failed: HTTP ${res.status}`);
    return outcome;
  } catch (e) {
    deps.warn(`${TAG} screenshot upload for ${attempt.label} failed`, e);
    return "retry";
  }
}

/** The view's size, or null when it cannot be measured in time. */
function measureSize(deps: CaptureDeps, ref: Parameters<CaptureDeps["measure"]>[0]) {
  return Promise.race([deps.measure(ref).catch(() => null), deps.wait(MEASURE_TIMEOUT_MS).then(() => null)]);
}

function baseShot(quality: number, size: { width?: number; height?: number }): CaptureRefOptions {
  return { format: "jpg", quality, result: "base64", ...size };
}

/**
 * Captures each paywall once per (paywallId, platform) per session and uploads it.
 * Never throws or rejects: every failure is one `warn`. Retry rules: see
 * `captureAndUploadWithRetries`; a failed capture (paywall dismissed before the
 * delay) leaves the pair open, so the next show retries.
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
      const shot = baseShot(
        opts.quality,
        captureSize(await measureSize(deps, info.viewRef), opts.maxWidth, deps.pixelRatio, info.platform),
      );
      const outcome = await captureAndUploadWithRetries(deps, opts, {
        shoot: (quality) => deps.captureRef(info.viewRef, { ...shot, quality }),
        url: `${info.functionsBaseUrl}/upload-paywall-screenshot`,
        body: (image) => ({
          paywallId: info.paywallId,
          platform: info.platform,
          appVersion: info.appVersion,
          sdkVersion: info.sdkVersion,
          image,
        }),
        label: `paywall "${info.paywallName}"`,
        captureHint: `(dismissed within ${opts.delayMs}ms?)`,
        stillWanted: () => true,
      });
      if (outcome === "done") done.add(key);
    } catch (e) {
      deps.warn(`${TAG} screenshot upload for paywall "${info.paywallName}" failed`, e);
    } finally {
      inFlight.delete(key);
    }
  };
}

/**
 * Captures each custom onboarding step once per (onboardingId, stepId, platform)
 * per session and uploads it. Locale and draft are sent but are not part of the
 * key: one screenshot per step and platform.
 *
 * `viewRef` null → the whole screen (`captureScreen`, sized from the screen);
 * otherwise the ref's view, exactly as paywalls. A ref attached to nothing is
 * not captured (one warning per key): falling back to the whole screen would
 * store whatever surrounds the step.
 *
 * `isActive()` false after the delay or after the capture → no upload, no
 * warning, and the key stays open so the next show captures it. Upload retry
 * rules are the paywall's (`captureAndUploadWithRetries`). Never rejects.
 */
export function createStepCaptureHandler(deps: StepCaptureDeps, opts: ResolvedCaptureOptions): StepDevHook {
  const done = new Set<string>();
  const inFlight = new Set<string>();
  const warnedNoView = new Set<string>();

  return async (info: StepShownInfo) => {
    const key = `${info.onboardingId}\u0000${info.stepId}\u0000${info.platform}`;
    if (done.has(key) || inFlight.has(key)) return;
    inFlight.add(key);
    const label = `step "${info.stepName}"`;
    try {
      await deps.wait(opts.delayMs);
      if (!info.isActive()) return;

      const { viewRef } = info;
      let shoot: (quality: number) => Promise<string>;
      if (viewRef === null) {
        // Android: view-shot's captureScreen shoots the window's content view
        // (android.R.id.content), which can exclude the status/nav bars that
        // `screen` includes, and force-scales to any width+height given
        // (createScaledBitmap), so sizing from the screen could stretch it. No
        // JS size matches that view, so Android captures at full resolution: a
        // 1080x2400 photo-heavy JPEG measured ~650 KB at q0.7 and ~400 KB at q0.5,
        // under the 1 MiB image limit, and a 413 still recaptures at q0.5.
        // iOS captures the whole window, which `screen` does match.
        const size =
          info.platform === "android"
            ? {}
            : captureSize(deps.screen(), opts.maxWidth, deps.pixelRatio, info.platform);
        const shot = baseShot(opts.quality, size);
        shoot = (quality) => deps.captureScreen({ ...shot, quality });
      } else if (viewRef.current == null) {
        if (!warnedNoView.has(key)) {
          warnedNoView.add(key);
          deps.warn(
            `${TAG} could not capture ${label}: its viewRef is not attached to a view ` +
              "(put the ref from useReportStepShown on the step's root view)",
          );
        }
        return;
      } else {
        const shot = baseShot(
          opts.quality,
          captureSize(await measureSize(deps, viewRef), opts.maxWidth, deps.pixelRatio, info.platform),
        );
        shoot = (quality) => deps.captureRef(viewRef, { ...shot, quality });
      }

      const outcome = await captureAndUploadWithRetries(deps, opts, {
        shoot,
        url: `${info.functionsBaseUrl}/upload-step-screenshot`,
        body: (image) => ({
          onboardingId: info.onboardingId,
          stepId: info.stepId,
          platform: info.platform,
          customScreenId: info.customScreenId,
          locale: info.locale,
          draft: info.draft,
          appVersion: info.appVersion,
          sdkVersion: info.sdkVersion,
          image,
        }),
        label,
        captureHint: `(left within ${opts.delayMs}ms?)`,
        stillWanted: () => info.isActive(),
      });
      if (outcome === "done") done.add(key);
    } catch (e) {
      deps.warn(`${TAG} screenshot upload for ${label} failed`, e);
    } finally {
      inFlight.delete(key);
    }
  };
}
