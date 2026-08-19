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
/**
 * Studio-authored styling for the onboarding progress header.
 *
 * Exists so "change the progress bar colour" is a Studio publish rather than an
 * app release. Before this, `ProgressBar` exposed only `backgroundColor` /
 * `progressColor` as props and hardcoded everything else (height 12, radius 10,
 * the 1/5/1 three-column layout, paddings, back-chevron size), so a project
 * needing a different bar forked its own component.
 *
 * Every field is optional; an omitted field falls back to the previous
 * behaviour. Resolution order in `ProgressBar` is:
 *   explicit prop  >  this block  >  theme  >  hardcoded default
 * This block deliberately outranks the theme because a theme-only knob could not
 * reach the screen at all today: `ThemeProvider` is fed solely by the host's
 * `customTheme`/`customLightTheme`/`customDarkTheme` props, and nothing in the SDK
 * reads `configuration.theme` — the edge function delivers the field and no
 * consumer exists, so the host theme is the only theme at runtime. Wiring
 * `configuration.theme` into `ThemeProvider` (config below host props, mirroring
 * the order here) is a known open item; until then this block is the only way
 * Studio can restyle the header.
 */
export interface ProgressHeaderConfiguration {
  /** Track (unfilled) colour. Defaults to `theme.colors.neutral.lower`. */
  backgroundColor?: string;
  /** Filled colour. Defaults to `theme.colors.primary`. */
  progressColor?: string;
  /** Track thickness in px. Defaults to 12. */
  height?: number;
  /** Track corner radius in px. Defaults to half the height (fully rounded). */
  borderRadius?: number;
  /** Horizontal padding around the whole header row in px. Defaults to 16. */
  paddingHorizontal?: number;
  /** Space below the bar in px. Defaults to 24. */
  paddingBottom?: number;
  /** Gap between the back button, track and right spacer in px. Defaults to 16. */
  gap?: number;
  /**
   * Width of the track relative to the side columns, as flex units. The header is
   * a three-column row (back button / track / spacer) that defaults to 1 / 5 / 1;
   * this sets the middle number. Larger = wider track.
   */
  trackFlex?: number;
  /** Back-chevron colour. Defaults to `theme.colors.text.primary`. */
  backButtonColor?: string;
  /** Back-chevron size in px. Defaults to 24. */
  backButtonSize?: number;
  /** Hide the back chevron even when the router can go back. Defaults to false. */
  hideBackButton?: boolean;
}

export interface OnboardingConfiguration {
  /**
   * Studio-authored progress-header styling. Read directly off `configuration`
   * (the edge function returns the whole configuration blob top-level), so it
   * needs no backend change to start arriving.
   */
  progressHeader?: ProgressHeaderConfiguration;
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
