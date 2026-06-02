# ComposableScreen Archetypes

> **Schema reminder.** `payload = { elements: UIElement[] }`. No `payload.root`, no `payload.variables`. Variables flow at runtime from in-screen `Input` / `RadioGroup` / `CheckboxGroup` / `DatePicker` / `WheelPicker` `variableName` props (or prior steps' captures).

> **Element ids.** The readable `"id"` values below (`safe`, `root`, `title`, …) are illustrative for readability. In real output, every element `id` must be a fresh UUID v4 — never reuse or content-derive.

> **Design fidelity rule.** Every value below in `<DP.xxx>` placeholders comes from the Design Profile produced by `inspect-target-app.md`. Replace, don't ship with placeholders. Generic skeletons are a regression.

Outer shape (always):

```json
"elements": [
  {
    "id": "safe",
    "type": "SafeAreaView",
    "props": { "flex": 1, "edges": ["top", "bottom"], "backgroundColor": "<DP.surface.app>" },
    "children": [
      {
        "id": "root",
        "type": "YStack",
        "props": { "flex": 1, "paddingHorizontal": "<DP.spacing.lg>", "paddingTop": "<DP.spacing.md>", "paddingBottom": "<DP.spacing.lg>", "gap": "<DP.spacing.md>" },
        "children": [ /* archetype-specific */ ]
      }
    ]
  }
]
```

Spacer pattern (push CTA to bottom): `{ "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] }`.

CTA pattern (use every time — never bare `actions: ["continue"]` with no styling):

```json
{
  "id": "cta",
  "type": "Button",
  "props": {
    "label": "<DP.voice.ctaVerbs[0]>",
    "variant": "filled",
    "backgroundColor": "<DP.brand.primary>",
    "color": "<DP.text.onBrand>",
    "fontFamily": "<DP.fonts.heading>",
    "fontWeight": "<DP.fontWeights.semibold>",
    "fontSize": 17,
    "borderRadius": "<DP.buttonBorderRadius>",
    "paddingVertical": 16,
    "actions": ["continue"]
  }
}
```

### Adding motion to an element

Every element accepts optional `transform` (static) and `animation` (`{ entering, exiting, layout, effect }`, mirroring `react-native-reanimated`) via `BaseBoxProps`. Drop them into any archetype element's `props` for entrance/exit/loop motion. `entering`/`exiting` presets are exact reanimated builder names (e.g. `FadeInUp`, `ZoomInDown`, `FadeOut`); `effect.preset` is a continuous loop — one of `"pulse"|"fade"|"rotate"|"shimmer"|"bounce"`. Full preset lists live in the `compose-screen-builder` skill. Unknown presets degrade to a no-op.

```json
{
  "id": "hero-badge", "type": "Image",
  "props": {
    "url": "https://cdn.example.com/badge.png", "width": 96,
    "transform": { "rotate": -4 },
    "animation": {
      "entering": { "preset": "ZoomInDown", "duration": 600, "delay": 200, "spring": { "damping": 12, "stiffness": 180 } },
      "exiting": { "preset": "FadeOut", "duration": 250 },
      "effect": { "preset": "pulse", "duration": 1200, "minScale": 0.97, "maxScale": 1.06 }
    }
  }
}
```

Common touches: stagger a list of cards by bumping `entering.delay` per item (`100`, `200`, `300…`); give a hero a subtle living feel with `effect: { "preset": "pulse" }` or `{ "preset": "fade" }`; use `spring` (`{ damping?, stiffness?, mass? }`) instead of `easing` for bouncy entrances (`spring` wins when both are set).

### Mixed-style text & chip titles

Two ways to mix styles across fragments:

- **Inline spans** (simplest): set `Text.content` to an array of `{ text, fontWeight?, color?, … }` spans. Fragments wrap on one baseline; omitted props inherit from the parent `Text`. Spans are nested `<Text>` — text-style only (no box styling), no `renderWhen`, no per-span `expression`.
- **`RichText` container**: a wrapping flex row of full `Text` children (Text-only). Plain-text children **auto-split into one item per word**, so text wraps word-by-word and chips flow inline with it (the classic "Boost your `[energy]`" marketing-title pattern). A child with box styling (`backgroundColor` / `borderRadius` / `border` / `padding`) or motion stays an atomic **chip** that honors those props — `padding`, `borderRadius`, `transform` for padded/rounded/rotated pills. Children keep `renderWhen` / `expression`. `RichText.props` are layout props (`alignItems` incl. `"baseline"`, `justifyContent`, `flexWrap` default `"wrap"`) + `BaseBoxProps` + inherited text-style defaults — set base typography (`fontSize`, `fontWeight`, `color`, …) **once** on the container, children inherit it. `textAlign` (`left`/`center`/`right`) is inherited by children **and** aligns the wrapping row itself (maps to the row's `justifyContent` when `justifyContent` isn't set explicitly), so a centered title needs only `textAlign: "center"`. **Don't set `gap`** (split preserves spaces as items → double-spacing); give chips `marginHorizontal`.

```json
{
  "id": "title", "type": "RichText",
  "props": { "alignItems": "center", "justifyContent": "center", "fontSize": "<DP.fontSize.h1>", "fontWeight": "600" },
  "children": [
    { "id": "w1", "type": "Text", "props": { "content": "Boost your" } },
    { "id": "w2", "type": "Text", "props": {
      "content": "energy", "fontWeight": "700", "color": "<DP.text.onAccent>",
      "backgroundColor": "<DP.accent>", "paddingHorizontal": 14, "paddingVertical": 4, "borderRadius": 200,
      "marginHorizontal": 4, "transform": { "rotate": -3 } } }
  ]
}
```

---

## hero

Branded welcome. Hero media + tight value prop + primary CTA. No progress bar.

```json
[
  { "id": "hero-media", "type": "Image", "props": { "url": "<APP_BUNDLED_HERO>", "height": 320, "resizeMode": "cover", "borderRadius": "<DP.radius.lg>" } },
  { "id": "spacer-top", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  { "id": "kicker", "type": "Text", "props": { "content": "<KICKER>", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.caption>", "fontWeight": "<DP.fontWeights.semibold>", "color": "<DP.brand.primary>", "textAlign": "center", "letterSpacing": 1.2 } },
  { "id": "title", "type": "Text", "props": { "content": "<TITLE>", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.display>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center", "lineHeight": "<DP.typeScale.display * DP.lineHeightMultiplier>" } },
  { "id": "subtitle", "type": "Text", "props": { "content": "<SUBTITLE>", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>", "textAlign": "center" } },
  { "id": "spacer-bot", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  { "id": "cta", "type": "Button", "props": { "label": "<DP.voice.ctaVerbs[0]>", "variant": "filled", "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>", "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17, "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16, "actions": ["continue"] } }
]
```

---

## question-single

Title + helper + tappable cards (RadioGroup styled as cards) + disabled-until-selected CTA.

```json
[
  { "id": "kicker", "type": "Text", "props": { "content": "Step 2 of 6", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.caption>", "color": "<DP.text.tertiary>", "letterSpacing": 1.2 } },
  { "id": "title", "type": "Text", "props": { "content": "What's your goal?", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>" } },
  { "id": "subtitle", "type": "Text", "props": { "content": "We'll personalize your plan around this.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>" } },
  {
    "id": "answers",
    "type": "RadioGroup",
    "props": {
      "variableName": "goal",
      "direction": "vertical",
      "gap": "<DP.spacing.sm>",
      "itemBackgroundColor": "<DP.surface.card>",
      "itemSelectedBackgroundColor": "<DP.brand.primary>",
      "itemBorderColor": "<DP.border.subtle>",
      "itemSelectedBorderColor": "<DP.brand.primary>",
      "itemBorderRadius": "<DP.radius.md>",
      "itemBorderWidth": 1,
      "itemColor": "<DP.text.primary>",
      "itemSelectedColor": "<DP.text.onBrand>",
      "itemFontFamily": "<DP.fonts.body>",
      "itemFontSize": "<DP.typeScale.body>",
      "itemFontWeight": "<DP.fontWeights.medium>",
      "itemPaddingVertical": 18,
      "itemPaddingHorizontal": 20,
      "items": [
        { "label": "Lose weight", "value": "lose" },
        { "label": "Build muscle", "value": "muscle" },
        { "label": "Maintain", "value": "maintain" },
        { "label": "Just exploring", "value": "explore" }
      ]
    }
  },
  { "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Continue", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "disabledBackgroundColor": "<DP.surface.raised>",
      "disabledColor": "<DP.text.muted>",
      "disabledWhen": { "variable": "goal", "operator": "eq", "value": "" },
      "actions": ["continue"]
    }
  }
]
```

---

## question-multi

Same shape as question-single but `CheckboxGroup` + multi-select. CTA disabled until at least one selected.

```json
[
  { "id": "title", "type": "Text", "props": { "content": "What gets in your way?", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>" } },
  { "id": "subtitle", "type": "Text", "props": { "content": "Pick everything that applies.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>" } },
  {
    "id": "answers",
    "type": "CheckboxGroup",
    "props": {
      "variableName": "obstacles", "direction": "vertical", "gap": "<DP.spacing.sm>",
      "itemBackgroundColor": "<DP.surface.card>",
      "itemSelectedBackgroundColor": "<DP.brand.primary>",
      "itemBorderColor": "<DP.border.subtle>",
      "itemSelectedBorderColor": "<DP.brand.primary>",
      "itemBorderRadius": "<DP.radius.md>", "itemBorderWidth": 1,
      "itemColor": "<DP.text.primary>", "itemSelectedColor": "<DP.text.onBrand>",
      "itemFontFamily": "<DP.fonts.body>", "itemFontSize": "<DP.typeScale.body>",
      "itemFontWeight": "<DP.fontWeights.medium>",
      "itemPaddingVertical": 18, "itemPaddingHorizontal": 20,
      "items": [
        { "label": "Time", "value": "time" },
        { "label": "Motivation", "value": "motivation" },
        { "label": "Knowledge", "value": "knowledge" },
        { "label": "Consistency", "value": "consistency" }
      ]
    }
  },
  { "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Continue", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "disabledBackgroundColor": "<DP.surface.raised>", "disabledColor": "<DP.text.muted>",
      "disabledWhen": { "variable": "obstacles", "operator": "eq", "value": "" },
      "actions": ["continue"]
    }
  }
]
```

---

## input

Centered hero input with the app's input styling.

```json
[
  { "id": "title", "type": "Text", "props": { "content": "What should we call you?", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
  { "id": "subtitle", "type": "Text", "props": { "content": "We'll only use your first name.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>", "textAlign": "center" } },
  {
    "id": "name-input",
    "type": "Input",
    "props": {
      "variableName": "name",
      "placeholder": "Your name",
      "autoCapitalize": "words", "maxLength": 40,
      "textAlign": "center",
      "fontFamily": "<DP.fonts.heading>",
      "fontSize": 28, "fontWeight": "<DP.fontWeights.semibold>",
      "color": "<DP.text.primary>", "placeholderColor": "<DP.text.tertiary>",
      "backgroundColor": "<DP.surface.card>",
      "borderRadius": "<DP.inputBorderRadius>",
      "paddingVertical": 18, "paddingHorizontal": 16
    }
  },
  { "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Continue", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "disabledBackgroundColor": "<DP.surface.raised>", "disabledColor": "<DP.text.muted>",
      "disabledWhen": { "variable": "name", "operator": "eq", "value": "" },
      "actions": ["continue"]
    }
  }
]
```

---

## picker (numeric)

Large display number + small unit. Wrap input + unit in an XStack so they align.

```json
[
  { "id": "title", "type": "Text", "props": { "content": "Your current weight", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
  { "id": "spacer-top", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "value-row",
    "type": "XStack",
    "props": { "justifyContent": "center", "alignItems": "baseline", "gap": "<DP.spacing.xs>" },
    "children": [
      {
        "id": "weight-input",
        "type": "Input",
        "props": {
          "variableName": "weight",
          "keyboardType": "decimal-pad",
          "placeholder": "70",
          "textAlign": "center",
          "fontFamily": "<DP.fonts.heading>",
          "fontSize": 64, "fontWeight": "<DP.fontWeights.bold>",
          "color": "<DP.brand.primary>",
          "placeholderColor": "<DP.text.tertiary>",
          "width": 160
        }
      },
      { "id": "unit", "type": "Text", "props": { "content": "kg", "fontFamily": "<DP.fonts.heading>", "fontSize": 24, "fontWeight": "<DP.fontWeights.semibold>", "color": "<DP.text.secondary>" } }
    ]
  },
  { "id": "spacer-bot", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Continue", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "disabledBackgroundColor": "<DP.surface.raised>", "disabledColor": "<DP.text.muted>",
      "disabledWhen": { "variable": "weight", "operator": "eq", "value": "" },
      "actions": ["continue"]
    }
  }
]
```

---

## reflection

Personalized mirror of prior answers. Card-styled body wrapping a `YStack`.

```json
[
  { "id": "spacer-top", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  { "id": "avatar", "type": "Icon", "props": { "name": "sparkles", "size": 48, "color": "<DP.brand.primary>", "fill": "<DP.brand.primary>", "fillOpacity": 0.2 } },
  { "id": "title", "type": "Text", "props": { "content": "{{name}}, here's your plan.", "mode": "expression", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
  {
    "id": "card",
    "type": "YStack",
    "props": {
      "backgroundColor": "<DP.surface.card>",
      "borderRadius": "<DP.radius.lg>",
      "padding": "<DP.spacing.lg>",
      "gap": "<DP.spacing.sm>",
      "borderWidth": 1, "borderColor": "<DP.border.subtle>"
    },
    "children": [
      { "id": "row-goal", "type": "Text", "props": { "content": "Goal — {{goal}}", "mode": "expression", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.primary>" } },
      { "id": "row-weight", "type": "Text", "props": { "content": "Target weight — {{weight}} kg", "mode": "expression", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.primary>" } }
    ]
  },
  { "id": "spacer-bot", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Let's go", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "actions": ["continue"]
    }
  }
]
```

---

## social-proof

Three quote cards in a vertical scroll.

```json
[
  { "id": "title", "type": "Text", "props": { "content": "Why 50,000 people start with us", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h2>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
  {
    "id": "quotes",
    "type": "YStack",
    "props": { "gap": "<DP.spacing.md>" },
    "children": [
      {
        "id": "quote-1",
        "type": "YStack",
        "props": { "backgroundColor": "<DP.surface.card>", "borderRadius": "<DP.radius.md>", "padding": "<DP.spacing.md>", "gap": 6, "borderWidth": 1, "borderColor": "<DP.border.subtle>" },
        "children": [
          { "id": "q1-stars", "type": "Text", "props": { "content": "★★★★★", "color": "<DP.brand.primary>" } },
          { "id": "q1-text", "type": "Text", "props": { "content": "Changed my routine completely.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.primary>" } },
          { "id": "q1-author", "type": "Text", "props": { "content": "Alex, 32", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.caption>", "color": "<DP.text.tertiary>" } }
        ]
      },
      {
        "id": "quote-2",
        "type": "YStack",
        "props": { "backgroundColor": "<DP.surface.card>", "borderRadius": "<DP.radius.md>", "padding": "<DP.spacing.md>", "gap": 6, "borderWidth": 1, "borderColor": "<DP.border.subtle>" },
        "children": [
          { "id": "q2-stars", "type": "Text", "props": { "content": "★★★★★", "color": "<DP.brand.primary>" } },
          { "id": "q2-text", "type": "Text", "props": { "content": "I look forward to opening this every day.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.primary>" } },
          { "id": "q2-author", "type": "Text", "props": { "content": "Maya, 28", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.caption>", "color": "<DP.text.tertiary>" } }
        ]
      }
    ]
  },
  { "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Continue", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "actions": ["continue"]
    }
  }
]
```

---

## loader

Lottie + status line + secondary tip card. No auto-advance built into schema — emit a `custom` action `delayedContinue` that the host wires to a timer (fall back to plain `["continue"]` if host doesn't implement it).

```json
[
  { "id": "spacer-top", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  { "id": "anim", "type": "Lottie", "props": { "source": "<APP_LOADER_LOTTIE_URL>", "autoPlay": true, "loop": true, "height": 220 } },
  { "id": "title", "type": "Text", "props": { "content": "Building your plan…", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h2>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
  { "id": "subtitle", "type": "Text", "props": { "content": "Tuning macros and weekly targets to your inputs.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>", "textAlign": "center" } },
  {
    "id": "tip",
    "type": "YStack",
    "props": { "backgroundColor": "<DP.surface.card>", "borderRadius": "<DP.radius.md>", "padding": "<DP.spacing.md>", "gap": 4, "borderWidth": 1, "borderColor": "<DP.border.subtle>" },
    "children": [
      { "id": "tip-kicker", "type": "Text", "props": { "content": "Did you know", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.caption>", "fontWeight": "<DP.fontWeights.semibold>", "color": "<DP.brand.primary>", "letterSpacing": 1.2 } },
      { "id": "tip-body", "type": "Text", "props": { "content": "Most people see results in the first 2 weeks of consistent logging.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.primary>" } }
    ]
  },
  { "id": "spacer-bot", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "Continue", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "actions": [
        { "type": "custom", "function": "delayedContinue", "variables": [] }
      ]
    }
  }
]
```

---

## commitment

Signature-style: title + 3 commitment checkboxes (forced-tap) + big CTA.

```json
[
  { "id": "title", "type": "Text", "props": { "content": "I'm committing to my plan", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>" } },
  { "id": "subtitle", "type": "Text", "props": { "content": "Tap each one to make it stick.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>" } },
  {
    "id": "checks",
    "type": "CheckboxGroup",
    "props": {
      "variableName": "commitments", "direction": "vertical", "gap": "<DP.spacing.sm>",
      "itemBackgroundColor": "<DP.surface.card>", "itemSelectedBackgroundColor": "<DP.brand.primary>",
      "itemBorderColor": "<DP.border.subtle>", "itemSelectedBorderColor": "<DP.brand.primary>",
      "itemBorderRadius": "<DP.radius.md>", "itemBorderWidth": 1,
      "itemColor": "<DP.text.primary>", "itemSelectedColor": "<DP.text.onBrand>",
      "itemFontFamily": "<DP.fonts.body>", "itemFontSize": "<DP.typeScale.body>",
      "itemFontWeight": "<DP.fontWeights.medium>",
      "itemPaddingVertical": 18, "itemPaddingHorizontal": 20,
      "items": [
        { "label": "Show up for 21 days", "value": "21days" },
        { "label": "Be kind to myself", "value": "kind" },
        { "label": "Track every meal", "value": "track" }
      ]
    }
  },
  { "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "I'm in", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "disabledBackgroundColor": "<DP.surface.raised>", "disabledColor": "<DP.text.muted>",
      "disabledWhen": { "variable": "commitments", "operator": "eq", "value": "" },
      "actions": ["continue"]
    }
  }
]
```

---

## carousel

3-slide intro. Each slide = title + image + body inside a YStack. Use carousel's built-in dots.

```json
[
  {
    "id": "carousel",
    "type": "Carousel",
    "props": {
      "carouselType": "normal",
      "showDots": true,
      "dotColor": "<DP.border.subtle>",
      "activeDotColor": "<DP.brand.primary>",
      "defaultIndex": 0,
      "variableName": "carouselPage",
      "height": 480
    },
    "children": [
      {
        "id": "slide-1",
        "type": "YStack",
        "props": { "padding": "<DP.spacing.lg>", "gap": "<DP.spacing.md>", "alignItems": "center" },
        "children": [
          { "id": "s1-img", "type": "Image", "props": { "url": "<APP_BUNDLED_S1>", "height": 240, "resizeMode": "contain", "borderRadius": "<DP.radius.lg>" } },
          { "id": "s1-title", "type": "Text", "props": { "content": "Plan", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
          { "id": "s1-body", "type": "Text", "props": { "content": "Tell us your goal in 30 seconds.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>", "textAlign": "center" } }
        ]
      },
      {
        "id": "slide-2",
        "type": "YStack",
        "props": { "padding": "<DP.spacing.lg>", "gap": "<DP.spacing.md>", "alignItems": "center" },
        "children": [
          { "id": "s2-img", "type": "Image", "props": { "url": "<APP_BUNDLED_S2>", "height": 240, "resizeMode": "contain", "borderRadius": "<DP.radius.lg>" } },
          { "id": "s2-title", "type": "Text", "props": { "content": "Track", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
          { "id": "s2-body", "type": "Text", "props": { "content": "Log meals in seconds.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>", "textAlign": "center" } }
        ]
      },
      {
        "id": "slide-3",
        "type": "YStack",
        "props": { "padding": "<DP.spacing.lg>", "gap": "<DP.spacing.md>", "alignItems": "center" },
        "children": [
          { "id": "s3-img", "type": "Image", "props": { "url": "<APP_BUNDLED_S3>", "height": 240, "resizeMode": "contain", "borderRadius": "<DP.radius.lg>" } },
          { "id": "s3-title", "type": "Text", "props": { "content": "Win", "fontFamily": "<DP.fonts.heading>", "fontSize": "<DP.typeScale.h1>", "fontWeight": "<DP.fontWeights.bold>", "color": "<DP.text.primary>", "textAlign": "center" } },
          { "id": "s3-body", "type": "Text", "props": { "content": "Hit your goal with weekly check-ins.", "fontFamily": "<DP.fonts.body>", "fontSize": "<DP.typeScale.body>", "color": "<DP.text.secondary>", "textAlign": "center" } }
        ]
      }
    ]
  },
  { "id": "spacer", "type": "YStack", "props": { "flex": 1 }, "children": [] },
  {
    "id": "cta",
    "type": "Button",
    "props": {
      "label": "<DP.voice.ctaVerbs[0]>", "variant": "filled",
      "backgroundColor": "<DP.brand.primary>", "color": "<DP.text.onBrand>",
      "fontFamily": "<DP.fonts.heading>", "fontWeight": "<DP.fontWeights.semibold>", "fontSize": 17,
      "borderRadius": "<DP.buttonBorderRadius>", "paddingVertical": 16,
      "actions": ["continue"]
    }
  }
]
```

---

## Element prop reference (canonical names — refresher)

| Element | Required | Notes |
|---------|----------|-------|
| `SafeAreaView` | — | `edges: ["top","bottom"]` or modes; never `"always"` |
| `YStack` / `XStack` / `ZStack` | — | `children` at element top-level |
| `Text` | `content` | `mode: "expression"` to interpolate `{{var}}`; set `fontFamily`, `fontSize`, `fontWeight`, `color` from Design Profile |
| `Image` | `url` (string) | NOT `source.uri`. WebP/AVIF decode via `expo-image` when installed (falls back to RN `Image`); `.svg` URLs auto-render via `react-native-svg` (`resizeMode`→`preserveAspectRatio`) — no schema change |
| `Lottie` | `source` (string URL) | |
| `Rive` | `url` (string URL) | |
| `Input` | — | `variableName`, `keyboardType`, `autoCapitalize`, `maxLength`, `textAlign`. No `suffix`/`autoFocus`. |
| `Button` | `label` | `actions: ButtonAction[]`; `disabledWhen` (LeafCondition/Group); `pressedStyle`/`disabledStyle` (Partial overrides) + `transitionDurationMs`; shadow (`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`/`elevation`); explicit `backgroundColor`/`color`/`fontFamily`/`borderRadius` from Design Profile. `disabledStyle` supersedes deprecated `disabledBackgroundColor`/`disabledColor` |
| `RadioGroup` / `CheckboxGroup` | `items: [{label,value}]` | Wire `itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`, `itemBorderRadius`, `itemFontFamily`, etc., from Design Profile; `showTick` (boolean, default `true`) hides the radio circle / checkbox box indicator when `false` |
| `DatePicker` | — | `variableName`; `defaultValue`/`minimumDate`/`maximumDate` accept an ISO date string or the literal `"now"` (resolved to current date/time at render); see `DatePickerElement.ts` |
| `WheelPicker` | exactly one of `items: [{label,value}]` or `range: {min,max,step?,unit?}` | `variableName`; `defaultValue` must match an available value; `range.unit` appends to labels (`"70 kg"`); wire `itemColor`/`itemFontSize`/`itemFontFamily` from Design Profile; needs `@react-native-picker/picker`; see `WheelPickerElement.ts` |
| `ProgressIndicator` | — | `variant: "linear"\|"circular"` (default `"linear"`); value from static `value` (0–100), bound `variableName`, or `autoplay`/`loop`/`initialValue`/`duration`/`delay`/`easing` animation; wire `color`/`trackColor`/`thickness`/`size`/`showLabel`/`labelColor` from Design Profile; see `ProgressIndicatorElement.ts` |
| `Carousel` | — | slides in `children` at element top-level |

## Composition principles

- **Never ship without explicit colors / fonts / radii.** A "default" Button or Text in ComposableScreen renders with theme defaults — fine for prototyping, but the user asked for design fidelity. Always set the props.
- **Layered backgrounds**: outer `SafeAreaView` uses `surface.app`; cards use `surface.card`; raised states use `surface.raised`. Three tones beats one flat color.
- **Stress hierarchy**: headings in heading font + bold; body in body font + regular; meta/kickers in body + semibold + caption size + letter-spacing.
- **Don't snap to `gap: 16`** if the app uses 12 everywhere. Match the spacing scale.
- **CTAs share one style across the flow** — backgroundColor, height, radius, font all identical. Visual continuity drives perceived polish.
- **Use cards for grouped info**: reflection rows, social proof quotes, "did you know" tips all wrap in `YStack` with `surface.card` background + radius + 1px border.
