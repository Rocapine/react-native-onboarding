---
name: validate-step-json
description: Validates a Rocapine ComposableScreen step JSON against the headless SDK Zod schemas. Use when the user pastes step JSON and asks "is this valid", "check this onboarding step", "validate this payload", or after creating step JSON.
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: [path-to-json-file or inline JSON]
---

# Validate Step JSON

This plugin emits ComposableScreen only. This skill validates against `ComposableScreenStepTypeSchema`.

## When invoked

1. Locate the step JSON: inline, file path, or clipboard. If unclear, ask.
2. Confirm `type === "ComposableScreen"`. If not, reject:
   ```
   ✗ type
     Expected "ComposableScreen" — this plugin uses ComposableScreen exclusively.
     Fix: regenerate via create-step-json skill.
   ```
3. Run real Zod validation:

```ts
// scripts/_validate-composable.ts
import { ComposableScreenStepTypeSchema } from "@rocapine/react-native-onboarding";

const input = JSON.parse(process.argv[2]);
const result = ComposableScreenStepTypeSchema.safeParse(input);
if (result.success) console.log("OK");
else { console.error(JSON.stringify(result.error.format(), null, 2)); process.exit(1); }
```

Run: `npx tsx scripts/_validate-composable.ts "$(cat step.json)"`

4. If `tsx` unavailable, fall back to structural check:
   - `BaseStepTypeSchema` fields present (`id`, `name`, `displayProgressHeader`, `customPayload`, `nextStep`)
   - `payload` is exactly `{ "elements": UIElement[] }` — no `root`, no `variables` keys
   - Every UIElement has `id` (string), `type` (string literal), `props` (object).
   - Every container UIElement (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `Carousel`) has `children: UIElement[]` at element top-level — required, must exist even if empty (`"children": []`). Non-container types must NOT have `children`.
   - All `id`s unique within `payload.elements` tree
   - `Text.props.content` exists; if `{{var}}` interpolation, `Text.props.mode === "expression"`
   - `Image.props.url` is a string (NOT `source.uri` / `source.localPathId`)
   - `Lottie.props.source` is a string; `Rive.props.url` is a string
   - `RadioGroup.props.items` / `CheckboxGroup.props.items` is `[{label, value}]` (NOT `options`)
   - `WheelPicker.props` provides exactly one of `items: [{label, value}]` (unique values) or `range: {min, max, step?, unit?}` — both or neither is a schema error; `defaultValue` (if present) must match an available item value
   - `ProgressIndicator.props.variant` (if present) is `"linear"|"circular"`; `easing` (if present) is `"linear"|"ease-in"|"ease-out"|"ease-in-out"`; `value`/`initialValue` are 0–100; `duration`/`delay`/`thickness`/`size` are non-negative numbers; `autoplay`/`loop`/`showLabel` are booleans. Not a container — must NOT have `children`
   - `Button.props.actions` is an array; entries are `"continue"` or `{type:"custom",function,variables?}` or `{type:"setVariable",name,value,valueMode?}` (note: setVariable may not be in headless schema yet — check)
   - `Button.props.disabledWhen` (NOT `disabled`) is a valid `LeafCondition` or `ConditionGroup`
   - `Button.props.pressedStyle` / `disabledStyle` (if present) are objects — `Partial` of overridable Button props; must NOT nest `pressedStyle`/`disabledStyle`. `transitionDurationMs` is a non-negative number.
   - Shadow fields (any element): `shadowColor` string; `shadowOffset` is `{width, height}` (NOT a number); `shadowOpacity` 0–1; `shadowRadius`/`elevation` non-negative numbers
   - `SafeAreaView.props.edges` is an array of `"top"|"right"|"bottom"|"left"` OR an object with edge mode `"off"|"additive"|"maximum"` — NEVER `"always"`
   - **Flow-level chain integrity (when input is an array of steps)**:
     - Every non-terminal step has `nextStep: { defaultTargetStepId, branches }`. Terminal step has `nextStep: null`. Flag steps that rely on `null` linear fallback in the middle of a flow as a warning ("implicit linear link — prefer explicit defaultTargetStepId").
     - `nextStep.defaultTargetStepId` is a string and references a real step `id` in the flow.
     - Every `branches[].targetStepId` is a string and references a real step `id` in the flow.
     - Every `branches[].condition` is `null` (unconditional catch-all) OR a valid `LeafCondition` / `ConditionGroup`.
     - Every variable referenced in a `branches[].condition` is captured upstream (by an Input / RadioGroup / CheckboxGroup / DatePicker / WheelPicker `variableName` or a `setVariable` action) — warn if not.
     - For multi-step flows, every step except the terminal one must define an explicit `defaultTargetStepId` (auto-link convention).
5. Report ALL errors at once with path + reason. Don't stop on first.

## Common failure modes

- `payload.root` set instead of `payload.elements` — **causes Studio crash "els is not iterable"**.
- `payload.variables` set — this key doesn't exist in schema; remove it.
- Container element (`YStack` / `XStack` / `ZStack` / `SafeAreaView` / `Carousel`) without `children` — **causes Studio crash "Cannot read properties of undefined (reading 'map')"**. Empty container must emit `"children": []`.
- `displayProgressHeader` missing — required boolean.
- UIElement missing `id`.
- `Text.props.text` used instead of `Text.props.content` (no `text` field exists).
- `Text.props.variant` used (no such field; use `fontSize` / `fontWeight`).
- `{{var}}` in `Text.content` without `Text.props.mode === "expression"` — silently doesn't interpolate.
- `Image.props.source` used instead of `Image.props.url`.
- `RadioGroup.props.options` instead of `items` (also `CheckboxGroup`).
- `WheelPicker.props` with both `items` and `range`, or neither — exactly one is required. Also: non-unique `items` values, or a `defaultValue` that matches no available value.
- `ProgressIndicator.props.variant` set to anything other than `"linear"|"circular"`, or `easing` outside `"linear"|"ease-in"|"ease-out"|"ease-in-out"`. Also: `value`/`initialValue` outside 0–100, or `children` present (not a container).
- `Button.props.action` (singular) used instead of `actions: [...]` (array).
- `Button.props.disabled` instead of `disabledWhen`.
- `shadowOffset` given as a number instead of `{ width, height }`.
- `pressedStyle` / `disabledStyle` nesting another `pressedStyle`/`disabledStyle` (stripped — not overridable).
- `SafeAreaView.props.edges: { top: "always" }` — invalid edge mode. Use `["top","bottom"]` or `"off" | "additive" | "maximum"`.
- `Lottie.source: { localPathId }` instead of string URL.
- `RadioGroup` / `CheckboxGroup` / `Input` / `DatePicker` / `WheelPicker` without `variableName` — element renders but variable never captured.
- Nested `SafeAreaView`.
- `nextStep.defaultTargetStepId` referencing nonexistent step ID.
- `nextStep: null` on a non-terminal step in a multi-step flow (relies on implicit array-order linking; prefer explicit `defaultTargetStepId`).
- `branches[].targetStepId` referencing nonexistent step ID.
- `branches[].condition` referencing a variable never captured upstream.
- Branch with non-null condition that lists an unknown `operator` (binary, require `value`: `eq|neq|gt|lt|gte|lte|contains|in|not_in`; unary, omit `value`: `is_empty|is_not_empty|is_null|is_not_null`). A binary operator missing `value` is a schema error; a unary operator ignores any `value`.
- `customPayload: {}` instead of `null` (both validate; prefer `null`).
- `Carousel` with empty `children`.

## Output

```
✗ payload.root.children[1].id
  Required (got undefined)
  Fix: add unique kebab-case id.

✗ payload.variables
  Variable "goal" referenced in payload.root.children[0].children[2].props.text but not declared.
  Fix: add "goal": { "value": "", "kind": "string" } to payload.variables.
```

End with `valid: true|false` and a one-line summary.
