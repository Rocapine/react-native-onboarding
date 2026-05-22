---
name: compose-screen-builder
description: Builds a Rocapine ComposableScreen UIElement tree. Use when the user wants a fully custom onboarding screen, asks "compose a screen", "build a ComposableScreen JSON", "make a layout with text + button + image", or needs branching/variables in a single screen.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Compose Screen Builder

`ComposableScreen` is the escape hatch for screens not covered by the typed step variants. It renders a tree of `UIElement` nodes with `BaseBoxProps` for layout.

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

Read exact prop shapes from `packages/onboarding/src/steps/ComposableScreen/elements/*.ts`.

## BaseBoxProps (every element)

`width`, `height`, `flex`, `padding{Top,Right,Bottom,Left,Horizontal,Vertical}`, `margin*`, `gap`, `alignItems`, `justifyContent`, `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, `aspectRatio`, `background: GradientBackground`.

## Variables

`payload.variables` is a map: `{ [name]: { value: string, label?: string, kind?: "int" | "float" | "string" } }`.

Reference in any `Text` via `{{name}}`. Update via `Button` with `setVariable` action or via bound `Input` / `RadioGroup` / `CheckboxGroup`.

## Minimal example

```json
{
  "type": "ComposableScreen",
  "payload": {
    "variables": {
      "name": { "value": "", "kind": "string" }
    },
    "root": {
      "id": "root",
      "type": "SafeAreaView",
      "props": { "flex": 1, "edges": { "top": "always", "bottom": "always" } },
      "children": [
        {
          "id": "stack",
          "type": "YStack",
          "props": { "flex": 1, "padding": 24, "gap": 16, "justifyContent": "center" },
          "children": [
            { "id": "title", "type": "Text", "props": { "text": "Hi {{name}}", "variant": "heading1" } },
            { "id": "name-input", "type": "Input", "props": { "variableName": "name", "placeholder": "Your name" } },
            {
              "id": "cta",
              "type": "Button",
              "props": {
                "label": "Continue",
                "action": { "type": "continue" }
              }
            }
          ]
        }
      ]
    }
  }
}
```

## Button actions

- `{ "type": "continue" }` — advance to next step
- `{ "type": "setVariable", "variableName": "...", "value": "..." }` — write a variable then advance
- `{ "type": "custom", "name": "...", "payload": {...} }` — emit to host

For expression-style `setVariable` (math/concat), use string with placeholders:
`{ "type": "setVariable", "variableName": "counter", "value": "{{counter}} + 1" }`
The `kind: "int"` tag drives numeric coercion.

## Disabling continue conditionally

`Button.props.disabled` accepts a boolean OR a condition referencing variables:

```json
"disabled": { "variable": "name", "operator": "eq", "value": "" }
```

## Authoring workflow

1. Sketch the layout in plain language (heading, image, list, CTA).
2. Pick root container (`SafeAreaView` → `YStack` is the common pattern).
3. Declare all variables you'll reference.
4. Add elements top-to-bottom with explicit `id`s (kebab-case, unique within screen).
5. Set `flex: 1` on the root and one spacer child to push CTA down (`{ "type": "YStack", "props": { "flex": 1 } }`).
6. Always validate via `validate-step-json` after writing.

## Schema source of truth

`packages/onboarding/src/steps/ComposableScreen/types.ts` — the `UIElement` discriminated union lives here (not in `elements/`) to avoid circular deps.

`packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/ButtonElement.tsx` — re-declares its own Zod schema in lockstep. Watch for drift if updating Button props.

## Anti-patterns

- Don't omit `id` on any element — diff/animation depends on stable IDs.
- Don't reference an undeclared variable — `{{foo}}` renders empty silently.
- Don't nest `SafeAreaView` inside another `SafeAreaView`.
- Don't set fixed `height` on container that should grow; use `flex: 1`.
- Don't put `Carousel` inside a vertical-scrolling container without explicit height.
