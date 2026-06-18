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
   - Every container UIElement (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `Carousel`, `RichText`) has `children: UIElement[]` at element top-level — required, must exist even if empty (`"children": []`). Non-container types must NOT have `children`. `RichText.children` are restricted to `Text` elements only — any non-`Text` child fails parse.
   - All `id`s unique within `payload.elements` tree
   - `Text.props.content` exists — a string, or an array of spans `[{text, fontWeight?, fontStyle?, fontFamily?, fontSize?, letterSpacing?, color?, textDecorationLine?}]` (each span requires `text`; `textDecorationLine` ∈ `none|underline|line-through|underline line-through`). If `{{var}}` interpolation, `Text.props.mode === "expression"`
   - `Image.props.url` is a string (NOT `source.uri` / `source.localPathId`). A `.svg` URL is valid and auto-renders via `react-native-svg`; WebP/AVIF decode via `expo-image` when installed — no schema change, don't flag these. Optional `blurRadius` (non-negative number) applies a uniform blur — valid, don't flag
   - `ProgressiveBlurImage.props` requires `url` (string), `intensity` (0–100), and `mask`. The `mask` is a union: **linear** `{from, to, stops}` (optional `type:"linear"`; `from`/`to` are edges) **or** **radial** `{type:"radial", center?:{x,y} 0–1, radius?>0, stops}`. Both need ≥2 stops `{position 0–1, opacity 0–1}`. Optional `tint` ∈ `"light"|"dark"|"default"`, `maxBlurOpacity` 0–1, `blurAppear` `{delay?≥0, duration?≥0, easing? ∈ "linear"|"ease-in"|"ease-out"|"ease-in-out"}` (fades the blur layer in). Not a container — must NOT have `children`. Mask `opacity` is blur strength (not a color); a color `mask` is a schema error. A radial mask without `from`/`to` is valid — don't flag it
   - `Lottie.props.source` is a string; `Rive.props.url` is a string
   - `RadioGroup.props.items` / `CheckboxGroup.props.items` is `[{label, value}]` (NOT `options`)
   - `WheelPicker.props` provides exactly one of `items: [{label, value}]` (unique values) or `range: {min, max, step?, unit?}` — both or neither is a schema error; `defaultValue` (if present) must match an available item value
   - `DrawingPad.props` — all props optional: `variableName` / `imageVariableName` (strings; the SVG and base64-image targets), `strokeColor`/`backgroundColor` (strings), `strokeWidth` (if present, `> 0`), `clearable` (boolean), `imageFormat` (if present, `"png"|"jpeg"`); clear-button styling — `clearButtonPosition` (if present, `"top-left"|"top-right"|"bottom-left"|"bottom-right"`), `clearButtonOffset` (`≥ 0`), `clearButtonSize` (`> 0`), `clearButtonColor`/`clearButtonIconColor` (strings), `clearButtonLabel` (string). Needs the `@shopify/react-native-skia` peer dep — mandatory for this element. Not a container — must NOT have `children`
   - `Slider.props` (continuous numeric input bound to a variable, stored as a float string): `defaultValue` (number; defaults to `min`, else 0), `min` (number, default 0), `max` (number, default 1), `step` (number; 0 = continuous, default 0) are numbers; `minimumTrackTintColor`/`maximumTrackTintColor`/`thumbTintColor` are strings; `disabled` is a boolean. Needs the optional `@react-native-community/slider` peer dep at runtime (degrades to an empty box without it)
   - `ProgressIndicator.props.variant` (if present) is `"linear"|"circular"`; `easing` (if present) is `"linear"|"ease-in"|"ease-out"|"ease-in-out"`; `value`/`initialValue`/`minValue`/`maxValue` are numbers (NO fixed range — runtime-clamped to `[minValue, maxValue]`, default 0–100; so a count-up to N uses `minValue:0, maxValue:N`); `step` (if present) is `> 0`; `labelSuffix` is a string (default `"%"`); `duration`/`delay`/`thickness`/`size` are non-negative numbers; `autoplay`/`loop`/`showLabel` are booleans. Not a container — must NOT have `children`
   - `AnimatedText.props.to` is REQUIRED (number); `from` (default 0), `duration`/`delay` (non-negative), `easing` (`"linear"|"ease-in"|"ease-out"|"ease-in-out"`), `autoplay`/`loop` (booleans), `decimals` (integer `≥ 0`), `thousandsSeparator` (string, default `","`) + text styling. It renders the number only and never writes a variable — `variableName` is NOT a prop. Not a container — must NOT have `children`
   - `Button.props.actions` is an array; entries are `"continue"` or `{type:"custom",function,variables?}` or `{type:"setVariable",name,value,valueMode?,kind?,arrayOp?}` (`valueMode` ∈ `"literal"|"expression"`; `kind` ∈ `"int"|"float"|"string"`; `arrayOp` ∈ `"append"|"remove"|"toggle"` — multi-select set op on a JSON-encoded `string[]` (CheckboxGroup) variable, `kind` ignored when present — all three action shapes are the `ButtonAction` union in the headless schema, `common.types.ts`, re-exported from `ButtonElement.ts`)
   - `props.onPress` (any element — it's a `BaseBoxProps` field) is a `ButtonAction[]` with the same entry shapes as `Button.props.actions`. Schema-valid on every element; runtime ignores it on the elements that own their own gesture (`Button` — use `actions`; `RadioGroup`, `CheckboxGroup`, `DatePicker`, `Input`, `WheelPicker`, `DrawingPad`, `Slider`) — warn if seen there, error only on a malformed action entry
   - `Button.props.disabledWhen` (NOT `disabled`) is a valid `LeafCondition` or `ConditionGroup`
   - **Gating sanity (warning, not schema error)**: a `disabledWhen` / `renderWhen` condition should reference a variable captured on the SAME screen (this screen's `variableName` elements or `setVariable` actions) or a deliberate upstream capture. A CTA gated on a variable this screen never touches is almost always a copy-paste bug (seen in production: picker CTAs gated on a stale `goals` variable from an earlier screen) — flag it.
   - `Button.props.pressedStyle` / `disabledStyle` (if present) are objects — `Partial` of overridable Button props; must NOT nest `pressedStyle`/`disabledStyle`. `transitionDurationMs` is a non-negative number.
   - `haptic` on `Button` / `RadioGroup` / `CheckboxGroup` (if present) is one of `"none"|"light"|"medium"|"heavy"|"soft"|"rigid"` — any other value is a schema error. Optional + opt-in; needs the optional `expo-haptics` peer dep at runtime (no-op without it)
   - Shadow fields (any element): `shadowColor` string; `shadowOffset` is `{width, height}` (NOT a number); `shadowOpacity` 0–1; `shadowRadius`/`elevation` non-negative numbers
   - `transform` (any element, optional): object with any of `translateX`/`translateY`/`scale`/`scaleX`/`scaleY`/`rotate` — all numbers (`rotate` in degrees). No other keys.
   - `animation` (any element, optional): object `{ entering?, exiting?, layout?, effect? }`.
     - `entering`/`exiting`: `{ preset, duration?, delay?, easing?, spring? }`. `preset` is a string (exact reanimated builder name — entering: `FadeIn`/`FadeInUp`/`FadeInDown`/`FadeInLeft`/`FadeInRight`/`SlideInUp`/`SlideInDown`/`SlideInLeft`/`SlideInRight`/`ZoomIn`/`ZoomInRotate`/`ZoomInUp`/`ZoomInDown`/`ZoomInLeft`/`ZoomInRight`/`ZoomInEasyUp`/`ZoomInEasyDown`/`BounceIn`/`BounceInUp`/`BounceInDown`/`BounceInLeft`/`BounceInRight`/`FlipInXUp`/`FlipInYLeft`/`FlipInXDown`/`FlipInYRight`/`FlipInEasyX`/`FlipInEasyY`/`StretchInX`/`StretchInY`/`RotateInDownLeft`/`RotateInDownRight`/`RotateInUpLeft`/`RotateInUpRight`/`RollInLeft`/`RollInRight`/`PinwheelIn`/`LightSpeedInLeft`/`LightSpeedInRight`; exiting: matching `...Out...` names e.g. `FadeOut`/`SlideOutLeft`/`ZoomOut`/`BounceOut`/`FlipOutXUp`/`StretchOutX`/`RotateOutDownLeft`/`RollOutLeft`/`PinwheelOut`/`LightSpeedOutLeft`). Unknown presets degrade to no-op (not an error).
     - `layout`: `{ preset, duration?, spring? }`. `preset` ∈ `LinearTransition`/`FadingTransition`/`SequencedTransition`/`JumpingTransition`/`CurvedTransition`/`EntryExitTransition`.
     - `effect` (continuous loop, NOT a builder name): `{ preset, duration?, delay?, easing?, loop?, minScale?, maxScale?, minOpacity?, degrees? }`. `preset` ∈ `"pulse"|"fade"|"rotate"|"shimmer"|"bounce"`.
     - `easing` (where present) ∈ `"linear"|"ease-in"|"ease-out"|"ease-in-out"`; `spring` is `{ damping?, stiffness?, mass? }` (numbers); `duration`/`delay` non-negative numbers. `spring` wins over `easing` when both present.
   - `SafeAreaView.props.edges` is an array of `"top"|"right"|"bottom"|"left"` OR an object with edge mode `"off"|"additive"|"maximum"` — NEVER `"always"`
   - **Flow-level chain integrity (when input is an array of steps)**:
     - Every non-terminal step has `nextStep: { defaultTargetStepId, branches }`. Terminal step has `nextStep: null`. Flag steps that rely on `null` linear fallback in the middle of a flow as a warning ("implicit linear link — prefer explicit defaultTargetStepId").
     - `nextStep.defaultTargetStepId` is a string and references a real step `id` in the flow.
     - Every `branches[].targetStepId` is a string and references a real step `id` in the flow.
     - Every `branches[].condition` is `null` (unconditional catch-all) OR a valid `LeafCondition` / `ConditionGroup`.
     - Every variable referenced in a `branches[].condition` is captured upstream (by an Input / RadioGroup / CheckboxGroup / DatePicker / WheelPicker / Slider / DrawingPad `variableName` (or DrawingPad's `imageVariableName`) or a `setVariable` action) — warn if not.
     - For multi-step flows, every step except the terminal one must define an explicit `defaultTargetStepId` (auto-link convention).
5. Report ALL errors at once with path + reason. Don't stop on first.

## Common failure modes

- `payload.root` set instead of `payload.elements` — **causes Studio crash "els is not iterable"**.
- `payload.variables` set — this key doesn't exist in schema; remove it.
- Container element (`YStack` / `XStack` / `ZStack` / `SafeAreaView` / `Carousel` / `RichText`) without `children` — **causes Studio crash "Cannot read properties of undefined (reading 'map')"**. Empty container must emit `"children": []`.
- `RichText` with a non-`Text` child (e.g. an `Image` or `XStack`) — its `children` are `Text`-only; anything else fails schema parse (`invalid_union`).
- `displayProgressHeader` missing — required boolean.
- UIElement missing `id`.
- `Text.props.text` used instead of `Text.props.content` (no `text` field exists).
- `Text.props.variant` used (no such field; use `fontSize` / `fontWeight`).
- `{{var}}` in `Text.content` without `Text.props.mode === "expression"` — silently doesn't interpolate.
- `Image.props.source` used instead of `Image.props.url`.
- `RadioGroup.props.options` instead of `items` (also `CheckboxGroup`).
- `WheelPicker.props` with both `items` and `range`, or neither — exactly one is required. Also: non-unique `items` values, or a `defaultValue` that matches no available value.
- `ProgressIndicator.props.variant` set to anything other than `"linear"|"circular"`, or `easing` outside `"linear"|"ease-in"|"ease-out"|"ease-in-out"`. Also: `step` ≤ 0, or `children` present (not a container). NOTE: `value`/`initialValue` are no longer capped at 100 — they clamp to `[minValue, maxValue]` at runtime, so an out-of-range value is not a schema error.
- `AnimatedText.props` missing the required `to`, a non-integer/negative `decimals`, or a `variableName` (not a prop — AnimatedText never writes a variable; use a sibling `Text` `mode:"expression"` if downstream needs the value).
- `Button.props.action` (singular) used instead of `actions: [...]` (array).
- `Button.props.disabled` instead of `disabledWhen`.
- `shadowOffset` given as a number instead of `{ width, height }`.
- `transform.rotate` given as a string (e.g. `"-4deg"`) instead of a number (degrees).
- `animation.effect.preset` set to a reanimated builder name (e.g. `FadeIn`) — `effect` presets are only `"pulse"|"fade"|"rotate"|"shimmer"|"bounce"`; builder names belong under `entering`/`exiting`/`layout`. (Unknown presets are not a hard error — they degrade to no-op — but flag as a likely mistake.)
- `animation.easing` outside `"linear"|"ease-in"|"ease-out"|"ease-in-out"`.
- `pressedStyle` / `disabledStyle` nesting another `pressedStyle`/`disabledStyle` (stripped — not overridable).
- `SafeAreaView.props.edges: { top: "always" }` — invalid edge mode. Use `["top","bottom"]` or `"off" | "additive" | "maximum"`.
- `Lottie.source: { localPathId }` instead of string URL.
- `RadioGroup` / `CheckboxGroup` / `Input` / `DatePicker` / `WheelPicker` / `Slider` without `variableName` — element renders but variable never captured.
- `DrawingPad` with neither `variableName` nor `imageVariableName` — pad renders but the drawing is never captured. Also: `strokeWidth` ≤ 0, `imageFormat` outside `"png"|"jpeg"`, or `children` present (not a container).
- Nested `SafeAreaView`.
- `nextStep.defaultTargetStepId` referencing nonexistent step ID.
- `nextStep: null` on a non-terminal step in a multi-step flow (relies on implicit array-order linking; prefer explicit `defaultTargetStepId`).
- `branches[].targetStepId` referencing nonexistent step ID.
- `branches[].condition` referencing a variable never captured upstream.
- `disabledWhen` / `renderWhen` gating a CTA on a variable the screen never captures — likely a copy-paste leftover from a duplicated screen; the button silently stays enabled/disabled based on stale state. Warn with the variable name + the screen's actual captured variables.
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
