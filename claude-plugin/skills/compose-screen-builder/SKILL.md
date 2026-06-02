---
name: compose-screen-builder
description: Builds the inner UIElement tree of a ComposableScreen step. Inspects the target app's design system before composing. Use when authoring a ComposableScreen, asks "compose a screen", "build the UIElement tree", "design the layout", or needs branching/variables in a single screen.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Compose Screen Builder

This plugin uses **ComposableScreen exclusively**. This skill is the deep reference for UIElement trees.

## Process

### 1. Inspect target app first

Run probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture the structured **Design Profile** (brand colors, surface tones, text colors, fonts + scale, font weights, radius scale, spacing scale, button height/padding/radius, input height/radius, voice, motion libs, icon lib, naming style, existing button/card component paths).

Inject every value into every element you emit. Never:

- ship a `Text` without explicit `fontFamily` / `fontSize` / `color`
- ship a `Button` without explicit `backgroundColor` / `color` / `borderRadius` / `fontFamily`
- ship a `RadioGroup` without explicit `itemBackgroundColor` / `itemSelectedBackgroundColor` / `itemBorderRadius`
- pick `gap` / `padding` values not on the app's spacing ladder
- use generic Tailwind-default colors when the app has its own brand

### 2. Pick archetype

Start from an archetype in `../create-step-json/references/composable-archetypes.md`. Customize from there. Don't compose from scratch unless the screen is genuinely novel.

### 3. Compose the tree

## Element types

| Type | Purpose |
|------|---------|
| `YStack` / `XStack` | Vertical / horizontal flex container; has `children` |
| `ZStack` | Layered stack (overlay) |
| `SafeAreaView` | Safe-area wrapper with per-edge mode |
| `Text` | Text node (supports `{{variableName}}` interpolation; `content` may be a string or an array of styled spans for inline rich text) |
| `RichText` | Wrapping flex row of child `Text` elements (Text-only `children`); words and padded/rounded/rotated "chip" segments wrap and align together. Each child is a real flex child, so it honors box props (`padding`, `borderRadius`, `border`, `backgroundColor`, `transform`) + its own `renderWhen` / `expression`, and inherits the container's text-style defaults (`fontSize`, `color`, …). `flexWrap` defaults to `"wrap"` |
| `Image` | Image from a `url`. Decodes WebP/AVIF via `expo-image` when that optional peer dep is installed (falls back to RN `Image`); a `.svg` URL is auto-detected and rendered with `react-native-svg` |
| `Lottie` / `Rive` / `Video` | Animated media |
| `Icon` | Vector icon |
| `Input` | Text input bound to a variable |
| `Button` | Triggers a `ButtonAction` (continue, setVariable, custom) |
| `RadioGroup` / `CheckboxGroup` | Bound to a variable |
| `DatePicker` | Date input bound to a variable |
| `WheelPicker` | Scrolling wheel selector bound to a variable (needs `@react-native-picker/picker`) |
| `Carousel` | Inline horizontal pager |
| `ProgressIndicator` | Linear / circular progress bar; static `value`, bound `variableName`, or `autoplay` animation |

Authoritative prop shapes: `packages/onboarding/src/steps/ComposableScreen/elements/*.ts`.

## BaseBoxProps (every element)

`width`, `height`, `flex`, `padding{Top,Right,Bottom,Left,Horizontal,Vertical}`, `margin*`, `gap`, `alignItems`, `justifyContent`, `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, `aspectRatio`, `background: GradientBackground`.

**Shadow (all elements):** `shadowColor`, `shadowOffset: { width, height }`, `shadowOpacity` (0–1), `shadowRadius`, `elevation` (Android). Currently only the `Button` renderer applies these; schema accepts them on every element.

**Match probe values**: use the app's button `borderRadius` for buttons and large media, half of that for chips/tags, etc.

## Animations / transitions / effects (every element)

Two optional `BaseBoxProps` surfaces apply to **every** element type. Both mirror `react-native-reanimated`. Unknown presets degrade to a no-op (never crash).

**`transform`** (static, applied once):

```
{ translateX?, translateY?, scale?, scaleX?, scaleY?, rotate? }  // all numbers; rotate is in degrees
```

**`animation`** — `{ entering?, exiting?, layout?, effect? }`:

- `entering` / `exiting`: `{ preset, duration?, delay?, easing?, spring? }`. `preset` is the **exact reanimated builder name**.
  - Entering presets: `FadeIn`, `FadeInUp`, `FadeInDown`, `FadeInLeft`, `FadeInRight`, `SlideInUp`, `SlideInDown`, `SlideInLeft`, `SlideInRight`, `ZoomIn`, `ZoomInRotate`, `ZoomInUp`, `ZoomInDown`, `ZoomInLeft`, `ZoomInRight`, `ZoomInEasyUp`, `ZoomInEasyDown`, `BounceIn`, `BounceInUp`, `BounceInDown`, `BounceInLeft`, `BounceInRight`, `FlipInXUp`, `FlipInYLeft`, `FlipInXDown`, `FlipInYRight`, `FlipInEasyX`, `FlipInEasyY`, `StretchInX`, `StretchInY`, `RotateInDownLeft`, `RotateInDownRight`, `RotateInUpLeft`, `RotateInUpRight`, `RollInLeft`, `RollInRight`, `PinwheelIn`, `LightSpeedInLeft`, `LightSpeedInRight`.
  - Exiting presets: the matching `...Out...` names — e.g. `FadeOut`, `SlideOutLeft`, `ZoomOut`, `BounceOut`, `FlipOutXUp`, `StretchOutX`, `RotateOutDownLeft`, `RollOutLeft`, `PinwheelOut`, `LightSpeedOutLeft`, etc.
- `layout`: `{ preset, duration?, spring? }`. Presets: `LinearTransition`, `FadingTransition`, `SequencedTransition`, `JumpingTransition`, `CurvedTransition`, `EntryExitTransition`.
- `effect` (continuous loop — **NOT** a reanimated builder name): `{ preset, duration?, delay?, easing?, loop?, minScale?, maxScale?, minOpacity?, degrees? }`. `preset` ∈ `"pulse" | "fade" | "rotate" | "shimmer" | "bounce"`. `minScale`/`maxScale` apply to `pulse`; `minOpacity` to `fade`; `degrees` to `rotate`.
- `easing`: `"linear" | "ease-in" | "ease-out" | "ease-in-out"`. `spring`: `{ damping?, stiffness?, mass? }` — mirrors reanimated `.springify(config)`; **`spring` wins over `easing`** when both are present.

Worked example (Image with static tilt, entrance/exit, and a continuous pulse):

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

## Variables

**There is no `payload.variables` map.** Variables live at runtime in the headless provider's variables store. They are populated by:

- This screen's `Input` / `RadioGroup` / `CheckboxGroup` / `DatePicker` / `WheelPicker` `variableName` prop
- Prior ComposableScreen steps' bound element captures
- `Button.actions` containing a `setVariable` action: `{ "type": "setVariable", "name": "counter", "value": "{{counter}} + 1", "valueMode": "expression" }`

Reference variables from `Text` ONLY when `Text.props.mode === "expression"`. Then `{{name}}` in `content` interpolates. Without `mode: "expression"`, `{{name}}` renders as literal text.

`disabledWhen` on `Button` reads variables natively — no expression mode flag needed.

## Naming conventions (match probe)

- Element `id`: generate a fresh UUID v4 (e.g. `crypto.randomUUID()`) for **every** UIElement — never reuse, never derive from content. Studio keys elements by UUID; human-readable ids collide on duplicate screens. (Examples below use readable ids for documentation only — real output must use UUIDs.) This is the element id inside `payload.elements`, distinct from the step `id`.
- Variables: match host vocabulary (`goal` over `q1`, `userName` over `name` if app uses camelCase fields).

## Minimal example

```json
{
  "type": "ComposableScreen",
  "payload": {
    "elements": [
      {
        "id": "safe",
        "type": "SafeAreaView",
        "props": { "flex": 1, "edges": ["top", "bottom"] },
        "children": [
          {
            "id": "stack",
            "type": "YStack",
            "props": { "flex": 1, "padding": 24, "gap": 16, "justifyContent": "center" },
            "children": [
              { "id": "title", "type": "Text", "props": { "content": "Hi {{name}}", "mode": "expression", "fontSize": 28, "fontWeight": "700" } },
              { "id": "name-input", "type": "Input", "props": { "variableName": "name", "placeholder": "Your name" } },
              { "id": "cta", "type": "Button", "props": { "label": "Continue", "actions": ["continue"] } }
            ]
          }
        ]
      }
    ]
  }
}
```

## Button actions

`actions: ButtonAction[]` (ordered, sequential). Each action is either the string `"continue"` or an object:

- `"continue"` — advance to next step. Terminal.
- `{ "type": "custom", "function": "name", "variables": ["a","b"] }` — emit to host. Host wires the implementation.
- `{ "type": "setVariable", "name": "counter", "value": "{{counter}} + 1", "valueMode": "expression" }` — write a variable. `valueMode: "expression"` triggers interpolation + numeric coercion based on the variable's runtime `kind`.

Note: the headless Zod schema currently only enumerates `"continue" | CustomButtonAction`. The UI mirror re-declares the schema and supports `setVariable`. If Studio validates strictly against headless, prefer `custom` actions for non-continue behavior — see `packages/onboarding/src/onboarding-example.ts` for the patterns that ship.

## Disabling continue conditionally

`Button.props.disabledWhen` accepts a `LeafCondition` or `ConditionGroup`:

```json
"disabledWhen": { "variable": "name", "operator": "is_empty" }
```

Group form:

```json
"disabledWhen": {
  "logic": "and",
  "conditions": [
    { "variable": "name", "operator": "is_not_empty" },
    { "variable": "age", "operator": "gte", "value": 18 }
  ]
}
```

(Note: `disabled` and `disabled-with-condition` are NOT prop names — only `disabledWhen`.)

### Condition operators

Binary operators (require `value`): `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`, `not_in`.

Unary operators (omit `value`): `is_empty`, `is_not_empty`, `is_null`, `is_not_null`. `empty` is type-aware — true for an empty/whitespace string, an empty array, or an unset/null variable; `null` is stricter — true only for unset/null (a set-but-empty value like `""` is **not null** yet **is empty**). Same operators apply to `renderWhen`.

## Per-state Button styling

`Button` accepts state-style overrides merged on top of base props:

- `pressedStyle` — applied while the button is held down.
- `disabledStyle` — applied while `disabledWhen` is truthy. Wins over the deprecated `disabledBackgroundColor` / `disabledColor` (kept only as fallback when `disabledStyle` is absent).
- `transitionDurationMs` — opacity animation duration between rest/pressed/disabled (default `150`).

Each override is a `Partial` of the overridable Button props: `BaseBoxProps` (incl. shadow), plus `variant`, `backgroundColor`, `color`, `fontSize`, `fontWeight`, `fontFamily`, `fontStyle`, `textAlign`. It does NOT nest `pressedStyle` / `disabledStyle`.

```json
{
  "type": "Button",
  "props": {
    "label": "Continue",
    "actions": ["continue"],
    "backgroundColor": "<DP.brand.primary>",
    "shadowColor": "#000", "shadowOffset": { "width": 0, "height": 4 },
    "shadowOpacity": 0.18, "shadowRadius": 8, "elevation": 4,
    "transitionDurationMs": 180,
    "pressedStyle": { "opacity": 0.7, "backgroundColor": "<DP.brand.primaryPressed>" },
    "disabledStyle": { "backgroundColor": "<DP.surface.raised>", "color": "<DP.text.muted>", "shadowOpacity": 0, "elevation": 0 }
  }
}
```

## Authoring workflow

1. Run app probe.
2. Pick archetype skeleton.
3. Replace tokens/copy with probe values.
4. Declare every variable referenced.
5. Add elements top-to-bottom, each with a fresh UUID v4 `id` (e.g. `crypto.randomUUID()`) — the element id inside `payload.elements`, distinct from the step `id`; never reuse or content-derive. Readable ids in this doc are illustrative only.
6. Put `{ "type": "YStack", "props": { "flex": 1 }, "children": [] }` spacer above CTA when CTA should pin to bottom. The empty `children: []` is required — Studio renderer crashes without it.
7. Validate via `validate-step-json`.

## Schema source of truth

- Union: `packages/onboarding/src/steps/ComposableScreen/types.ts`
- Per-element Zod: `packages/onboarding/src/steps/ComposableScreen/elements/*.ts`
- UI mirror to watch for drift: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/ButtonElement.tsx`

## Element prop canonical names (drift-prone — verify here)

| Element | Right | Wrong |
|---------|-------|-------|
| Payload | `payload.elements: UIElement[]` | `payload.root`, `payload.variables` |
| `Text` | `content` (string **or** span array), `mode: "expression"` for interp, `fontSize`/`fontWeight` | `text`, `variant` |
| `Image` | `url: string` (WebP/AVIF via `expo-image` if installed; `.svg` URLs auto-render via `react-native-svg`, `resizeMode`→`preserveAspectRatio`) | `source: { uri }`, `source: { localPathId }` |
| `Lottie` | `source: string` | `source: { localPathId }` |
| `Rive` | `url: string` | `source` |
| `RadioGroup` / `CheckboxGroup` | `items: [{label,value}]` | `options` |
| `WheelPicker` | exactly one of `items: [{label,value}]` or `range: {min,max,step?,unit?}` | both `items` + `range`, or neither |
| `Button` | `actions: [...]`, `disabledWhen` | `action`, `disabled` |
| `SafeAreaView` | `edges: ["top","bottom"]` or `{ top: "additive" }` | `{ top: "always" }` |
| `Input` | `textAlign`, `keyboardType`, `autoCapitalize`, `maxLength` | `suffix`, `autoFocus`, `alignment` |
| `ProgressIndicator` | `variant: "linear"\|"circular"`, `value` (0–100), `variableName`, `autoplay`, `duration`, `delay`, `easing` | `progress`, `percent`, `type` |
| Stacks / Carousel | `children` at element top-level | `children` inside `props` |

## Anti-patterns

- Don't write `payload.root` or `payload.variables` — they don't exist and crash Studio (`els is not iterable` when reading `payload.elements`).
- **Every container element (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `ScrollView`, `KeyboardAvoidingView`, `Carousel`, `RichText`) MUST have a `children` field. Use `"children": []` for empty containers (spacers, blank panels).** Studio renderer does `el.children.map(...)` unconditionally — missing `children` crashes with `Cannot read properties of undefined (reading 'map')`. The headless Zod schema also requires it (`children: z.array(UIElementSchema)`). `RichText` is the exception to "any child": its `children` are restricted to `Text` elements only — a non-`Text` child fails schema parse.
- Don't omit `id` on any element, and don't reuse or content-derive it — generate a fresh UUID v4 per element.
- Don't nest a `KeyboardAvoidingView` inside another `KeyboardAvoidingView` — the headless schema rejects it.
- Don't use `{{var}}` in `Text.content` without `mode: "expression"` — interpolation silently disabled otherwise.
- Don't use `Text.variant` — it doesn't exist. Set `fontSize` / `fontWeight` / `fontFamily` directly.
- **Inline rich text:** set `Text.content` to an array of spans — `[{ "text": "Lose " }, { "text": "5kg", "fontWeight": "700", "color": "#E11D48" }]`. Each span needs a `text` and may override `fontWeight`, `fontStyle`, `fontFamily`, `fontSize`, `letterSpacing`, `color`, `textDecorationLine` (`"underline" | "line-through" | "underline line-through" | "none"`); omitted props inherit from the parent `Text`. In `mode: "expression"`, `{{var}}` interpolates inside each span's `text`. Use this instead of an `XStack` of `Text` elements when fragments must wrap on one baseline.
- **RichText container vs inline spans:** use a `RichText` element (wrapping flex row of `Text` children) when segments need **box styling** (padded/rounded/rotated "chips" — `padding`, `borderRadius`, `borderWidth`, `backgroundColor`, `transform`) or per-segment `renderWhen` / `expression` — none of which inline `Text.content` spans support (spans are nested `<Text>`, text-style only). `RichText.props` are layout props (`gap`, `alignItems` incl. `"baseline"`, `justifyContent`, `flexWrap` default `"wrap"`) + `BaseBoxProps` + **inherited text-style defaults** (`fontSize`, `fontWeight`, `fontFamily`, `fontStyle`, `color`, `textAlign`, `letterSpacing`, `lineHeight`): declare the title's base typography once on the container; each child `Text` inherits it and only overrides per-chip (child wins). `textAlign` is both inherited by children **and** aligns the wrapping row itself — it maps to the row's `justifyContent` (`left`→`flex-start`, `center`→`center`, `right`→`flex-end`) when `justifyContent` isn't set explicitly. `children` are `Text`-only. **Plain-text children auto-split into one item per word** so text wraps word-by-word and chips flow inline with it — so **don't set `gap`** when mixing words + chips (spaces become real items → double-spacing); give the chip child `marginHorizontal` instead. A child is treated as an atomic "chip" (not split) when it has box styling (`backgroundColor`/`borderRadius`/`border`/`padding`) or motion. Reach for inline spans instead when you only need plain character-level styled runs on one baseline.
- Don't use `SafeAreaView` edge mode `"always"` — only `"off" | "additive" | "maximum"`.
- Don't nest `SafeAreaView` inside another `SafeAreaView`.
- Don't set fixed `height` on a container that should grow; use `flex: 1`.
- Don't put `Carousel` inside vertical-scrolling container without explicit `height`.
- Don't invent brand colors when probe data exists.
- Don't reach for hex when a theme token applies.
