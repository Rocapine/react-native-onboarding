import type React from "react";

/**
 * Devtools-only seam. A paywall renderer calls `notifyPaywallShown` once the
 * paywall is on screen; a devtools package registers the hook that reacts
 * (e.g. captures the view). Without a registered hook everything here is a
 * no-op, so production bundles pay nothing.
 */
export type PaywallShownInfo = {
  paywallId: string;
  paywallName: string;
  renderMode: "elements" | "custom";
  customScreenId: string | null;
  platform: "ios" | "android";
  appVersion: string | null;
  sdkVersion: string;
  projectId: string;
  functionsBaseUrl: string;
  viewRef: React.RefObject<unknown>;
};

/** May be async: a rejection is warned, never left unhandled. */
export type PaywallDevHook = (info: PaywallShownInfo) => void | Promise<void>;

let hook: PaywallDevHook | null = null;

export function setPaywallDevHook(next: PaywallDevHook | null): void {
  hook = next;
}

/** Lets renderers skip building `PaywallShownInfo` when nobody listens. */
export function hasPaywallDevHook(): boolean {
  return hook !== null;
}

export function notifyPaywallShown(info: PaywallShownInfo): void {
  if (!hook) return;
  const warn = (e: unknown) => console.warn(`paywall dev hook threw for "${info.paywallName}"`, e);
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
