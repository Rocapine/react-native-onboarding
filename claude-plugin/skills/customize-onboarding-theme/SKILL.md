---
name: customize-onboarding-theme
description: Brands the Rocapine onboarding by overriding UI SDK theme tokens (colors, typography, text styles, default font family) via `ThemeProvider`, and wires the typeface — either the Studio-served remote font manifest or locally bundled `expo-font` files. Use when the user wants to brand the onboarding, change colors, change or load fonts, set up dark mode, or asks "customize the onboarding theme", "make it match our design system", "why is my font not applying".
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Customize Onboarding Theme

Theme lives in the **UI SDK**, applied by `ThemeProvider`. You pass a **partial** theme; the provider deep-merges it over the built-in tokens.

## Always inspect target app first

Run probe from `../onboarding-best-practices/references/inspect-target-app.md`. Pull:

- Brand color, surface colors, text colors from the existing design system
- Font families and how they're loaded (`expo-font` / `useFonts`), or whether fonts should come from Studio instead
- Existing token file location (`tokens.ts`, `theme.ts`, `tamagui.config.ts`, `tailwind.config.*`)

Map directly — don't translate by eye. Import the app's real tokens:

```tsx
import { brand } from "@/design-system/tokens";

const customLightTheme = {
  colors: { primary: brand.primary },
};
```

## Two providers, one job each

This is the most common wiring mistake. They are different components from different packages:

| Provider | Package | Owns |
|---|---|---|
| `OnboardingProvider` | `@rocapine/react-native-onboarding` | data, remote fonts, custom actions, navigation, completion |
| `ThemeProvider` | `@rocapine/react-native-onboarding-ui` | colors, typography, light/dark |

**`OnboardingProvider` has no theme props.** Its props are `client`, `locale`, `customAudienceParams`, `customActions`, `fontsFallback`, `navigation`, `onComplete`. Passing `lightTheme` / `darkTheme` / `theme` / `initialColorScheme` to it does nothing.

```tsx
import { OnboardingProvider, OnboardingStudioClient } from "@rocapine/react-native-onboarding";
import { ThemeProvider, OnboardingProgressProvider } from "@rocapine/react-native-onboarding-ui";

<OnboardingProvider client={client} locale="en" fontsFallback={<Splash />}>
  <OnboardingProgressProvider initialColorScheme="light">
    <ThemeProvider
      customLightTheme={customLightTheme}
      customDarkTheme={customDarkTheme}
    >
      <Stack />
    </ThemeProvider>
  </OnboardingProgressProvider>
</OnboardingProvider>
```

**The nesting order matters and is counter-intuitive.** `OnboardingProgressProvider` mounts a `ThemeProvider` of its own — seeded only from its `initialColorScheme`, with no custom-theme pass-through. So a `ThemeProvider` wrapped *around* it is **shadowed**: your brand tokens are silently discarded and every element reads the built-in defaults. Put yours **inside**, where it wins. (`initialColorScheme` still belongs on the outer `OnboardingProgressProvider`, since that's the one you're overriding.)

`ThemeProvider` must be an ancestor of the rendered onboarding pages — every element reads `useTheme()`. It's optional in principle: with none mounted, `useTheme()` silently returns the built-in light tokens. So "my brand theme isn't applying" is almost always one of two things — no `ThemeProvider` at all, or one placed outside `OnboardingProgressProvider`.

## Pass partials — the provider merges

`customTheme`, `customLightTheme` and `customDarkTheme` are all `DeepPartial<Theme>`, deep-merged over the defaults by `mergeThemeTokens`. **Do not spread `lightTokens` first** — it's unnecessary, and `lightTokens` is `{ colors }` only (it has no `typography` key), so spreading it looks complete while covering half the theme.

```tsx
// Right — override only what changes.
customLightTheme={{ colors: { primary: "#FF6B35", text: { primary: "#0B0F19" } } }}

// Wrong — verbose, and `...lightTokens` contributes no typography.
customLightTheme={{ ...lightTokens, colors: { ...lightTokens.colors, primary: "#FF6B35" } }}
```

Precedence: `customLightTheme`/`customDarkTheme` merge over the defaults per scheme, then `customTheme` merges on top of both. Use `customTheme` for scheme-independent values (typography), the per-scheme props for colors.

## Token surface

Exactly this, from `onboarding-ui/src/UI/Theme/types.ts`:

```
colors                                    ColorTokens
  primary                                 brand accent — default light #264653, dark #c8ff2f
  disable
  neutral.{ highest, higher, high, medium, low, lower, lowest, lowestest }
  text.{ primary, secondary, tertiary, opposite, disable }

typography                                TypographyTokens
  fontWeight.{ regular:"400", medium:"500", semibold:"600", bold:"700", extrabold:"800" }
  lineHeight.{ tight:1.25, normal:1.3, relaxed:1.4 }        // multipliers, not px
  textStyles.{ heading1, heading2, heading3, body, bodyMedium, label, caption, button }
      each: { fontSize, fontWeight, lineHeight, fontFamily }
  defaultFontFamily?                      // inherit target for ComposableScreen elements
```

**There is no `colors.secondary`, no `colors.tertiary`, no `colors.surface`, no `typography.fontFamily`, and no `typography.fontSize`.** Surfaces come from `neutral.*` (`lowestest` is the extreme — white in light, black in dark). Per-role font sizes live inside `textStyles`, not a separate scale. Writing any of those keys type-errors against `ColorTokens` or is silently ignored.

`textStyles` defaults: heading1 32/600, heading2 24/600, heading3 18/500, body 16/400, bodyMedium 16/500, label 14/500, caption 12/400, button 16/500 — all `fontFamily: "Inter"`, `lineHeight` 1.25–1.5.

## Fonts

The theme only ever stores font **names**. Getting the file registered under that name is a separate step, and there are two paths.

### Remote — served by Studio (default; no app release to change a typeface)

Upload the variant in Studio (or via the `upload_font` MCP tool). Studio mirrors it into `configuration.fonts` and `get-onboarding-steps` serves it as `onboarding.fonts`, a `FontsManifest` of `family → [{ weight, style, url }]`. `OnboardingProvider`'s `FontLoaderGate` downloads and registers every variant with `Font.loadAsync({ [name]: { uri } })` before rendering children.

- Set `fontsFallback` on `OnboardingProvider` — it renders during fetch + font download. Without it the gate renders `null` and the user sees a blank frame.
- Then just name the family in the theme; no `require`, no bundling.

### Local — bundled with `expo-font`

For offline-first apps, or when the face must ship in the binary. Load before the provider renders:

```tsx
const [fontsLoaded] = useFonts({ "Geist-Bold": require("./assets/fonts/Geist-Bold.ttf") });
if (!fontsLoaded) return null;
```

### Pointing the theme at the family

One knob sets the typeface for the whole onboarding:

```tsx
customTheme={{ typography: { defaultFontFamily: "Geist-Regular" } }}
```

A ComposableScreen element that omits `fontFamily`, sets it to `"inherit"`, or leaves it empty (`""` / `null`) resolves to `defaultFontFamily`. Override per role via `textStyles`:

```tsx
customTheme={{
  typography: {
    defaultFontFamily: "Geist-Regular",
    textStyles: {
      heading1: { fontFamily: "Geist-Bold" },   // deep-merged; fontSize/weight/lineHeight kept
      button:   { fontFamily: "Geist-Medium" },
    },
  },
}}
```

### Weight resolution

`resolveFontFamily` snaps a requested weight to the **nearest available** numeric weight in the registry, and falls back across style (upright ↔ italic) within a weight. A manifest carrying only 400 and 700 will serve 700 for a `600` request rather than failing — so ship the weights you actually reference.

### iOS system-font collision

Families whose name normalizes to a platform system font — `system`, `sfpro`, `sfprodisplay`, `sfprotext`, `sfprorounded`, `sfuidisplay`, `sfuitext` (case, spaces, `_`, `.`, `-` ignored) — are deliberately **not registered on iOS**; resolution returns `undefined` so RN uses the real system font and honors `fontWeight`. Registering custom faces under one of those names makes iOS give the system font precedence: only Regular resolves and every other weight renders tofu. Name your family something else.

## In your own custom components

```tsx
import { useTheme, getTextStyle } from "@rocapine/react-native-onboarding-ui";

function MyButton() {
  const { theme } = useTheme();
  return (
    <Text style={[getTextStyle(theme, "button"), { color: theme.colors.text.opposite }]}>Go</Text>
  );
}
```

Use `getTextStyle(theme, name)` rather than reading `theme.typography.textStyles[name]` raw — the stored `lineHeight` is a **multiplier**, and `getTextStyle` returns it resolved to pixels (`fontSize × lineHeight`). Passing the raw value to RN gives a 1.3px line height.

## Dark mode

`useTheme()` returns `{ theme, colorScheme, toggleTheme }`. `ThemeProvider` seeds `colorScheme` from `initialColorScheme` (default `"light"`) and changes it **only** via `toggleTheme()` — it does not subscribe to `Appearance`. To follow the OS, drive it from the host:

```tsx
const scheme = useColorScheme();               // react-native
<ThemeProvider initialColorScheme={scheme ?? "light"} key={scheme}>
```

The `key` forces a remount so the new `initialColorScheme` takes effect; without it the provider keeps its existing state.

## Anti-patterns

- Don't pass theme props to `OnboardingProvider` — it has none. Theme goes on `ThemeProvider` from the UI SDK.
- Don't wrap `ThemeProvider` *outside* `OnboardingProgressProvider` — the one it mounts internally shadows yours, and your tokens vanish without an error.
- Don't spread `lightTokens` / `darkTokens` into your override — pass a partial and let the provider deep-merge.
- Don't write `colors.secondary`, `colors.surface.*`, `colors.tertiary.*`, `typography.fontFamily` or `typography.fontSize`. They don't exist; use `neutral.*` and `textStyles`.
- Don't assume remote fonts are unavailable — Studio-served fonts are the default path, and they avoid an app release per typeface change. Bundle locally only when offline-first requires it.
- Don't omit `fontsFallback` when the onboarding uses remote fonts — the gate renders `null` during download.
- Don't read `textStyles[*].lineHeight` straight into a RN style — it's a multiplier. Use `getTextStyle`.
- Don't put hex colors directly in components — go through `theme.colors.*`.
- Don't name a custom family `system` / `SFPro` / similar — iOS drops every non-Regular weight.
