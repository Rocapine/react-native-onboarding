# Inspect Target App Before Building

Every authoring + integration skill in this plugin must run this probe before producing output. The goal: produce a structured **Design Profile** that downstream skills inject into every UIElement they emit.

Generic onboarding output is a regression. ComposableScreens should be indistinguishable from screens written by hand inside the host app.

## The Design Profile (target output of this probe)

```ts
type DesignProfile = {
  // Colors — all from existing design system, never invented
  brand: { primary: string; secondary?: string; accent?: string; danger?: string };
  surface: { app: string; card: string; raised: string; inverse: string };
  text: { primary: string; secondary: string; tertiary: string; onBrand: string; muted: string };
  border: { default: string; subtle: string; strong: string };

  // Typography — names + scale
  fonts: {
    heading: string;   // family name loaded via expo-font / useFonts
    body: string;
    mono?: string;
    loadedNames: string[];  // every family the app actually loads
  };
  typeScale: {
    display: number; h1: number; h2: number; h3: number;
    body: number; bodySm: number; caption: number;
  };
  fontWeights: {
    regular: string; medium: string; semibold: string; bold: string;
  };
  lineHeightMultiplier: number; // usually 1.2–1.5

  // Spacing + shape — pulled from existing Button + Card components
  radius: { sm: number; md: number; lg: number; xl?: number; pill: number };  // xl ≈ featured/testimonial cards (e.g. 24)
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  gutter?: number;                  // screen-edge horizontal padding (usually spacing.lg, e.g. 24)

  // Optional accents + effects — fall back to nearest existing token when absent
  accent?: { gold?: string; pastels?: string[] };  // gold = star ratings; pastels = decorative chip backgrounds
  shadow?: { card?: { color: string; offset: { width: number; height: number }; opacity: number; radius: number; elevation: number } };
  buttonHeight: number;          // standard primary button height
  buttonPaddingH: number;        // standard primary button horizontal padding
  buttonBorderRadius: number;    // standard primary button corner radius
  inputHeight: number;
  inputBorderRadius: number;

  // Brand voice
  voice: {
    case: "sentence" | "title";
    person: "you" | "we" | "mixed";
    ctaVerbs: string[];          // ["Continue", "Get started", ...]
    usesEmoji: boolean;
  };

  // Media + motion
  motion: {
    reanimated: boolean;
    moti: boolean;
    lottie: boolean;
    rive: boolean;
  };
  iconLib: "lucide" | "material" | "feather" | "phosphor" | "custom" | "none";

  // App architecture
  entry: "expo-router" | "react-navigation" | "other";
  themeProvider: "tamagui" | "nativewind" | "restyle" | "custom" | "none";
  i18n: boolean;
  varNamingStyle: "camelCase" | "snake_case" | "kebab-case";

  // Existing assets to reuse
  existingButtonComponent?: { path: string; importName: string };
  existingCardComponent?: { path: string; importName: string };
  designSystemRoot?: string;     // e.g. "src/design-system"
  tokenFiles: string[];          // paths to discovered token files
};
```

## Extraction protocol

For each field, run the listed checks. Capture file:line citations so the user can audit.

### Brand colors

1. `grep -r "primary\s*[:=]\s*['\"#]"` in `src/**`, `app/**`, `theme*`, `tokens*`, `colors*`
2. Check `tailwind.config.*` → `theme.colors`
3. Check `tamagui.config.ts` → `themes.light.primary`
4. Check `app.json` / `app.config.*` → `expo.primaryColor`, `splash.backgroundColor`
5. Fall back: read 3 prominent screens and pull the most-used hex
6. If `react-native-paper` / `restyle`: read its theme

### Typography

1. `grep -rn "useFonts\|Font.loadAsync\|fontFamily"` in entry files
2. `grep -rn "fontSize:"` to derive scale from common values
3. Read existing `<Text>` / typography component for weight conventions
4. Check `src/theme/typography.ts`, `tokens/typography.ts`

### Spacing + radius

1. Find the primary button component (`Button.tsx`, `PrimaryButton.tsx`, `CTAButton.tsx`):
   - Read its `borderRadius`, `paddingHorizontal`, `height`, `backgroundColor` props/styles
   - Read child `<Text>` styles for label typography
2. Same for input component (`Input.tsx`, `TextField.tsx`)
3. Same for card/list-item component
4. If Tamagui: read `tokens.size` + `tokens.radius`
5. If Tailwind: parse `theme.borderRadius`, `theme.spacing`

### Voice

1. Read 3 existing screens of copy (titles, button labels, descriptions)
2. Check `package.json.description` and App Store description if present
3. Note case style, person, verb patterns
4. Sample: `grep -rn "title=\|label=" app/onboarding/` if any existing onboarding present

### Architecture detection

| Indicator | Detect |
|-----------|--------|
| `app/_layout.tsx` exists | `expo-router` |
| `@react-navigation/native` in deps | `react-navigation` |
| `tamagui` in deps | `themeProvider: "tamagui"` |
| `nativewind` or `tailwind.config.*` | `themeProvider: "nativewind"` |
| `@shopify/restyle` | `themeProvider: "restyle"` |
| `expo-localization` / `i18n-js` / `react-i18next` in deps | `i18n: true` |

### Variable naming style

Read existing state/variable names (`useState`, function params, prop interfaces) to derive convention.

## Output the Design Profile

After the probe, surface a compact block at the top of every authoring output:

```
## Design profile
- Brand: #27ae60 (primary), #1e8449 (secondary)  ← src/design-system/tokens.ts:5-9
- Fonts: Geist-Bold (heading), Geist-Regular (body)  ← app/_layout.tsx:12-16
- Type scale: h1=28, h2=22, body=16, caption=13
- Radius: 12 (buttons), 16 (cards)  ← src/components/Button.tsx:14
- Spacing: 4/8/16/24/32
- Button: 56px tall, 24h padding, primary bg #27ae60, white text  ← src/components/Button.tsx:8-20
- Input: 48px tall, 12 radius, 1px border #E5E5E5  ← src/components/Input.tsx
- Voice: sentence case, "you"-form, CTAs: "Continue", "Get started"
- Motion: Reanimated ✓, Lottie ✓
- Icon lib: lucide
- Architecture: expo-router, tamagui, i18n enabled
```

## How downstream skills use it

For every UIElement they emit:

- `Button.props.backgroundColor` ← `brand.primary`
- `Button.props.color` ← `text.onBrand`
- `Button.props.fontFamily` ← `fonts.heading` (or `body` if buttons use body font)
- `Button.props.fontSize` ← match standard from probe
- `Button.props.fontWeight` ← `fontWeights.semibold`
- `Button.props.borderRadius` ← `buttonBorderRadius`
- `Button.props.height` ← `buttonHeight` (or use `paddingVertical` derived)
- `Text` `fontFamily` / `fontSize` / `color` from profile
- `Input.borderRadius` ← `inputBorderRadius`
- `YStack`/`XStack` `gap` + `padding` snap to `spacing` ladder (4/8/16/24/32 etc.)
- `Image` / `Card` containers use `radius.md` or `radius.lg`
- CTA label verb from `voice.ctaVerbs`

## Anti-patterns

- Don't use generic Tailwind defaults (`#3b82f6` blue, `#22c55e` green) when app uses different brand.
- Don't pick a font family that isn't in `fonts.loadedNames`.
- Don't snap to "design-system-y" radius like 8 if the app's button uses 16.
- Don't case-shift copy ("Continue" → "CONTINUE") to look bolder.
- Don't add emoji when `voice.usesEmoji === false`.

## When probe is impossible

If working in isolation (no target app):

```
⚠ No target app inspected — Design Profile is the SDK defaults. Re-run inside the consuming app to align with brand tokens, typography, and component conventions.
```

Don't silently use generic values.
