import type { PaywallDevHook, PaywallShownInfo } from "@rocapine/react-native-onboarding";

export type PaywallCaptureOptions = {
  /** Project dev token (`onbs_dev_…`) minted in the Studio. Required. */
  token?: string;
  /** Wait after the paywall is shown, so entrance animations settle. Default 1000. */
  delayMs?: number;
  /** Width in px the capture is scaled to. Default 390. */
  maxWidth?: number;
  /** JPEG quality, 0–1. Default 0.7. */
  quality?: number;
};

export type ResolvedCaptureOptions = Required<PaywallCaptureOptions> & { token: string };

/** Every device API the handler touches, injected so the logic runs under node. */
export type CaptureDeps = {
  captureRef: (
    ref: PaywallShownInfo["viewRef"],
    options: { format: "jpg"; quality: number; width: number; result: "base64" },
  ) => Promise<string>;
  fetch: (
    url: string,
    init: { method: "POST"; headers: Record<string, string>; body: string },
  ) => Promise<{ ok: boolean; status: number }>;
  wait: (ms: number) => Promise<void>;
  warn: (...args: unknown[]) => void;
};

export const DEFAULTS = { delayMs: 1000, maxWidth: 390, quality: 0.7 } as const;

const TAG = "[onboarding-devtools]";

/**
 * Captures each paywall once per (paywallId, platform) per session and uploads it.
 * Never throws or rejects: every failure is one `warn`.
 *
 * A pair is marked done on success and on a 4xx (bad token, wrong project, too
 * large — showing it again will not change the answer, so retrying would only
 * repeat the warning). A failed capture (paywall dismissed before the delay), a
 * 5xx or a network error leaves it open, so the next show retries.
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

      let image: string;
      try {
        image = await deps.captureRef(info.viewRef, {
          format: "jpg",
          quality: opts.quality,
          width: opts.maxWidth,
          result: "base64",
        });
      } catch (e) {
        deps.warn(`${TAG} could not capture paywall "${info.paywallName}" (dismissed within ${opts.delayMs}ms?)`, e);
        return;
      }

      const res = await deps.fetch(`${info.functionsBaseUrl}/upload-paywall-screenshot`, {
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
      if (res.ok) {
        done.add(key);
        return;
      }
      if (res.status >= 400 && res.status < 500) done.add(key);
      deps.warn(`${TAG} screenshot upload for paywall "${info.paywallName}" failed: HTTP ${res.status}`);
    } catch (e) {
      deps.warn(`${TAG} screenshot upload for paywall "${info.paywallName}" failed`, e);
    } finally {
      inFlight.delete(key);
    }
  };
}
