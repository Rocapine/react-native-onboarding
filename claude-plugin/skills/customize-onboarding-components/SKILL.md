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

Every styled UIElement (`Button`, `RadioGroup`, `CheckboxGroup`, `Input`, `WheelPicker`, `DrawingPad`, `Slider`, `Text`, container stacks) accepts the full visual surface as props. Wire them all from the Design Profile and the result is indistinguishable from a native-host component.

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
- `itemShadowColor`, `itemShadowOffset: {width,height}`, `itemShadowOpacity`, `itemShadowRadius`, `itemElevation` — per-item drop shadow (lone `itemShadowColor` defaults opacity `1` / radius `4`)
- `showTick` — show/hide the radio circle (checkbox box) indicator. Default: `true`
- `tickPosition: "start" | "end"` — tick placement relative to the label. Default: `"start"`
- `tickColor`, `tickSelectedColor`, `tickBorderRadius` — tick element styling per state (radius default: radio `tickSize/2`, checkbox `4`)
- `tickSize` — tick diameter (radio) / box side (checkbox) in px; inner dot/checkmark scales with it. Default: `20`
- per-item `subLabel` (secondary line) styling: `itemSubLabelColor`, `itemSelectedSubLabelColor`, `itemSubLabelFontSize`, `itemSubLabelFontWeight`, `itemSubLabelFontFamily`, `itemSubLabelFontStyle`
- `haptic: "none" | "light" | "medium" | "heavy" | "soft" | "rigid"` — tactile feedback on select/toggle (opt-in; needs optional `expo-haptics`)

Items are `{ label?, value, subLabel? }`: `label` is optional (omit for a sub-label-only row — no gap is added when a line is absent), `value` required, `subLabel` an optional secondary line.

`Input`:
- `backgroundColor`, `color`, `placeholderColor`, `borderRadius`
- `fontFamily`, `fontSize`, `fontWeight`, `textAlign`

`WheelPicker` (needs `@react-native-picker/picker`; provide exactly one of `items` or `range`):
- `itemColor` (defaults to `theme.colors.text.primary`)
- `itemFontSize`, `itemFontFamily` (iOS `itemStyle`)

`DrawingPad` (freehand draw/signature canvas; needs `@shopify/react-native-skia` — mandatory for this element):
- captures the drawing into a variable: `variableName` → SVG path string; `imageVariableName` → base64 image data URI (set either or both)
- `strokeColor` (pen; defaults to `theme.colors.text.primary`), `strokeWidth` (>0, default 2)
- `backgroundColor` (canvas fill, also painted into the exported image; defaults to `theme.colors.neutral.lowest`)
- `clearable` (show clear button; default true), `imageFormat` (`"png" | "jpeg"`, default `"png"`)
- clear button: `clearButtonPosition` (`"top-left"|"top-right"|"bottom-left"|"bottom-right"`, default `"top-right"`), `clearButtonOffset` (edge distance px, default 8), `clearButtonSize` (diameter px, default 32), `clearButtonColor` (bg; defaults to `theme.colors.neutral.higher`), `clearButtonIconColor` (glyph; defaults to `theme.colors.text.opposite`), `clearButtonLabel` (glyph/text, default `"✕"`)
- box defaults: `height` 200, `borderWidth` 2, `borderRadius` 16, `borderColor` = `theme.colors.primary`

`Slider` (continuous numeric input bound to a variable; needs `@react-native-community/slider`):
- `minimumTrackTintColor` (filled portion; defaults to `theme.colors.primary`), `maximumTrackTintColor` (remaining track), `thumbTintColor`
- value: `defaultValue` (defaults to `min`, else 0), `min` (default 0), `max` (default 1), `step` (0 = continuous; default 0)
- `disabled`

`ProgressIndicator` (`variant: "linear" | "circular"`):
- `color` (progress fill; defaults to `theme.colors.primary`), `trackColor` (defaults to `theme.colors.neutral.lower`)
- `thickness` (bar height / ring stroke width), `size` (circular diameter px; default `120`)
- `showLabel`, `labelColor` (defaults to `theme.colors.text.primary`), `labelSuffix` (default `"%"`; set `""` / unit for non-percent ranges)
- value range: `minValue` (default 0) / `maxValue` (default 100) — label + bound variable carry the raw value, not a percentage; `step` (default 1) snaps the label/variable. For an animated count-up to N: `minValue:0, maxValue:N, autoplay`, coarse `step` for large N
- value source: static `value`, bound `variableName`, or `autoplay`/`loop`/`initialValue`/`duration`/`easing` animation (all in `[minValue, maxValue]`)

`AnimatedText` (count-up number, animated on the UI thread — **no re-render, no variable write**):
- value: `to` (required) / `from` (default 0); `autoplay` (default true), `loop` (default false), `duration` (default 1000), `delay`, `easing` (default `"ease-out"`)
- formatting: `decimals` (default 0), `thousandsSeparator` (default `","`; set `""` to disable grouping)
- text styling: `fontSize`, `fontWeight`, `fontFamily`, `fontStyle`, `color` (defaults to `theme.colors.text.primary`), `textAlign`, `letterSpacing`, `lineHeight`
- renders the number only — compose static labels as sibling `Text`; use it instead of an `autoplay` `ProgressIndicator` bound to a variable when you only need an animated number (avoids the per-step re-render storm)

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
