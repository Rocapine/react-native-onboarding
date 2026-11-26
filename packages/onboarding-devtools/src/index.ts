import { setPaywallDevHook } from "@rocapine/react-native-onboarding";
import { PixelRatio } from "react-native";
import { captureRef } from "react-native-view-shot";
import { createCaptureHandler, DEFAULTS, type PaywallCaptureOptions } from "./capture";

export type { PaywallCaptureOptions } from "./capture";

/**
 * Debug builds only. Captures every paywall the SDK shows and uploads it to the
 * Studio as that paywall's screenshot. Register it behind `__DEV__` with a
 * `require`, never a top-level import, so release bundles do not contain it:
 *
 *   if (__DEV__) {
 *     require("@rocapine/react-native-onboarding-devtools").enablePaywallCapture({
 *       token: process.env.EXPO_PUBLIC_ONBS_DEV_TOKEN,
 *     });
 *   }
 *
 * Returns a function that unregisters the hook. Without a token it warns and
 * registers nothing.
 */
export function enablePaywallCapture(options: PaywallCaptureOptions): () => void {
  if (!options.token) {
    console.warn(
      "[onboarding-devtools] enablePaywallCapture: no token, paywall capture is off. " +
        "Pass the project dev token from the Studio (e.g. EXPO_PUBLIC_ONBS_DEV_TOKEN).",
    );
    return () => {};
  }
  setPaywallDevHook(
    createCaptureHandler(
      {
        captureRef: (ref, opts) => captureRef(ref, opts),
        measure: (ref) =>
          new Promise((resolve) => {
            const view = ref.current as { measure?: (cb: (...l: number[]) => void) => void } | null;
            if (typeof view?.measure !== "function") return resolve(null);
            view.measure((_x, _y, width, height) => resolve({ width, height }));
          }),
        pixelRatio: PixelRatio.get(),
        fetch: (url, init) => fetch(url, init),
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        warn: (...args) => console.warn(...args),
      },
      {
        token: options.token,
        delayMs: options.delayMs ?? DEFAULTS.delayMs,
        maxWidth: options.maxWidth ?? DEFAULTS.maxWidth,
        quality: options.quality ?? DEFAULTS.quality,
      },
    ),
  );
  return () => setPaywallDevHook(null);
}
