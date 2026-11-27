import type React from "react";
import { useEffect, useRef } from "react";
import { Platform, type View } from "react-native";
import { OnboardingStudio } from "../OnboardingStudio";
import type { OnboardingStudioClient } from "../OnboardingStudioClient";
import { hasStepDevHook, notifyStepShown } from "./devHook";
import { buildStepShownInfo } from "./stepShownInfo";

/**
 * For apps that render steps themselves: tells a registered step dev hook
 * (devtools only) that a custom-screen step is on screen. Fires once per mount
 * and again if `step.id` changes. No-op without a registered hook or a client;
 * never throws.
 *
 * Put the returned ref on a wrapping `<View collapsable={false}>`.
 */
export function useReportStepShown(args: {
  onboardingId: string;
  step: { id: string; name?: string; type: string; payload?: unknown };
  locale?: string | null;
  draft?: boolean;
  client?: OnboardingStudioClient;
}): React.RefObject<React.ComponentRef<typeof View> | null> {
  const viewRef = useRef<React.ComponentRef<typeof View>>(null);
  const { onboardingId, step, locale, draft, client } = args;
  const stepId = step.id;

  useEffect(() => {
    let active = true;
    if (hasStepDevHook()) {
      try {
        const resolved = client ?? OnboardingStudio.getClient();
        if (resolved) {
          const info = buildStepShownInfo({
            step: step as { id: string; name?: string; type: string; payload?: { customScreenId?: unknown } },
            metadata: { id: onboardingId, locale: locale ?? undefined, draft },
            client: resolved,
            platform: Platform.OS,
            viewRef,
            isActive: () => active,
          });
          if (info) notifyStepShown(info);
        }
      } catch (e) {
        console.warn(`[Onboarding] could not describe step "${stepId}" to the step dev hook`, e);
      }
    }
    return () => {
      active = false;
    };
    // Once per step id, not per render: `step`/`locale` identity may churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, onboardingId, client]);

  return viewRef;
}
