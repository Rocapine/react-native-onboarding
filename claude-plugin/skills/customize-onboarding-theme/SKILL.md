---
name: customize-onboarding-theme
description: Builds or extends Rocapine Onboarding UI theme tokens (colors, typography, light/dark). Use when the user wants to brand the onboarding, change colors, change fonts, set up dark mode, or asks "customize the onboarding theme", "make it match our design system".
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Customize Onboarding Theme

Extend the UI SDK theme by overlaying tokens on `lightTokens` / `darkTokens`. Never replace the whole object — deep-merge.

## Always inspect target app first

Run probe from `../onboarding-best-practices/references/inspect-target-app.md`. Pull:

- Brand color, surface colors, text colors from existing design system
- Font families loaded via `expo-font` / `useFonts`
- Border radius + spacing conventions (used implicitly by ComposableScreen `BaseBoxProps`)
- Existing token file location (`tokens.ts`, `theme.ts`, `tamagui.config.ts`, `tailwind.config.*`)

Map directly — don't translate by eye. Import existing tokens into the override:

```tsx
import { brand } from "@/design-system/tokens";

const brandLight = {
  ...lightTokens,
  colors: { ...lightTokens.colors, primary: brand.primary, secondary: brand.secondary },
};
```

## Token surface

```
colors
  primary, secondary, disable
  tertiary.{ tertiary1, tertiary2, tertiary3 }
  neutral.{ highest, higher, high, medium, low, lower, lowest }
  surface.{ lowest, low, medium, high, higher, highest, opposite }
  text.{ primary, secondary, tertiary, opposite, disable }

typography
  fontFamily.{ title, text, tagline }     // names only — load fonts separately
  fontSize.{ xs, sm, md, lg, xl, 2xl, 3xl, 4xl }
  fontWeight.{ regular, medium, semibold, bold, extrabold }
  lineHeight.{ tight, normal, relaxed }
  textStyles.{ heading1, heading2, heading3, body, bodyMedium, label, caption, button }
```

## Pattern: brand override

```tsx
import { lightTokens, darkTokens, typography } from "@rocapine/react-native-onboarding-ui";

const brandLight = {
  ...lightTokens,
  colors: {
    ...lightTokens.colors,
    primary: "#FF6B35",
    text: { ...lightTokens.colors.text, primary: "#0B0F19" },
  },
  typography: {
    ...typography,
    fontFamily: { title: "Geist-Bold", text: "Geist-Regular", tagline: "Geist-Medium" },
  },
};

<OnboardingProvider lightTheme={brandLight} darkTheme={darkTokens} initialColorScheme="light" />
```

## Loading fonts

Theme only stores font NAMES. Load the actual font files with `expo-font` BEFORE the provider renders:

```tsx
import * as Font from "expo-font";

await Font.loadAsync({
  "Geist-Bold": require("./assets/fonts/Geist-Bold.ttf"),
  "Geist-Regular": require("./assets/fonts/Geist-Regular.ttf"),
});
```

For the `defaultFontFamily` shortcut (applied globally to all Text):

```tsx
<OnboardingProvider
  theme={{ defaultFontFamily: "Geist-Regular" }}
/>
```

## In your own custom components

```tsx
import { useTheme, getTextStyle } from "@rocapine/react-native-onboarding-ui";

function MyButton() {
  const { theme } = useTheme();
  return <Text style={[getTextStyle(theme, "button"), { color: theme.colors.text.opposite }]}>Go</Text>;
}
```

## Dark mode

Pass `initialColorScheme` and provide `darkTheme`. Toggle by re-rendering provider with new scheme, or by responding to `Appearance.getColorScheme()`.

## Anti-patterns

- Don't pass a partial object as `lightTheme` — TypeScript may compile but runtime will crash on missing tokens. Always spread `lightTokens` first.
- Don't put hex colors directly in components — go through `theme.colors.*`.
- Don't ship font files via URL — bundle locally via `expo-font`.
- Don't read `Appearance` inside a component without subscribing to changes.
