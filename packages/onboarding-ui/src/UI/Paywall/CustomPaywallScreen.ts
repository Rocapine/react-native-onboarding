/**
 * The custom-screen contract MOVED to the headless package.
 *
 * It had to: there are now two renderers reading the same registry —
 * `PaywallHost`'s Modal and the inline `Paywall` onboarding step
 * (`UI/Pages/Paywall/Renderer.tsx`) — and the registry they share is published
 * on `PaywallProvider`, which lives in the headless package. So the type does
 * too. See `packages/onboarding/src/paywalls/customScreens.ts` for the full
 * contract and the reasoning.
 *
 * This file stays as a re-export so the deep-import path 1.72.0 introduced
 * keeps resolving unchanged.
 */
export type {
  CustomPaywallScreenProps,
  CustomPaywallScreens,
} from "@rocapine/react-native-onboarding";
