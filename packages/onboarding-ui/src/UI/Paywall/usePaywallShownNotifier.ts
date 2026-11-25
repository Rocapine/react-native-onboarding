import { useEffect, useRef } from "react";
import { Platform, type View } from "react-native";
import {
  SDK_VERSION,
  hasPaywallDevHook,
  notifyPaywallShown,
} from "@rocapine/react-native-onboarding";
import type { OnboardingStudioClient } from "@rocapine/react-native-onboarding";

export type PaywallShownNotifierArgs = {
  /** The paywall is on screen now (the Modal's `onShow` confirmed it, or the inline step rendered it). */
  shown: boolean;
  paywall: {
    id: string;
    name: string;
    renderMode?: "elements" | "custom" | null;
    customScreenId?: string | null;
  } | null;
  client: OnboardingStudioClient | null | undefined;
};

/**
 * Tells a registered paywall dev hook (`setPaywallDevHook`, devtools only) that
 * a paywall is on screen, once per showing: when `shown` becomes true, and
 * again when a different paywall id takes the surface while it stays shown.
 *
 * Returns the ref the renderer puts on a wrapping
 * `<View collapsable={false} style={{ flex: 1 }}>`, handed to the hook as
 * `viewRef` (the view a devtool captures). Fires from an effect, so the ref is
 * attached by then.
 *
 * Without a registered hook it does nothing, not even read the client. It
 * never throws: building the info reads the native app version, and a dev
 * seam must not be able to break a paywall.
 */
export const usePaywallShownNotifier = ({
  shown,
  paywall,
  client,
}: PaywallShownNotifierArgs) => {
  const viewRef = useRef<View>(null);
  const notifiedId = useRef<string | null>(null);

  const id = paywall?.id ?? null;
  const name = paywall?.name ?? "";
  const renderMode = paywall?.renderMode === "custom" ? "custom" : "elements";
  const customScreenId = paywall?.customScreenId?.trim() || null;

  useEffect(() => {
    if (!shown || id === null) {
      notifiedId.current = null;
      return;
    }
    if (notifiedId.current === id) return;
    if (!hasPaywallDevHook() || !client) return;
    // The hook's `platform` is native-only; the studio's web preview is not a device.
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    notifiedId.current = id;
    try {
      notifyPaywallShown({
        paywallId: id,
        paywallName: name,
        renderMode,
        customScreenId: renderMode === "custom" ? customScreenId : null,
        platform: Platform.OS,
        // The resolved value: host option, else expo-application's.
        appVersion: client.identityParams().appVersion ?? null,
        sdkVersion: SDK_VERSION,
        projectId: client.projectId,
        functionsBaseUrl: client.functionsBaseUrl,
        viewRef,
      });
    } catch (e) {
      console.warn(`[Paywall] could not describe "${name}" to the paywall dev hook`, e);
    }
  }, [shown, id, name, renderMode, customScreenId, client]);

  return viewRef;
};
