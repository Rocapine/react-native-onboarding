import * as sdk from "@rocapine/react-native-onboarding";
import { Dimensions, PixelRatio } from "react-native";
import { captureRef, captureScreen } from "react-native-view-shot";
import {
  createCaptureHandler,
  createStepCaptureHandler,
  DEFAULTS,
  type PaywallCaptureOptions,
  type ResolvedCaptureOptions,
  type StepCaptureDeps,
} from "./capture";

export type { PaywallCaptureOptions } from "./capture";

const TAG = "[onboarding-devtools]";

/**
 * Debug builds only. Captures every paywall and every custom onboarding step
 * the SDK shows and uploads each to the Studio as its screenshot. Register it
 * behind `__DEV__` with a `require`, never a top-level import, so release
 * bundles do not contain it:
 *
 *   if (__DEV__) {
 *     require("@rocapine/react-native-onboarding-devtools").enableScreenCapture({
 *       token: process.env.EXPO_PUBLIC_ONBS_DEV_TOKEN,
 *     });
 *   }
 *
 * `steps: false` captures paywalls only. Returns a function that unregisters
 * the hooks it registered. Without a token it warns and registers nothing.
 */
export function enableScreenCapture(options: PaywallCaptureOptions): () => void {
  if (!options.token) {
    console.warn(
      `${TAG} enableScreenCapture: no token, screen capture is off. ` +
        "Pass the project dev token from the Studio (e.g. EXPO_PUBLIC_ONBS_DEV_TOKEN).",
    );
    return () => {};
  }
  // Every device API is read inside a closure, never here: a host may enable
  // capture before anything is on screen.
  const deps: StepCaptureDeps = {
    captureRef: (ref, opts) => captureRef(ref, opts),
    captureScreen: (opts) => captureScreen(opts),
    screen: () => Dimensions.get("screen"),
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
  };
  const resolved: ResolvedCaptureOptions = {
    token: options.token,
    delayMs: options.delayMs ?? DEFAULTS.delayMs,
    maxWidth: options.maxWidth ?? DEFAULTS.maxWidth,
    quality: options.quality ?? DEFAULTS.quality,
  };

  sdk.setPaywallDevHook(createCaptureHandler(deps, resolved));

  // The peer range admits SDK versions without the step hook (it arrived after
  // 1.79.0): checked with `in`, so such an SDK gets paywall capture only.
  const setStepDevHook = options.steps !== false && "setStepDevHook" in sdk ? sdk.setStepDevHook : null;
  if (options.steps !== false && !setStepDevHook) {
    console.warn(`${TAG} this SDK version does not report steps; only paywalls are captured. Update the SDK.`);
  }
  setStepDevHook?.(createStepCaptureHandler(deps, resolved));

  return () => {
    sdk.setPaywallDevHook(null);
    setStepDevHook?.(null);
  };
}

/** The original name, kept: hosts that call it get step capture with no code change. */
export const enablePaywallCapture = enableScreenCapture;
