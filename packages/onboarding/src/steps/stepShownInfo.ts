import type React from "react";
import type { OnboardingStudioClient } from "../OnboardingStudioClient";
import { SDK_VERSION } from "../version";
import type { StepShownInfo } from "./devHook";

/**
 * Describes a custom-screen step on screen for the step dev hook. Null when the
 * step is not a custom screen with a usable id, or the platform is not a
 * device (the hook's `platform` is native-only).
 */
export function buildStepShownInfo(args: {
  step: { id: string; name?: string; type: string; payload?: { customScreenId?: unknown } };
  metadata: { id: string; locale?: string; draft?: boolean };
  client: Pick<OnboardingStudioClient, "projectId" | "functionsBaseUrl" | "identityParams">;
  platform: string;
  viewRef: React.RefObject<unknown> | null;
  isActive: () => boolean;
}): StepShownInfo | null {
  const { step, metadata, client, platform, viewRef, isActive } = args;
  if (step.type !== "CustomScreen") return null;
  const customScreenId = step.payload?.customScreenId;
  if (typeof customScreenId !== "string" || customScreenId === "") return null;
  if (platform !== "ios" && platform !== "android") return null;
  return {
    onboardingId: metadata.id,
    stepId: step.id,
    stepName: step.name ?? "",
    customScreenId,
    locale: metadata.locale ?? null,
    draft: metadata.draft ?? false,
    platform,
    appVersion: client.identityParams().appVersion ?? null,
    sdkVersion: SDK_VERSION,
    projectId: client.projectId,
    functionsBaseUrl: client.functionsBaseUrl,
    viewRef,
    isActive,
  };
}
