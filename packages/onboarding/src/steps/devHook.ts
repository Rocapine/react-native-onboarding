import type React from "react";

/**
 * Devtools-only seam. A custom-screen step renderer calls `notifyStepShown`
 * once the step is on screen; a devtools package registers the hook that
 * reacts (e.g. captures the view). Without a registered hook everything here
 * is a no-op, so production bundles pay nothing.
 */
export type StepShownInfo = {
  onboardingId: string;
  stepId: string;
  stepName: string;
  customScreenId: string;
  locale: string | null;
  draft: boolean;
  platform: "ios" | "android";
  appVersion: string | null;
  sdkVersion: string;
  projectId: string;
  functionsBaseUrl: string;
  /** null → capture the whole screen. */
  viewRef: React.RefObject<unknown> | null;
  /** false once the step lost focus. */
  isActive: () => boolean;
};

/** May be async: a rejection is warned, never left unhandled. */
export type StepDevHook = (info: StepShownInfo) => void | Promise<void>;

let hook: StepDevHook | null = null;

export function setStepDevHook(next: StepDevHook | null): void {
  hook = next;
}

/** Lets renderers skip building `StepShownInfo` when nobody listens. */
export function hasStepDevHook(): boolean {
  return hook !== null;
}

export function notifyStepShown(info: StepShownInfo): void {
  if (!hook) return;
  const warn = (e: unknown) => console.warn(`step dev hook threw for "${info.stepName}"`, e);
  try {
    const result: unknown = hook(info);
    // `.then(undefined, …)`, not `.catch`: a bare thenable need not have one.
    if (result && typeof (result as PromiseLike<void>).then === "function") {
      (result as PromiseLike<void>).then(undefined, warn);
    }
  } catch (e) {
    warn(e);
  }
}
