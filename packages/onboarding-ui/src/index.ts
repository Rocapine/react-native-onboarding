// Re-export from headless package for convenience
export type {
  BaseStepType,
  Onboarding,
  OnboardingMetadata,
  OnboardingStudioClientOptions,
  CustomActionHandler,
  CustomActions,
  ButtonAction,
  CustomButtonAction,
  ComposableVariableEntry,
} from "@rocapine/react-native-onboarding";

// UI Components and Router
export { OnboardingPage } from "./UI/OnboardingPage";

// All page types and renderers
export * from "./UI/Pages";

// Screen rendering engine — shared by onboarding steps and paywalls.
// Named exports, not `export *`: the root already surfaces UIElement /
// UIElementSchema through `./UI/Pages` → ComposableScreen → types, which now
// re-exports Runtime/types. A second star export of the same module would be
// legal (both resolve to the same declaration, so it is not an ambiguous star
// export) but it makes the public surface accidental. List what is public.
export { ScreenRenderer, noopScreenHost } from "./UI/Runtime";
export type { ScreenRendererProps, ScreenHost } from "./UI/Runtime";

// Templates and shared components
export * from "./UI/Templates";
export * from "./UI/Components";

// Theme system
export * from "./UI/Theme";

// Error boundary
export * from "./UI/ErrorBoundary";

// Provider
export { OnboardingProgressProvider, OnboardingProgressContext } from "./UI/Provider/OnboardingProgressProvider";

// Hooks
export * from "./UI/hooks";

// UI-specific types
export * from "./UI/types";
