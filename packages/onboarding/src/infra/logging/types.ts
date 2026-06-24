import { OnboardingMetadata } from "../../types";

/**
 * Identity shared by every onboarding event. Sourced from the `ONBS-*` response
 * headers exposed on {@link OnboardingMetadata}, so analytics emitted by a logger
 * implementation can be correlated back to the originating onboarding/audience in
 * Onboarding Studio.
 */
export interface OnboardingEventIdentity {
  onboardingId: string;
  onboardingName?: string;
  audienceId?: string;
  audienceName?: string;
  locale?: string;
  draft?: boolean;
}

/** Fields present on every {@link OnboardingEvent}. */
export interface OnboardingEventBase extends OnboardingEventIdentity {
  /** Epoch milliseconds at which the event was created. */
  timestamp: number;
}

/** Minimal step descriptor carried by step-scoped events. */
export interface OnboardingEventStep {
  id: string;
  type: string;
  name: string;
  /** 1-based position of the step in the flow. */
  number: number;
}

/** Fired once when the onboarding payload first becomes available. */
export interface OnboardingStartedEvent extends OnboardingEventBase {
  name: "onboarding_started";
  stepsLength: number;
}

/**
 * Fired every time a step is shown (including re-shows on back navigation).
 * `answers` is the live snapshot of collected variables at display time, so each
 * `step_shown` carries the answers accumulated by the previous steps.
 */
export interface StepShownEvent extends OnboardingEventBase {
  name: "step_shown";
  step: OnboardingEventStep;
  totalSteps: number;
  isLastStep: boolean;
  displayProgressHeader: boolean;
  /** Snapshot of collected answers (provider variables) at display time. */
  answers: Record<string, any>;
  /** The step's `customPayload`, if any. */
  customPayload?: any;
}

/**
 * Fired when the flow ends. Has no SDK-internal choke point (end-of-flow
 * navigation lives in host code), so the host fires it via {@link OnboardingLogger}
 * obtained from `useOnboardingLogger()`.
 */
export interface OnboardingCompletedEvent extends OnboardingEventBase {
  name: "onboarding_completed";
  totalSteps: number;
  /** Final snapshot of collected answers (provider variables). */
  answers: Record<string, any>;
}

/** Discriminated union of all onboarding events, keyed on `name`. */
export type OnboardingEvent =
  | OnboardingStartedEvent
  | StepShownEvent
  | OnboardingCompletedEvent;

/**
 * Logger contract injected into {@link OnboardingProvider} via the `logger` prop.
 * The SDK calls `track` at its internal choke points; provide an implementation
 * (e.g. an Amplitude adapter) to forward events to an analytics backend. Defaults
 * to a no-op so the SDK emits nothing until a host opts in.
 */
export interface OnboardingLogger {
  track(event: OnboardingEvent): void;
}

/** Build the shared identity base from onboarding metadata. */
export const metadataToIdentity = (
  metadata: OnboardingMetadata
): OnboardingEventIdentity => ({
  onboardingId: metadata.id,
  onboardingName: metadata.name,
  audienceId: metadata.audienceId,
  audienceName: metadata.audienceName,
  locale: metadata.locale,
  draft: metadata.draft,
});
