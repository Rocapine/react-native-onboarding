---
name: compose-screen-builder
description: Builds the inner UIElement tree of a ComposableScreen step. Inspects the target app's design system before composing. Use when authoring a ComposableScreen, asks "compose a screen", "build the UIElement tree", "design the layout", or needs branching/variables in a single screen.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Compose Screen Builder

This plugin uses **ComposableScreen exclusively**. This skill is the deep reference for UIElement trees.

## Process

### 1. Inspect target app first

Run probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture:

- Brand colors (primary, surface, text)
- Font families (loaded via `expo-font`)
- Border radius + padding conventions
- Whether host uses Reanimated (motion-friendly)
- Existing custom components / icon sets

Inject probe output into every element. No generic hex. No invented font names.

### 2. Pick archetype

Start from an archetype in `../create-step-json/references/composable-archetypes.md`. Customize from there. Don't compose from scratch unless the screen is genuinely novel.

### 3. Compose the tree

## Element types

| Type | Purpose |
|------|---------|
| `YStack` / `XStack` | Vertical / horizontal flex container; has `children` |
| `ZStack` | Layered stack (overlay) |
| `SafeAreaView` | Safe-area wrapper with per-edge mode |
| `Text` | Text node (supports `{{variableName}}` interpolation) |
| `Image` | Image with `source: { uri }` or `{ localPathId }` |
| `Lottie` / `Rive` / `Video` | Animated media |
| `Icon` | Vector icon |
| `Input` | Text input bound to a variable |
| `Button` | Triggers a `ButtonAction` (continue, setVariable, custom) |
| `RadioGroup` / `CheckboxGroup` | Bound to a variable |
| `DatePicker` | Date input bound to a variable |
| `Carousel` | Inline horizontal pager |

Authoritative prop shapes: `packages/onboarding/src/steps/ComposableScreen/elements/*.ts`.

## BaseBoxProps (every element)

`width`, `height`, `flex`, `padding{Top,Right,Bottom,Left,Horizontal,Vertical}`, `margin*`, `gap`, `alignItems`, `justifyContent`, `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, `aspectRatio`, `background: GradientBackground`.

**Match probe values**: use the app's button `borderRadius` for buttons and large media, half of that for chips/tags, etc.

## Variables

**There is no `payload.variables` map.** Variables live at runtime in the headless provider's variables store. They are populated by:

- Prior steps' `variableName` (Picker, Question — legacy step types)
- This screen's `Input` / `RadioGroup` / `CheckboxGroup` / `DatePicker` `variableName` prop
- `Button.actions` containing a `setVariable` action: `{ "type": "setVariable", "name": "counter", "value": "{{counter}} + 1", "valueMode": "expression" }`

Reference variables from `Text` ONLY when `Text.props.mode === "expression"`. Then `{{name}}` in `content` interpolates. Without `mode: "expression"`, `{{name}}` renders as literal text.

`disabledWhen` on `Button` reads variables natively — no expression mode flag needed.

## Naming conventions (match probe)

- IDs: kebab-case unique within screen. If app uses camelCase elsewhere, switch to camelCase.
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
"disabledWhen": { "variable": "name", "operator": "eq", "value": "" }
```

Group form:

```json
"disabledWhen": {
  "logic": "and",
  "conditions": [
    { "variable": "name", "operator": "neq", "value": "" },
    { "variable": "age", "operator": "gte", "value": 18 }
  ]
}
```

(Note: `disabled` and `disabled-with-condition` are NOT prop names — only `disabledWhen`.)

## Authoring workflow

1. Run app probe.
2. Pick archetype skeleton.
3. Replace tokens/copy with probe values.
4. Declare every variable referenced.
5. Add elements top-to-bottom with kebab-case IDs.
6. Put `{ "type": "YStack", "props": { "flex": 1 } }` spacer above CTA when CTA should pin to bottom.
7. Validate via `validate-step-json`.

## Schema source of truth

- Union: `packages/onboarding/src/steps/ComposableScreen/types.ts`
- Per-element Zod: `packages/onboarding/src/steps/ComposableScreen/elements/*.ts`
- UI mirror to watch for drift: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/ButtonElement.tsx`

## Element prop canonical names (drift-prone — verify here)

| Element | Right | Wrong |
|---------|-------|-------|
| Payload | `payload.elements: UIElement[]` | `payload.root`, `payload.variables` |
| `Text` | `content`, `mode: "expression"` for interp, `fontSize`/`fontWeight` | `text`, `variant` |
| `Image` | `url: string` | `source: { uri }`, `source: { localPathId }` |
| `Lottie` | `source: string` | `source: { localPathId }` |
| `Rive` | `url: string` | `source` |
| `RadioGroup` / `CheckboxGroup` | `items: [{label,value}]` | `options` |
| `Button` | `actions: [...]`, `disabledWhen` | `action`, `disabled` |
| `SafeAreaView` | `edges: ["top","bottom"]` or `{ top: "additive" }` | `{ top: "always" }` |
| `Input` | `textAlign`, `keyboardType`, `autoCapitalize`, `maxLength` | `suffix`, `autoFocus`, `alignment` |
| Stacks / Carousel | `children` at element top-level | `children` inside `props` |

## Anti-patterns

- Don't write `payload.root` or `payload.variables` — they don't exist and crash Studio (`els is not iterable` when reading `payload.elements`).
- Don't omit `id` on any element.
- Don't use `{{var}}` in `Text.content` without `mode: "expression"` — interpolation silently disabled otherwise.
- Don't use `Text.variant` — it doesn't exist. Set `fontSize` / `fontWeight` / `fontFamily` directly.
- Don't use `SafeAreaView` edge mode `"always"` — only `"off" | "additive" | "maximum"`.
- Don't nest `SafeAreaView` inside another `SafeAreaView`.
- Don't set fixed `height` on a container that should grow; use `flex: 1`.
- Don't put `Carousel` inside vertical-scrolling container without explicit `height`.
- Don't invent brand colors when probe data exists.
- Don't reach for hex when a theme token applies.
