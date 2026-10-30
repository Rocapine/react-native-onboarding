---
name: create-step-json
description: Authors a new Rocapine Onboarding Studio step with a built-in step type (MediaContent, Question, Picker, Carousel, Loader, Ratings, Commitment, Paywall). Inspects the target app for design system, fonts, tokens, and copy voice before generating. Use when the user wants to add an onboarding screen, draft a step, or asks "give me JSON for an onboarding step". The ComposableScreen step type is deprecated; this skill only edits existing ComposableScreen steps, never authors new ones.
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: [screen purpose / step type]
---

# Create Step JSON

This skill authors steps with the **built-in step types**. The `ComposableScreen`
step type is **deprecated** (#353): existing ComposableScreen steps keep rendering,
but do not author new ones. To edit an existing one, see
[Editing an existing ComposableScreen step](#editing-an-existing-composablescreen-step).

## Process

### 1. Inspect target app first

Run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture:

- Brand color + surface tokens (from theme passed to `OnboardingProvider`)
- Loaded font families (from `expo-font` / `useFonts`)
- Copy voice + CTA verb style
- Variable naming convention (if existing onboarding present)
- The installed SDK version, so the payload matches its `dist/steps/<Type>/types.d.ts`

If no target app accessible, note ⚠ and use SDK defaults.

### 2. Map intent to a built-in step type

Full payload reference: `references/built-in-step-types.md`.

| Intent | Step type |
| --- | --- |
| Welcome / hook, value statement | `MediaContent` |
| Single-select question | `Question` (`multipleAnswer: false`) |
| Multi-select question | `Question` (`multipleAnswer: true`) |
| Name, height, weight, date | `Picker` (`pickerType`) |
| Social proof + rating prompt | `Ratings` (or `MediaContent.socialProof` for a single quote) |
| Loader / "building your plan" | `Loader` (`variant: "circle"` advances by itself; `"bars"` waits for a tap) |
| Commitment / signature | `Commitment` |
| Carousel intro | `Carousel` |
| Paywall inside the flow | `Paywall` (`payload.moment`) |
| Permission / integration ask, a message quoting prior answers, an age / gender picker | No built-in type. Tell the user; do not author a ComposableScreen step for it. |

### 3. Generate the step

Always set:

- `type` — the built-in type from step 2.
- `id` — the **step** id: kebab-case, matches target app convention (camelCase / kebab — match probe). Referenced by `nextStep` links, so keep it stable/readable.
- `name` — human-readable.
- `displayProgressHeader` — `true` ONLY for data-collection screens (`Question`, `Picker`); `false` for narrative/value screens (`MediaContent`, `Carousel`, `Ratings`, `Loader`, `Commitment`, `Paywall`). Rule of thumb: progress bar shows while the user is actively answering, hidden during storytelling.
- `customPayload: null`
- `continueButtonLabel` — pick verb from app's voice (probe). It is the CTA label on most built-in types; see `references/built-in-step-types.md` for the exceptions.
- `variableName` — on `Question` and `Picker`, matching the probe's naming style. The bundled renderers do not store it themselves; a branch on it needs the host to store the answer.
- `nextStep` — **always emit as an explicit multi-path link** when generating a flow of > 1 step. Default-link each step to the next via `{ defaultTargetStepId: "<next-step-id>", branches: [] }`. Only the terminal step (or a true single-step generation) gets `nextStep: null` **or** ends explicitly via the end sentinel `{ defaultTargetStepId: "__END__", branches: [] }` (see below). If a branching condition applies, add `branches: [{ condition, targetStepId }]` — first match wins, `defaultTargetStepId` is the fallback. **Do not rely on the null + array-order linear fallback for multi-step flows.** Explicit links survive reordering and make adding branches trivial. (`null` still resolves linearly at runtime — see `resolveNextStepNumber.test.ts` — but explicit multi-path is the convention.)
- `payload` — exactly the fields `references/built-in-step-types.md` lists for that type. Unknown keys are stripped silently, so a misspelled field does nothing.

### Auto-linking rule (when generating > 1 step)

Walk the flow in order. For each step `i` of an `N`-length flow:

```jsonc
// step 0..N-2
"nextStep": {
  "defaultTargetStepId": "<id of step i+1>",
  "branches": [ /* optional condition routes */ ]
}
// step N-1 (terminal) — either form ends the onboarding:
"nextStep": null                                                  // implicit last-step end
"nextStep": { "defaultTargetStepId": "__END__", "branches": [] }  // explicit end sentinel
```

Branch resolution: first matching `branches[].condition` wins; otherwise `defaultTargetStepId`. Every `targetStepId` (branch or default) MUST reference a real `id` present in the flow, **except** the reserved end sentinel `"__END__"` — a branch or the default target may be set to `"__END__"` to end the onboarding from any step (no trailing screen). It is deliberately not a real step id, so do not flag it as a dangling reference.

### 4. Apply the Design Profile

Built-in step types are styled by the UI SDK theme (see `customize-onboarding-theme`), not per step. Map the Design Profile into that theme; replace `Question` answer rows through `customComponents` (`customize-onboarding-components`) when the theme is not enough. In the step itself, the Design Profile drives copy: titles, answer labels, CTA verb from `voice.ctaVerbs[0]`.

If the Design Profile is empty (no app context), say so and use SDK defaults.

### 5. Validate

Offer to run `validate-step-json` skill on the output.

## Output

Single fenced JSON block, no prose unless explanation requested. Example: the
`Question` step at the end of `references/built-in-step-types.md`.

Followed by a 3-line summary:

```
Step type: Question
Copy voice: sentence case, "Continue" (from app probe)
Variable: goal (string)
```
## Anti-patterns

- Do NOT author a new `ComposableScreen` step. The step type is deprecated.
- Do NOT invent payload fields. Check the type's schema in the installed SDK.
- Do NOT skip the app probe — generic copy drifts from the host voice.
- Do NOT put long-form content in button labels — ≤ 30 chars.
- Do NOT use http:// media URLs.

## Editing an existing ComposableScreen step

Existing ComposableScreen steps still parse and render, so they can still be
edited. Keep the edit to the requested change, and suggest moving the screen to a
built-in type when one fits. The ComposableScreen payload is exactly
`{ "elements": UIElement[] }`; `references/composable-archetypes.md` and the
`compose-screen-builder` skill are the element reference. Every new UIElement
`id` is a fresh UUID v4. When editing one:

- Do NOT write `payload.root` or `payload.variables` — neither exists in the schema. Only `payload.elements: UIElement[]`. Writing `payload.root` causes Studio to crash with `"els is not iterable"`.
- Do NOT emit a container element (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `ScrollView`, `KeyboardAvoidingView`, `Carousel`, `RichText`, `Repeat`) without a `children` array. Empty container → `"children": []`. Missing `children` crashes Studio with `"Cannot read properties of undefined (reading 'map')"`.
- Do NOT nest a `KeyboardAvoidingView` beneath another one — rejected by a step-level schema check.
- Do NOT use these wrong prop names — they will cause silent renderer drift:
  - `Text.text` → use `Text.content`
  - `Text.variant` → use `fontSize` / `fontWeight` / `fontFamily` directly
  - `Image.source.uri` / `Image.source.localPathId` → use `Image.url` (string)
  - `RadioGroup.options` / `CheckboxGroup.options` → use `items` with `{label, value}`
  - `Button.action` → use `Button.actions: ["continue"]` (array) — `action` is deprecated singular
  - `Button.disabled` → use `Button.disabledWhen` (LeafCondition or ConditionGroup)
  - `SafeAreaView.edges: { top: "always" }` → use `["top","bottom"]` or `{ top: "additive" | "maximum" | "off" }`
  - `Lottie.source: { localPathId }` → use `Lottie.source: "https://…"` (string)
  - `Input.suffix` / `Input.alignment` → not in schema; use `textAlign`. (`Input.autoFocus` **is** in the schema since SDK 1.40.0 — a valid boolean that focuses on mount and opens the keyboard. Do not strip it.)
- Do NOT use `{{var}}` in `Text.content` without also setting `Text.props.mode: "expression"`. Without that flag, interpolation is silently disabled.
- Do NOT invent brand colors when app probe is available.
