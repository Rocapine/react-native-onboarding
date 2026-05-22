# ComposableScreen Archetypes

> **Schema reminder.** `payload = { elements: UIElement[] }`. There is **no** `payload.root`, **no** `payload.variables`. Variables flow at runtime from prior steps' `variableName` captures (Picker, Question) or from in-screen `Input` / `RadioGroup` / `CheckboxGroup` / `Button` `setVariable` actions. Reference them in `Text` with `mode: "expression"` and `{{name}}` in `content`.

Every archetype below shows the contents of `payload.elements`. The canonical outer shape is a `SafeAreaView` wrapping a `YStack`:

```json
"elements": [
  {
    "id": "safe",
    "type": "SafeAreaView",
    "props": { "flex": 1, "edges": ["top", "bottom"] },
    "children": [
      {
        "id": "root",
        "type": "YStack",
        "props": { "flex": 1, "padding": 24, "gap": 16 },
        "children": [ /* archetype-specific */ ]
      }
    ]
  }
]
```

Inner pattern: content stack + spacer (`{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } }`) + CTA button.

Replace `"#REPLACE_ME"` / `"REPLACE_ME"` placeholders with values from the target-app probe (brand color, font family, image URL).

---

## hero

```json
{
  "id": "media",
  "type": "Image",
  "props": { "url": "https://REPLACE_ME", "height": 240, "resizeMode": "cover", "borderRadius": 16 }
},
{ "id": "title", "type": "Text", "props": { "content": "Track every meal", "fontSize": 28, "fontWeight": "700", "textAlign": "center" } },
{ "id": "subtitle", "type": "Text", "props": { "content": "Logging takes seconds.", "fontSize": 16, "textAlign": "center" } },
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{ "id": "cta", "type": "Button", "props": { "label": "Get started", "variant": "filled", "actions": ["continue"] } }
```

---

## question-single

```json
{ "id": "title", "type": "Text", "props": { "content": "What's your goal?", "fontSize": 28, "fontWeight": "700" } },
{
  "id": "answers",
  "type": "RadioGroup",
  "props": {
    "variableName": "goal",
    "direction": "vertical",
    "gap": 12,
    "items": [
      { "label": "Lose weight", "value": "lose" },
      { "label": "Build muscle", "value": "muscle" },
      { "label": "Maintain", "value": "maintain" }
    ]
  }
},
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{
  "id": "cta",
  "type": "Button",
  "props": {
    "label": "Continue",
    "variant": "filled",
    "actions": ["continue"],
    "disabledWhen": { "variable": "goal", "operator": "eq", "value": "" }
  }
}
```

---

## question-multi

```json
{
  "id": "answers",
  "type": "CheckboxGroup",
  "props": {
    "variableName": "obstacles",
    "direction": "vertical",
    "gap": 12,
    "items": [
      { "label": "Time", "value": "time" },
      { "label": "Motivation", "value": "motivation" },
      { "label": "Knowledge", "value": "knowledge" }
    ]
  }
}
```

CTA `disabledWhen`: `{ "variable": "obstacles", "operator": "eq", "value": "" }`.

---

## input

```json
{ "id": "title", "type": "Text", "props": { "content": "What should we call you?", "fontSize": 24, "fontWeight": "700" } },
{
  "id": "name-input",
  "type": "Input",
  "props": {
    "variableName": "name",
    "placeholder": "Your name",
    "autoCapitalize": "words",
    "maxLength": 40,
    "textAlign": "center",
    "fontSize": 24
  }
},
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{
  "id": "cta",
  "type": "Button",
  "props": {
    "label": "Continue",
    "actions": ["continue"],
    "disabledWhen": { "variable": "name", "operator": "eq", "value": "" }
  }
}
```

---

## picker (numeric)

Numeric input via `Input` with `keyboardType: "numeric"` — no built-in numeric picker UIElement.

```json
{ "id": "title", "type": "Text", "props": { "content": "Your weight", "fontSize": 24, "fontWeight": "700", "textAlign": "center" } },
{
  "id": "weight-input",
  "type": "Input",
  "props": {
    "variableName": "weight",
    "keyboardType": "decimal-pad",
    "placeholder": "70",
    "textAlign": "center",
    "fontSize": 48
  }
},
{ "id": "unit", "type": "Text", "props": { "content": "kg", "fontSize": 16, "textAlign": "center" } },
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{
  "id": "cta",
  "type": "Button",
  "props": {
    "label": "Continue",
    "actions": ["continue"],
    "disabledWhen": { "variable": "weight", "operator": "eq", "value": "" }
  }
}
```

For date inputs use `DatePicker` UIElement (check `elements/DatePickerElement.ts` for props).

---

## reflection

Personalized message using a prior-step variable. Text MUST set `mode: "expression"` to interpolate `{{name}}`.

```json
{
  "id": "title",
  "type": "Text",
  "props": { "content": "Hi {{name}}, here's your plan.", "mode": "expression", "fontSize": 28, "fontWeight": "700", "textAlign": "center" }
},
{ "id": "body", "type": "Text", "props": { "content": "Built around your goal of {{goal}}.", "mode": "expression", "fontSize": 16, "textAlign": "center" } },
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{ "id": "cta", "type": "Button", "props": { "label": "Continue", "actions": ["continue"] } }
```

---

## social-proof

```json
{ "id": "stars", "type": "Text", "props": { "content": "★★★★★", "fontSize": 32, "textAlign": "center" } },
{ "id": "quote", "type": "Text", "props": { "content": "Changed my routine completely.", "fontSize": 18, "textAlign": "center" } },
{ "id": "author", "type": "Text", "props": { "content": "— Alex, 32", "fontSize": 14, "textAlign": "center" } },
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{ "id": "cta", "type": "Button", "props": { "label": "Continue", "actions": ["continue"] } }
```

---

## loader

Use `Lottie` for the visual. No auto-advance action exists yet — emit a continue button with a label that signals waiting, or use a custom action your host wires to a timer.

```json
{
  "id": "anim",
  "type": "Lottie",
  "props": {
    "source": "https://REPLACE_ME.json",
    "autoPlay": true,
    "loop": true,
    "height": 220
  }
},
{ "id": "title", "type": "Text", "props": { "content": "Building your plan…", "fontSize": 24, "fontWeight": "700", "textAlign": "center" } },
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{
  "id": "cta",
  "type": "Button",
  "props": {
    "label": "Continue",
    "actions": [
      { "type": "custom", "function": "delayedContinue", "variables": [] }
    ]
  }
}
```

If host doesn't implement `delayedContinue`, fall back to plain `actions: ["continue"]`.

---

## commitment

```json
{ "id": "title", "type": "Text", "props": { "content": "I'm committing to my plan", "fontSize": 28, "fontWeight": "700" } },
{
  "id": "checks",
  "type": "CheckboxGroup",
  "props": {
    "variableName": "commitments",
    "direction": "vertical",
    "gap": 12,
    "items": [
      { "label": "Show up for 21 days", "value": "21days" },
      { "label": "Be kind to myself", "value": "kind" }
    ]
  }
},
{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } },
{
  "id": "cta",
  "type": "Button",
  "props": {
    "label": "I'm in",
    "actions": ["continue"],
    "disabledWhen": { "variable": "commitments", "operator": "eq", "value": "" }
  }
}
```

---

## carousel

`Carousel` is itself a UIElement with `children` at the element level (not in props). Slides are direct children.

```json
{
  "id": "carousel",
  "type": "Carousel",
  "props": {
    "carouselType": "normal",
    "showDots": true,
    "defaultIndex": 0,
    "variableName": "carouselPage",
    "height": 360
  },
  "children": [
    {
      "id": "slide-1",
      "type": "YStack",
      "props": { "padding": 24, "gap": 8, "alignItems": "center" },
      "children": [
        { "id": "s1-img", "type": "Image", "props": { "url": "https://REPLACE_ME", "height": 200, "resizeMode": "contain" } },
        { "id": "s1-title", "type": "Text", "props": { "content": "Step 1", "fontSize": 22, "fontWeight": "700" } }
      ]
    },
    {
      "id": "slide-2",
      "type": "YStack",
      "props": { "padding": 24, "gap": 8, "alignItems": "center" },
      "children": [
        { "id": "s2-img", "type": "Image", "props": { "url": "https://REPLACE_ME", "height": 200, "resizeMode": "contain" } },
        { "id": "s2-title", "type": "Text", "props": { "content": "Step 2", "fontSize": 22, "fontWeight": "700" } }
      ]
    }
  ]
}
```

---

## Element prop reference (canonical names)

| Element | Required props | Notes |
|---------|---------------|-------|
| `SafeAreaView` | — | `edges: ["top","bottom"]` array OR `{ top: "additive" \| "maximum" \| "off" }`. **Never** `"always"`. |
| `YStack` / `XStack` / `ZStack` | — | `children: UIElement[]` at element level (not in props) |
| `Text` | `content` | `mode: "expression"` to interpolate `{{var}}`; use `fontSize` / `fontWeight` / `fontFamily` — **no `variant`** |
| `Image` | `url` | `url` is a string, NOT `source.uri` |
| `Lottie` | `source` | `source` is string (URL) |
| `Rive` | `url` | string URL |
| `Video` | check `VideoElement.ts` | |
| `Icon` | check `IconElement.ts` | |
| `Input` | — | `variableName` to bind; `placeholder`, `keyboardType`, `maxLength`, `textAlign`, `autoCapitalize`. **No `suffix` / `autoFocus` / `alignment`.** |
| `Button` | `label` | `actions: ButtonAction[]` (NOT `action`). Use `"continue"` string OR `{ type: "custom", function, variables? }`. `disabledWhen: LeafCondition \| ConditionGroup` (NOT `disabled`). |
| `RadioGroup` | `items` | `items: [{label, value}]` (NOT `options`); `variableName` to bind |
| `CheckboxGroup` | `items` | same as RadioGroup |
| `DatePicker` | check `DatePickerElement.ts` | `variableName` to bind |
| `Carousel` | — | slides in `children` at element level; props include `carouselType`, `showDots`, `defaultIndex`, `variableName` |

## Composition tips

- Match brand `borderRadius`, font family, padding from app probe.
- Pull CTA verb (`"Continue"` vs `"Let's go"`) from app voice.
- One archetype per screen.
- Always set `flex: 1` on outer `SafeAreaView` and outer `YStack` so spacer pattern works.
- Spacer pattern: `{ "id": "spacer", "type": "YStack", "props": { "flex": 1 } }` pushes CTA to bottom.
