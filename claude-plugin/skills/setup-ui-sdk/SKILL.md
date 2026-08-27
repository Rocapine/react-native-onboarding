---
name: setup-ui-sdk
description: Installs and wires the `@rocapine/react-native-onboarding-ui` UI SDK on top of the headless SDK — mounts `OnboardingProgressProvider`, renders steps with `OnboardingPage`, and adds the `ProgressBar`. Use when the user wants prebuilt onboarding screens, asks "add the UI SDK", "render the onboarding step", "use OnboardingPage", or hits a missing-peer-dep or blank-screen error rendering a step.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Setup UI SDK

Install `@rocapine/react-native-onboarding-ui`, mount `OnboardingProgressProvider`, and render steps with `OnboardingPage`.

## When invoked

1. **Inspect target app first** — run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Identify the existing design system (Tamagui, NativeWind, custom tokens). The onboarding theme overlays those tokens rather than replacing them.
2. **Run `check-sdk-version`** if the UI SDK is already installed — propose an upgrade if mismatched. Refusal is fine.
3. Confirm the headless SDK is set up. If not, run `setup-headless-sdk` first — the UI SDK is useless without a mounted `OnboardingProvider`.

## Install

```bash
npx expo install @rocapine/react-native-onboarding-ui
```

Always `npx expo install`, never `npm install` — Expo resolves versions compatible with the app's React Native. On a `401`, run `rocapine doctor --fix`.

### Required peers

```bash
npx expo install react-native-safe-area-context react-native-reanimated-carousel \
  react-native-reanimated @tanstack/react-query
```

npm 7+ auto-installs non-optional peers, so an app may work without declaring these — install them explicitly anyway so Expo pins RN-compatible versions rather than whatever npm resolved.

- `react-native-safe-area-context` — `OnboardingProgressProvider` mounts `SafeAreaProvider` internally.
- `react-native-reanimated-carousel` — a **hard static import** in the ComposableScreen `Carousel` element, so the UI SDK cannot bundle without it, even for flows with no carousel.
- `react-native-reanimated` — ships as a dependency, but declare it so Expo version-matches it. In Expo apps `babel-preset-expo` wires the worklets plugin; bare RN apps must add `react-native-reanimated/plugin` **last** in `babel.config.js`.
- `@tanstack/react-query` — a required peer of the UI package. (The headless SDK bundles its own copy and mounts the `QueryClientProvider`; you still don't add a provider yourself.)

`lucide-react-native`, `react-native-gesture-handler` and `react-native-svg` are dependencies — they come along.

### Optional peers, per element used

Probe the step JSON if present; otherwise install what the flow needs.

| Optional peer | Needed by |
|---|---|
| `lottie-react-native` | `Lottie` |
| `rive-react-native` | `Rive` |
| `expo-video` | `Video` |
| `expo-image` | WebP/AVIF `Image` decode + preload |
| `@shopify/react-native-skia` | `DrawingPad` (mandatory for that element) |
| `expo-linear-gradient` | linear `backgroundGradient`, `ProgressiveBlurImage` |
| `@react-native-masked-view/masked-view` | `ProgressiveBlurImage` |
| `@react-native-community/datetimepicker` | `DatePicker` |
| `@react-native-community/slider` | `Slider` |
| `@react-native-picker/picker` | `WheelPicker` |
| `expo-haptics` | `haptic` on `Button` / `RadioGroup` / `CheckboxGroup` |
| `expo-store-review` | store-review prompts |
| `expo-router` | default navigation adapter (see **Back navigation**) |

Most degrade gracefully when absent (empty box, sharp image, no-op haptic); `DrawingPad` does not. After adding a **native** module, rebuild the dev client — reloading Metro is not enough.

## Mount the provider

`OnboardingProgressProvider` is **required** for ComposableScreen — the renderer and several elements read its context for variable state. It also mounts `SafeAreaProvider` and a `ThemeProvider` internally.

```tsx
import { OnboardingProvider } from "@rocapine/react-native-onboarding";
import { OnboardingProgressProvider } from "@rocapine/react-native-onboarding-ui";

<OnboardingProvider locale="en" onComplete={…}>
  <OnboardingProgressProvider initialColorScheme="light">
    <Stack />
  </OnboardingProgressProvider>
</OnboardingProvider>
```

It takes only `children` and `initialColorScheme`.

### Audience targeting needs user properties

Requires **1.74.0 or later**. If the project has more than one audience, which onboarding renders is decided by the audience waterfall against a `key: value` property map — nothing on this provider. Set it from anywhere (`OnboardingStudio` is a module-level object, so a login handler works):

```tsx
import { OnboardingStudio } from "@rocapine/react-native-onboarding";

OnboardingStudio.setUserProperty("plan", "free");
```

`setUserProperties` merges; a `null` value deletes; `reset()` forgets the user on logout. Properties persist and are hydrated before the first fetch, so `OnboardingProvider` holds its query for one AsyncStorage read — pass `fontsFallback` and that frame is covered. Full detail, including the reserved key names, is in `setup-headless-sdk`.

### Applying a custom theme

Because `OnboardingProgressProvider` renders its **own** `ThemeProvider` with no custom-theme pass-through, a `ThemeProvider` wrapped *around* it is shadowed and your brand tokens are silently ignored. Nest yours **inside** it — the inner provider wins:

```tsx
<OnboardingProgressProvider>
  <ThemeProvider customLightTheme={{ colors: { primary: "#FF6B35" } }}>
    <Stack />
  </ThemeProvider>
</OnboardingProgressProvider>
```

Full token surface and font wiring: `customize-onboarding-theme`.

## Render a step

```tsx
import { OnboardingPage } from "@rocapine/react-native-onboarding-ui";
import {
  useOnboardingStep,
  useOnboardingHeaderHeight,
  resolveNextStepNumber,
} from "@rocapine/react-native-onboarding";

export default function StepPage() {
  const { step, steps, completeOnboarding } = useOnboardingStep({ stepNumber });
  const { headerHeight } = useOnboardingHeaderHeight();
  const router = useRouter();

  const onContinue = (value?: any) => {
    const next = resolveNextStepNumber(step, getVariables(), steps);
    if (next === null) completeOnboarding();
    else router.push(`/onboarding/${next}`);
  };

  return (
    <OnboardingPage
      step={step}
      onContinue={onContinue}
      keyboardVerticalOffset={headerHeight}
    />
  );
}
```

`OnboardingPage` props: `step` (required), `onContinue: (args?: any) => void` (required), `isSandbox?`, `theme?`, `keyboardVerticalOffset?`, `customComponents?`. There is **no `isLastStep` prop**, and `onContinue` receives the answer value — not a payload with a `nextStepId`. Compute the next step with `resolveNextStepNumber` and treat `null` as the end.

Pass `keyboardVerticalOffset={headerHeight}` so ComposableScreen keyboard avoidance clears the progress bar instead of guessing its height.

## Render the progress bar

It is **not** auto-injected. Render it yourself — usually in the onboarding layout so it persists across step routes:

```tsx
import { ProgressBar, useTheme } from "@rocapine/react-native-onboarding-ui";
import { useOnboarding } from "@rocapine/react-native-onboarding";

const { isProgressBarVisible, progressPercentage } = useOnboarding();
const { theme } = useTheme();

<ProgressBar
  isProgressBarVisible={isProgressBarVisible}
  progressPercentage={progressPercentage}
  theme={theme}
/>
<Stack screenOptions={{ headerShown: false }} />
```

`ProgressBar` publishes its measured height via `onLayout`, which is what `useOnboardingHeaderHeight()` reads. Its back button is driven by the navigation adapter.

## Back navigation

The back button uses an **injectable navigation adapter** — the SDK does not hard-depend on `expo-router`.

- **expo-router apps (default):** nothing to do. It's an optional peer; when installed the default adapter binds automatically and the button appears when `router.canGoBack()`. Control with `router.push` vs `router.replace` in `onContinue`.
- **Other navigation libs:** install nothing extra and inject an adapter:

  ```tsx
  import type { OnboardingNavigationAdapter } from "@rocapine/react-native-onboarding";

  const navigation: OnboardingNavigationAdapter = {
    useFocusEffect: (effect) => useFocusEffect(useCallback(effect, [effect])),
    useRouter: () => {
      const nav = useNavigation();
      return { canGoBack: () => nav.canGoBack(), goBack: () => nav.goBack() };
    },
  };

  <OnboardingProvider navigation={navigation} />
  ```

  Define it at module scope — it must be a stable reference. With neither expo-router nor an adapter, navigation no-ops and the back button stays hidden.

## Custom components and deeper theming

- Element-level look → `customize-onboarding-components` (props are the canonical path).
- Theme tokens, fonts, dark mode → `customize-onboarding-theme`.
- `OnboardingPage.customComponents` overrides only `QuestionAnswerButton` and `QuestionAnswersList` — legacy `Question` step slots, not ComposableScreen.

## Verification

Render at least one step in dev and check:

- Progress bar appears when `step.displayProgressHeader === true`
- Continue advances, and the terminal branch fires `onComplete`
- Back button works
- Theme tokens applied (if not, check the `ThemeProvider` nesting above)

Then run the `sdk-integration-verifier` agent.

## Don'ts

- Don't wrap your `ThemeProvider` *outside* `OnboardingProgressProvider` — it gets shadowed by the one inside.
- Don't pass `isLastStep` to `OnboardingPage`; it isn't a prop. Use `resolveNextStepNumber(...) === null`.
- Don't expect `onContinue` to receive a `nextStepId` — it receives the answer value.
- Don't add a `QueryClientProvider`; the headless provider mounts one.
- Don't skip `react-native-reanimated-carousel` — it's a hard import, so the bundle fails without it even with no carousel in the flow.
- Don't render your own progress bar *and* expect one from the provider — there is only yours.
- Don't reload Metro after adding a native peer; rebuild the dev client.
