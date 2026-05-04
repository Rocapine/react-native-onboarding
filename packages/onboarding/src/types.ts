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
  configuration: any;
  fonts?: FontsManifest;
}

export interface GetStepsResponseHeaders {
  "ONBS-Onboarding-Id": string | null;
  "ONBS-Audience-Id": string | null;
  "ONBS-Onboarding-Name": string | null;
}
