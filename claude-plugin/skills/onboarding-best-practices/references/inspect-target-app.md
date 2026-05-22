# Inspect Target App Before Building

Every authoring/integration skill in this plugin should run a 60-second target-app probe before producing output. Copy steps it cares about.

## Why

ComposableScreen authoring without app context produces generic results that drift from the host design system. The plugin must match: tokens, fonts, components, copy voice, motion language.

## Probe checklist

1. **App entry point** — find the OnboardingProvider mount:
   - `app/_layout.tsx` (Expo Router)
   - `App.tsx` / `src/App.tsx` (bare RN)
   - `index.ts`

2. **Theme tokens** — find lightTheme / darkTheme passed to OnboardingProvider. Read the brand color, surface colors, font families. Note any override pattern (object spread on `lightTokens` / `darkTokens`).

3. **Fonts** — grep `Font.loadAsync` or `useFonts` to enumerate loaded font families. Match these names in any `Text` element you author.

4. **Design system** — look for one of:
   - `src/design-system/`, `src/theme/`, `src/ui/`, `src/components/ui/`
   - `tamagui.config.ts`, `nativewind`, `tailwind.config.*`
   - Style tokens file (`tokens.ts`, `colors.ts`, `spacing.ts`)
   - Storybook (`*.stories.tsx`)
   
   Read the most representative button + text styles. Note: border radius, button height, padding, font weight conventions.

5. **Voice/tone** — read any existing onboarding screen, marketing copy, or App Store description. Note:
   - Sentence case vs Title Case
   - CTA verbs the brand uses ("Get started", "Let's go", "Begin")
   - Whether app uses emoji in UI
   - Person (you/your vs we/our)

6. **Component library** — check for custom button, input, card components. Mirror their visual language in `BaseBoxProps`:
   - `borderRadius` from the most-used button
   - `padding` from the standard button
   - `backgroundColor` token mapping

7. **Existing onboarding** — if any step JSON or `ComposableScreen` already exists in the repo (`*.json`, examples, fixtures), read 1–2 to learn:
   - Naming conventions for IDs
   - Variable naming style (`goal` vs `userGoal`)
   - Whether `name` mirrors `id` or is human-readable

8. **Motion** — check if `react-native-reanimated` is installed and used. If yes, the brand expects motion; lean into Carousel/animated transitions. If no, keep static.

9. **Locale strategy** — single-locale or multi? Look for `i18n`, `expo-localization`, locale files. If multi-locale, keep copy short for translation.

10. **Accessibility level** — grep `accessibilityLabel`. High coverage = ship accessibility-first; low = match team's existing baseline.

## How to use the probe output

Inject into the authoring output:

- Use brand color from theme, not generic `#FF6B35`.
- Use font families from probe, not arbitrary names.
- Match border radius and padding conventions in `BaseBoxProps`.
- Match copy voice ("Continue" vs "Let's go") in `continueButtonLabel`.
- Reuse variable naming style.

## When probe is impossible

If working without access to a target app (just designing JSON in isolation), say so explicitly in the output:

```
⚠ No target app inspected — using SDK defaults. Re-run inside the consuming app to align with brand tokens.
```

Don't silently invent brand colors.
