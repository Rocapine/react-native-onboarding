---
name: customize-onboarding-components
description: Customizes how Rocapine ComposableScreen UIElements render in the host app — via element props (primary path) and host-wired `custom` button actions (advanced path). Use when the user wants a different look for buttons / radio cards / inputs, wants the onboarding to share components with the rest of the app, or asks "customize the button", "use my own component for X", "wire a custom action".
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Customize ComposableScreen Components

ComposableScreen UIElements are designed to match the host design system through props, not component replacement. There are two customization tiers.

## Always inspect target app first

Run probe from `../onboarding-best-practices/references/inspect-target-app.md`. The Design Profile drives the prop values you'll inject. Existing button + input components show the look you should match.

## Tier 1 — Match via props (default path)

Every styled UIElement (`Button`, `RadioGroup`, `CheckboxGroup`, `Input`, `WheelPicker`, `Text`, container stacks) accepts the full visual surface as props. Wire them all from the Design Profile and the result is indistinguishable from a native-host component.

`Button`:
- `variant: "filled" | "outlined" | "ghost"`
- `backgroundColor`, `color`, `fontFamily`, `fontWeight`, `fontSize`, `borderRadius`, `paddingVertical`, `paddingHorizontal`
- `shadowColor`, `shadowOffset: {width,height}`, `shadowOpacity`, `shadowRadius`, `elevation`
- `pressedStyle`, `disabledStyle` (Partial overrides merged per state), `transitionDurationMs`
- `disabledWhen`; `disabledBackgroundColor` / `disabledColor` (deprecated — prefer `disabledStyle`)
- `haptic: "none" | "light" | "medium" | "heavy" | "soft" | "rigid"` — tactile feedback on press (opt-in; needs optional `expo-haptics`)

`RadioGroup` / `CheckboxGroup`:
- `itemBackgroundColor`, `itemSelectedBackgroundColor`
- `itemBorderColor`, `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`
- `itemColor`, `itemSelectedColor`
- `itemFontFamily`, `itemFontSize`, `itemFontWeight`, `itemFontStyle`
- `itemPadding`, `itemPaddingVertical`, `itemPaddingHorizontal`
- `showTick` — show/hide the radio circle (checkbox box) indicator. Default: `true`
- `haptic: "none" | "light" | "medium" | "heavy" | "soft" | "rigid"` — tactile feedback on select/toggle (opt-in; needs optional `expo-haptics`)

`Input`:
- `backgroundColor`, `color`, `placeholderColor`, `borderRadius`
- `fontFamily`, `fontSize`, `fontWeight`, `textAlign`

`WheelPicker` (needs `@react-native-picker/picker`; provide exactly one of `items` or `range`):
- `itemColor` (defaults to `theme.colors.text.primary`)
- `itemFontSize`, `itemFontFamily` (iOS `itemStyle`)

`ProgressIndicator` (`variant: "linear" | "circular"`):
- `color` (progress fill; defaults to `theme.colors.primary`), `trackColor` (defaults to `theme.colors.neutral.lower`)
- `thickness` (bar height / ring stroke width), `size` (circular diameter px; default `120`)
- `showLabel`, `labelColor` (defaults to `theme.colors.text.primary`)
- value source: static `value` (0–100), bound `variableName`, or `autoplay`/`loop`/`initialValue`/`duration`/`easing` animation

`Text`:
- `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `color`, `lineHeight`, `letterSpacing`, `textAlign`

Containers (`YStack` / `XStack` / `ZStack` / `SafeAreaView` / `RichText`):
- `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`
- gradients via `background: GradientBackground`

Motion (every element, via `BaseBoxProps`):
- `transform` — static `{ translateX?, translateY?, scale?, scaleX?, scaleY?, rotate? }` (`rotate` in degrees)
- `animation` — `{ entering?, exiting?, layout?, effect? }` mirroring `react-native-reanimated` (`entering`/`exiting` use builder-name presets; `effect` is a continuous loop `"pulse"|"fade"|"rotate"|"shimmer"|"bounce"`). See `compose-screen-builder` for the full preset lists and a worked example.

This is the canonical path. 90% of customization needs are met by injecting Design Profile values into these props.

## Tier 2 — Custom button actions (host-wired behavior)

When you need behavior the schema doesn't cover (auto-advance after N seconds, request a permission, log an analytics event, conditional setState), use a `custom` button action:

```json
{
  "type": "Button",
  "props": {
    "label": "Continue",
    "actions": [
      { "type": "custom", "function": "trackOnboardingComplete", "variables": ["goal", "weight"] },
      "continue"
    ]
  }
}
```

Wire the implementation in the host via `customActions` on `OnboardingProvider`:

```tsx
<OnboardingProvider
  customActions={{
    trackOnboardingComplete: ({ variables }) => {
      analytics.track("onboarding_complete", variables);
    },
    delayedContinue: async () => {
      await new Promise(r => setTimeout(r, 2500));
    },
  }}
/>
```

Actions run sequentially; throwing aborts the chain; the literal string `"continue"` is terminal and advances the flow.

**First-class capability actions** — for common host capabilities, prefer the typed `actionHandlers` registry over a generic `custom` action: `navigate`, `openURL`, `requestNotificationPermission`, `requestHealthSync`, `presentPaywall`, `restorePurchase`, `requestReview`. Each is an optional handler; an unregistered one warn-and-skips.

```tsx
<OnboardingProvider
  actionHandlers={{
    // SDK does NOT own routing — register this to make a `navigate` action change screens
    navigate: ({ stepId }) => router.push(`/onboarding/${stepId}`),
    presentPaywall: async ({ placement }) => {
      const purchased = await paywall.present(placement);
      return { variables: { is_premium: { value: String(purchased), kind: "string" } } }; // merged back
    },
  }}
/>
```

A handler (custom **or** capability) may return `{ variables?, abort? }` (`ActionResult`): returned `variables` merge into the live variable bag (so a later step can branch on a permission/purchase result); `abort: true` stops the remaining actions. Returning nothing keeps today's behavior.

## Tier 3 — Replace a UIElement renderer (deep customization)

Edit the UI package mirror at `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/<Element>Element.tsx`. Use cases:

- Adding a new visual variant not expressible through existing props
- Wiring a host-only library (e.g. Skia-based progress ring) to an element
- Adding accessibility props the schema doesn't expose

This is repo-level work, not consumer-app work. Bump SDK version via the `bump-version` skill after editing. Mind the Zod schema duplication noted in `CLAUDE.md` — keep headless `elements/*.ts` + UI mirror in sync.

## Anti-patterns

- Don't reach for component replacement when the prop surface covers it. Tier 1 first.
- Don't bake brand colors as literals — pull from Design Profile so the onboarding tracks the rest of the app.
- Don't use a `custom` action when `setVariable` + `continue` would do the same job declaratively.
- Don't subclass or wrap an existing button component to inject onboarding-specific styles — author the styles on the `Button` UIElement directly.
- Don't add the same custom-action implementation in multiple host modules — declare it once on `customActions`.
