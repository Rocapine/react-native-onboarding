---
name: setup-ui-sdk
description: Installs and wires the `@rocapine/react-native-onboarding-ui` UI SDK on top of the headless SDK. Use when the user wants prebuilt onboarding screens, asks "add the UI SDK", "render the onboarding step", or "use OnboardingPage".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Setup UI SDK

Install `@rocapine/react-native-onboarding-ui` and render steps with `OnboardingPage`.

## When invoked

1. Confirm headless SDK is already set up. If not, run `setup-headless-sdk` skill first.
2. Install:
   ```bash
   npm install @rocapine/react-native-onboarding-ui
   ```
3. Detect which step types the user's flow needs (read step JSON or ask). Install optional peer deps accordingly:
   - `Picker` step → `npm install @react-native-picker/picker`
   - Skia visuals → `npm install @shopify/react-native-skia`
   - `Ratings` step → `npm install expo-store-review`
   - Lottie elements → `npm install lottie-react-native`
   - Rive elements → `npm install rive-react-native`
   - Video elements → `npm install expo-video`
   - Linear gradients → `npm install expo-linear-gradient`
4. Wire `OnboardingPage` inside the screen that consumes `useOnboardingQuestions`:

```tsx
import { OnboardingPage } from "@rocapine/react-native-onboarding-ui";
import { useOnboardingQuestions } from "@rocapine/react-native-onboarding";
import { useRouter } from "expo-router";

export default function OnboardingScreen() {
  const router = useRouter();
  const { step, isLastStep } = useOnboardingQuestions();

  return (
    <OnboardingPage
      step={step}
      isLastStep={isLastStep}
      onContinue={(payload) => {
        // payload carries user answers / picker values
        if (isLastStep) router.replace("/(app)");
        else router.push(`/onboarding/${payload.nextStepId}`);
      }}
    />
  );
}
```

5. Apply theme via `OnboardingProvider` (headless package re-exports `ThemeProvider`):

```tsx
import { lightTokens, darkTokens } from "@rocapine/react-native-onboarding-ui";

<OnboardingProvider
  /* ...config */
  lightTheme={{ ...lightTokens, colors: { ...lightTokens.colors, primary: "#FF6B35" } }}
  darkTheme={darkTokens}
  initialColorScheme="light"
/>
```

6. Load custom fonts (if used) via `expo-font` BEFORE rendering — the theme references font family names only.
7. For custom components (custom answer button, etc.), use the `customize-onboarding-components` skill.
8. For deep theme work, use the `customize-onboarding-theme` skill.

## Back navigation

`OnboardingProvider` auto-injects progress bar; back button appears when `router.canGoBack()`. Control with `router.push` vs `router.replace` in `onContinue`.

## Verification

After setup, render at least one step in dev and check:
- Progress bar visible when `step.displayProgressHeader === true`
- Continue button advances
- Back button works
- Theme tokens applied

Then run `sdk-integration-verifier` agent.
