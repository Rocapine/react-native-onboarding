---
name: create-step-json
description: Authors a new Rocapine Onboarding Studio step using exclusively the ComposableScreen step type. Inspects the target app for design system, fonts, tokens, and copy voice before generating. Use when the user wants to add an onboarding screen, draft a step, or asks "give me JSON for an onboarding step".
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: [screen purpose / archetype]
---

# Create Step JSON (ComposableScreen-only)

This plugin authors **ComposableScreen** steps. Full design-system fidelity, one mental model, no hidden UI assumptions.

## Process

### 1. Inspect target app first

Run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture:

- Brand color + surface tokens (from theme passed to `OnboardingProvider`)
- Loaded font families (from `expo-font` / `useFonts`)
- Border radius / padding conventions (from existing buttons)
- Copy voice + CTA verb style
- Variable naming convention (if existing onboarding present)
- Whether motion (Reanimated) is in use

If no target app accessible, note ⚠ and use SDK defaults.

### 2. Map intent to ComposableScreen archetype

Pick from `references/composable-archetypes.md`:

| Intent | Archetype |
|--------|-----------|
| Welcome / hook | `hero` |
| Single-select question | `question-single` |
| Multi-select question | `question-multi` |
| User input (name, number, free text) | `input` |
| Numeric picker (age, weight, height) | `picker` |
| Reflection / personalized message | `reflection` |
| Social proof | `social-proof` |
| Loader / "building your plan" | `loader` (self-completing — chained `ProgressIndicator`s, no host timer) |
| Commitment / signature | `commitment` |
| Permission / integration ask (notifications, HealthKit, …) | `permission` |
| Carousel intro | `carousel` |

Each archetype is a ready ComposableScreen tree using only `BaseStepTypeSchema` + ComposableScreen UIElements. Customize tokens/copy from the app probe. After picking the archetype, consult `references/screen-patterns.md` for production-grade composition (select-and-advance questions, motion choreography, loaders, social-proof layering, permission branches).

### 3. Generate the step

Always set:

- `type: "ComposableScreen"`
- `id` — the **step** id: kebab-case, matches target app convention (camelCase / kebab — match probe). Referenced by `nextStep` links, so keep it stable/readable. (Distinct from **element** ids inside `payload.elements`, which must be UUID v4 — see `payload` below.)
- `name` — human-readable.
- `displayProgressHeader` — `true` ONLY for data-collection screens (`question-*`, `input`, `picker`); `false` for narrative/value screens (`hero`, `carousel`, `reflection`, `social-proof`, `permission`, `loader`, `commitment`). Rule of thumb: progress bar shows while the user is actively answering, hidden during storytelling and permission moments.
- `customPayload: null`
- `continueButtonLabel` — pick verb from app's voice (probe). Note: in ComposableScreen this is usually unused since the CTA is its own `Button` element inside `payload.elements`.
- `nextStep` — **always emit as an explicit multi-path link** when generating a flow of > 1 step. Default-link each step to the next via `{ defaultTargetStepId: "<next-step-id>", branches: [] }`. Only the terminal step (or a true single-step generation) gets `nextStep: null` **or** ends explicitly via the end sentinel `{ defaultTargetStepId: "__END__", branches: [] }` (see below). If a branching condition applies, add `branches: [{ condition, targetStepId }]` — first match wins, `defaultTargetStepId` is the fallback. **Do not rely on the null + array-order linear fallback for multi-step flows.** Explicit links survive reordering and make adding branches trivial. (`null` still resolves linearly at runtime — see `resolveNextStepNumber.test.ts` — but explicit multi-path is the convention.)
- `payload` — must be exactly `{ "elements": [ /* UIElement[] */ ] }`. Every UIElement's `id` must be a fresh UUID v4 (e.g. `crypto.randomUUID()`) — never reuse, never derive from content. Studio keys elements by UUID; the readable ids in the examples/archetypes below are illustrative only, real output uses UUIDs.

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

**Do NOT set `payload.root`. Do NOT set `payload.variables`. Those keys do not exist in the schema.** Variables flow at runtime from prior steps' `variableName` captures or from in-screen `Input` / `RadioGroup` / `CheckboxGroup` / `Button` `setVariable` actions — they are never declared in the payload.

### 4. Apply the Design Profile, no exceptions

The probe output is a structured **Design Profile** (see `../onboarding-best-practices/references/inspect-target-app.md`). Inject it into every UIElement:

- `Button.backgroundColor` ← `brand.primary`; `Button.color` ← `text.onBrand`; `Button.fontFamily` ← `fonts.heading`; `Button.borderRadius` ← `buttonBorderRadius`
- `Text.fontFamily` ← `fonts.heading` for titles, `fonts.body` for body; `fontSize` from `typeScale`
- `RadioGroup` / `CheckboxGroup` `item*` props — selected/unselected colors, border radius, font, padding all from Design Profile
- Container `backgroundColor`, `borderRadius`, `borderColor` — never invented hex, always sourced
- Spacing (`gap`, `padding*`) — snap to the app's spacing ladder
- CTA label — pull verb from `voice.ctaVerbs[0]`

If the Design Profile is empty (no app context), say so and use SDK defaults — but expect a regression vs. the host design system.

### 5. Hand off the UIElement tree

Inner tree composition is the `compose-screen-builder` skill's job. This skill produces the step wrapper + archetype skeleton; `compose-screen-builder` fills in nuanced layouts.

### 6. Validate

Offer to run `validate-step-json` skill on the output.

## Output

Single fenced JSON block, no prose unless explanation requested.

```json
{
  "id": "goal",
  "name": "Goal selection",
  "type": "ComposableScreen",
  "displayProgressHeader": true,
  "customPayload": null,
  "continueButtonLabel": "Continue",
  "nextStep": { "defaultTargetStepId": "experience", "branches": [] },
  "payload": {
    "elements": [
      {
        "id": "safe",
        "type": "SafeAreaView",
        "props": { "flex": 1, "edges": ["top", "bottom"] },
        "children": [
          {
            "id": "root",
            "type": "YStack",
            "props": { "flex": 1, "padding": 24, "gap": 24 },
            "children": [/* ... */]
          }
        ]
      }
    ]
  }
}
```

Followed by a 3-line summary:

```
Archetype: question-single
Tokens applied: brand=#27ae60, font=Geist-Bold (from app probe)
Variable: goal (string)
```

## Anti-patterns

- Do NOT write `payload.root` or `payload.variables` — neither exists in the schema. Only `payload.elements: UIElement[]`. Writing `payload.root` causes Studio to crash with `"els is not iterable"`.
- Do NOT emit a container element (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `Carousel`) without a `children` array. Empty container → `"children": []`. Missing `children` crashes Studio with `"Cannot read properties of undefined (reading 'map')"`.
- Do NOT use these wrong prop names — they will cause silent renderer drift:
  - `Text.text` → use `Text.content`
  - `Text.variant` → use `fontSize` / `fontWeight` / `fontFamily` directly
  - `Image.source.uri` / `Image.source.localPathId` → use `Image.url` (string)
  - `RadioGroup.options` / `CheckboxGroup.options` → use `items` with `{label, value}`
  - `Button.action` → use `Button.actions: ["continue"]` (array) — `action` is deprecated singular
  - `Button.disabled` → use `Button.disabledWhen` (LeafCondition or ConditionGroup)
  - `SafeAreaView.edges: { top: "always" }` → use `["top","bottom"]` or `{ top: "additive" | "maximum" | "off" }`
  - `Lottie.source: { localPathId }` → use `Lottie.source: "https://…"` (string)
  - `Input.suffix` / `Input.autoFocus` / `Input.alignment` → not in schema; use `textAlign`
- Do NOT use `{{var}}` in `Text.content` without also setting `Text.props.mode: "expression"`. Without that flag, interpolation is silently disabled.
- Do NOT invent brand colors when app probe is available.
- Do NOT skip the app probe — generic output drifts from host design system.
- Do NOT put long-form content in button labels — ≤ 30 chars.
- Do NOT use http:// media URLs.
