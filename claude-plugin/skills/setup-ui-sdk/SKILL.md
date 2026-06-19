---
name: setup-ui-sdk
description: Installs and wires the `@rocapine/react-native-onboarding-ui` UI SDK on top of the headless SDK. Use when the user wants prebuilt onboarding screens, asks "add the UI SDK", "render the onboarding step", or "use OnboardingPage".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Setup UI SDK

Install `@rocapine/react-native-onboarding-ui` and render steps with `OnboardingPage`.

## When invoked

1. **Inspect target app first** — run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Identify the existing design system (Tamagui, NativeWind, custom tokens, Storybook). The UI SDK theme will overlay these tokens, not replace them.
2. **Run `check-sdk-version` skill** if UI SDK already installed — propose upgrade if mismatched. User refusal allowed.
3. Confirm headless SDK is already set up. If not, run `setup-headless-sdk` skill first.
4. Install at the plugin's version so headless + UI + plugin all align:
   ```bash
   PLUGIN_VERSION=$(node -p "require('<plugin-path>/.claude-plugin/plugin.json').version")
   npm install @rocapine/react-native-onboarding-ui@$PLUGIN_VERSION
   ```
4. This plugin authors ComposableScreen exclusively. Install peer deps based on the UIElements the flow uses (probe step JSON if present, else install the common set):
   - Lottie elements → `npm install lottie-react-native`
   - Rive elements → `npm install rive-react-native`
   - Video elements → `npm install expo-video`
   - Skia visuals → `npm install @shopify/react-native-skia`
   - Linear gradients → `npm install expo-linear-gradient`
   - DatePicker → `npm install @react-native-community/datetimepicker`
   - WheelPicker → `npm install @react-native-picker/picker`
   - Inputs (always recommended) → already included in RN core
   - Navigation back button → `expo-router` (optional peer; used automatically if installed). Non-expo-router apps inject an adapter instead — see **Back navigation** below.
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

5. Apply theme via `OnboardingProvider` — **map from the app's existing design system**, not from scratch:
   - If app uses Tamagui: pull `themes.light.primary`, fonts etc. into `lightTheme`.
   - If app uses NativeWind / Tailwind: read `tailwind.config.*` colors / fonts.
   - If app has a `tokens.ts` or `theme.ts`: import those tokens directly.
   - If nothing exists: use `lightTokens`/`darkTokens` defaults and flag the gap.

   Example:

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

`OnboardingProvider` auto-injects the progress bar. Its back button is driven by an **injectable navigation adapter** — the SDK no longer hard-depends on `expo-router`.

- **expo-router apps (default):** nothing to do. `expo-router` is an optional peer dep; when present the default adapter binds to it automatically — the back button appears when `router.canGoBack()`. Control with `router.push` vs `router.replace` in `onContinue`.
- **Other navigation libs (react-navigation, custom):** install nothing extra and inject an adapter into `OnboardingProvider`:

  ```tsx
  import type { OnboardingNavigationAdapter } from "@rocapine/react-native-onboarding";
  import { useNavigation } from "@react-navigation/native";

  const navigation: OnboardingNavigationAdapter = {
    useFocusEffect: (effect) => useFocusEffect(useCallback(effect, [effect])), // @react-navigation/native
    useRouter: () => {
      const nav = useNavigation();
      return { canGoBack: () => nav.canGoBack(), goBack: () => nav.goBack() };
    },
  };

  <OnboardingProvider /* ...config */ navigation={navigation} />
  ```

  The adapter must be a stable reference (define it at module scope). If neither expo-router nor an adapter is provided, navigation no-ops and the back button stays hidden.

## Verification

After setup, render at least one step in dev and check:
- Progress bar visible when `step.displayProgressHeader === true`
- Continue button advances
- Back button works
- Theme tokens applied

Then run `sdk-integration-verifier` agent.
