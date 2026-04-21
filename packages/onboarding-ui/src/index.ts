// Re-export from headless package for convenience
export type {
  BaseStepType,
  Onboarding,
  OnboardingMetadata,
  OnboardingStudioClientOptions,
} from "@rocapine/react-native-onboarding";

// UI Components and Router
export { OnboardingPage } from "./UI/OnboardingPage";

// All page types and renderers
export * from "./UI/Pages";

// Templates and shared components
export * from "./UI/Templates";
export * from "./UI/Components";

// Theme system
export * from "./UI/Theme";

// Error boundary
export * from "./UI/ErrorBoundary";

// Provider
export { OnboardingProgressProvider, OnboardingProgressContext } from "./UI/Provider/OnboardingProgressProvider";

// UI-specific types
export * from "./UI/types";
