---
name: setup-headless-sdk
description: Installs and wires the `@rocapine/react-native-onboarding` headless SDK in an Expo or React Native app. Use when the user wants to add Rocapine onboarding data layer to their app, asks "set up the onboarding SDK", "install rocapine headless", or "connect to onboarding studio".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: [project-id?]
---

# Setup Headless SDK

Install `@rocapine/react-native-onboarding` and wire `OnboardingProvider` + `useOnboardingQuestions`.

## When invoked

1. **Inspect target app first** — run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture entry point, existing theme system, font loading mechanism, env-var convention, error-boundary library in use. Tailor every step below to those findings.
2. **Run `check-sdk-version` skill** if SDK already installed — if mismatched, propose upgrade and wait for user decision before continuing. User refusal is fine; carry on with whatever's installed.
3. Verify target is an Expo/RN app: `package.json` contains `expo` or `react-native`.
4. Check if SDK already installed. If yes, jump to wiring step.
5. Install (pin to the plugin's version so authoring + runtime align):
   ```bash
   PLUGIN_VERSION=$(node -p "require('<plugin-path>/.claude-plugin/plugin.json').version")
   npm install @rocapine/react-native-onboarding@$PLUGIN_VERSION
   # peer deps already in most RN apps:
   npm install @tanstack/react-query @react-native-async-storage/async-storage
   ```
4. Ask for required config (or accept from skill args):
   - `projectId` — Rocapine Studio project ID
   - `platform` — `ios | android | web`
   - `appVersion` — usually from `expo-constants` or `app.json`
   - `locale` — default `en`
   - `draft` — `true` for staging preview, `false` for production
5. Add provider at app root (in `app/_layout.tsx` for Expo Router):

```tsx
import { OnboardingProvider } from "@rocapine/react-native-onboarding";
import Constants from "expo-constants";

export default function RootLayout() {
  return (
    <OnboardingProvider
      projectId={process.env.EXPO_PUBLIC_ROCAPINE_PROJECT_ID!}
      platform="ios"
      appVersion={Constants.expoConfig?.version ?? "1.0.0"}
      locale="en"
      draft={__DEV__}
    >
      <Stack />
    </OnboardingProvider>
  );
}
```

6. Wrap in an `ErrorBoundary` — `OnboardingDataGate` THROWS network/parse errors so the host can handle them. Never swallow.
7. Consume in a screen:

```tsx
import { useOnboardingQuestions } from "@rocapine/react-native-onboarding";

export default function OnboardingScreen() {
  const { step, isLastStep, stepsLength, onboardingMetadata } = useOnboardingQuestions();
  // render based on step.type
}
```

8. Add to `.env`:
   ```
   EXPO_PUBLIC_ROCAPINE_PROJECT_ID=...
   ```
9. Mention: progress bar is auto-injected by `OnboardingProvider` — do not add manually.
10. Mention: hook uses `useSuspenseQuery` — wrap screens in `<Suspense fallback={...}>`.

## Verification

After setup, suggest running the `sdk-integration-verifier` agent.

## Don'ts

- Don't catch errors inside `OnboardingDataGate` — they're meant to bubble.
- Don't add a manual progress bar.
- Don't hardcode `projectId` in source — use env (match app's env-var convention from probe).
- Don't call the API client directly unless you're building a custom data layer.
- Don't skip the app probe — placement of `OnboardingProvider` and theme wiring depend on app conventions.

## ComposableScreen note

This plugin authors ComposableScreen steps only. After headless setup, install UI SDK via `setup-ui-sdk` skill — it covers the optional peer deps ComposableScreen needs (`@shopify/react-native-skia`, `lottie-react-native`, `rive-react-native`, `expo-video`, `expo-linear-gradient`).
