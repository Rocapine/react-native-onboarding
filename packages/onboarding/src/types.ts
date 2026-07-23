import type { NextStep } from "./steps/common.types";

/**
 * Base step type that all onboarding steps must conform to.
 * This is the minimal interface required by the headless SDK.
 */
export type BaseStepType = {
  id: string;
  type: string;
  name: string;
  displayProgressHeader?: boolean;
  payload?: any;
  customPayload?: any;
  continueButtonLabel?: string;
  figmaUrl?: string | null;
  nextStep?: NextStep;
};

export type OnboardingStudioClientOptions<
  StepType extends BaseStepType = BaseStepType
> = {
  appVersion?: string;
  isSandbox?: boolean;
  baseUrl?: string;
  fallbackOnboarding?: Onboarding<StepType>;
  timeout?: number;
  /**
   * Optional custom cache key. When provided, the fetched onboarding is
   * persisted under `"rocapine-onboarding-sdk-{cacheKey}"` and served
   * **cache-first with no background revalidation** — the pinned version stays
   * put across launches until the host refetches (see
   * `OnboardingStudioClient.clearCache`). Omit for the default key
   * (`"rocapine-onboarding-studio"`) with stale-while-revalidate caching.
   * Ignored in sandbox mode (which always fetches fresh).
   */
  cacheKey?: string;
};

export type OnboardingOptions = {
  locale?: string;
};

export type UserDefinedParams = {
  [key: string]: string;
};

export interface OnboardingMetadata {
  id: string;
  name?: string;
  audienceId?: string;
  audienceName?: string;
  audienceOrder?: number;
  locale?: string;
  draft?: boolean;
}

/**
 * Studio-authored, project-level configuration returned alongside the steps
 * (e.g. theme, fonts, entry point). Kept permissive — only the fields the SDK
 * reads are typed; everything else the studio ships passes through untouched.
 */
export interface OnboardingConfiguration {
  /**
   * Id of the unique step the onboarding starts on. Read first to resolve the
   * entry point (see `resolveStartStepNumber`). Optional; when absent or when it
   * references a missing step, the flow falls back to the first step in `steps`
   * (legacy behavior).
   */
  startStepId?: string;
  [key: string]: any;
}

export type FontWeightKey =
  | "regular"
  | "medium"
  | "semibold"
  | "bold"
  | "extrabold"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900";

export type FontFamilyManifest = Partial<Record<FontWeightKey, string>>;

export interface FontVariantEntry {
  weight: FontWeightKey | number;
  style?: "normal" | "italic" | string;
  url: string;
}

export type FontFamilyManifestInput = FontFamilyManifest | FontVariantEntry[];

export type FontsManifest = Record<string, FontFamilyManifestInput>;

export interface Onboarding<StepType extends BaseStepType = BaseStepType> {
  metadata: OnboardingMetadata;
  steps: StepType[];
  configuration: OnboardingConfiguration;
  fonts?: FontsManifest;
}

export interface GetStepsResponseHeaders {
  "ONBS-Onboarding-Id": string | null;
  "ONBS-Audience-Id": string | null;
  "ONBS-Onboarding-Name": string | null;
}
