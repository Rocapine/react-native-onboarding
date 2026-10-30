---
name: onboarding-best-practices
description: Provides conversion-optimized onboarding patterns for Rocapine flows — flow arc, screen ordering, per-step-type heuristics — plus the target-app inspection protocol every authoring skill depends on. Use when the user asks "how should I design this onboarding", "what's the best order", "how many screens", "how to improve conversion", or any open-ended onboarding strategy question.
allowed-tools: Read, Glob, Grep
---

# Onboarding Best Practices

Knowledge for designing high-converting Rocapine onboarding flows. New screens use the built-in step types (`MediaContent`, `Question`, `Picker`, `Carousel`, `Loader`, `Ratings`, `Commitment`, `Paywall`); the heuristics below are written per step type. The `ComposableScreen` step type is deprecated (#353): its element-level advice lives under [Existing ComposableScreen steps and paywalls](#existing-composablescreen-steps-and-paywalls), for editing an existing step or composing a paywall.

## Always inspect target app first

Before generating ANY screen or flow, run the probe from `references/inspect-target-app.md`. Without app context, output drifts from the host design system.

Probe captures:

- Theme tokens (brand color, surface, text)
- Loaded font families
- Border radius / padding conventions from existing buttons
- Copy voice + CTA verb style
- Variable naming convention from existing onboarding (if any)
- Motion library availability (Reanimated)
- Component library (Tamagui / NativeWind / custom design system)
- Locale strategy

## Flow shape

Strong consumer-app onboarding arc:

1. **Hook** (1 screen, `MediaContent`) — single benefit promise. `displayProgressHeader: false`.
2. **Question funnel** (3–7 screens, `Question` / `Picker`) — gather personalization. Progress bar ON.
3. **Value statement** (1–2 screens, `MediaContent`) — restate what the user gets. Built-in types render text literally, so a screen that quotes prior answers back has no built-in type; tell the user rather than faking it.
4. **Social proof** (1 screen, `Ratings`) — validate the choice.
5. **Loader** (1 screen, `Loader`) — perceived value via deliberate wait. 2–4s.
6. **Commitment** (1 screen, `Commitment`) — verbal lock-in.
7. **Paywall** — a `Paywall` step in flow position, or exit onboarding to a host paywall.

Permission/integration asks have no built-in step type. Recommend handling them in the host after the question funnel, once value is established.

- Avoid "Welcome to...", "Let's begin..." — burn screen on substance.

## displayProgressHeader rule

Progress bar ON only while the user is actively answering — `Question` and `Picker` steps. OFF for narrative/value moments: `MediaContent`, `Carousel`, `Ratings`, `Loader`, `Commitment`, `Paywall`. The bar signals "almost done with questions"; on storytelling screens it only adds friction.

## Per-step heuristics

What each bundled renderer actually shows is in `../create-step-json/references/built-in-step-types.md` — check it before relying on a field.

### Question
- 3–5 answers. 6+ = paralysis (7 acceptable for attribution screens).
- Labels ≤ 30 chars. Action-oriented ("Lose weight" not "Weight loss"). The default answer row shows `label` only.
- Single-select (`multipleAnswer: false`) advances on tap — one less tap per screen. Use it by default.
- Multi-select (`multipleAnswer: true`) only when answers are non-exclusive (obstacles, dietary restrictions). Its CTA appears once one answer is picked, so at least one is always required.

### Picker
- `pickerType` `"height"`, `"weight"`, `"date"` or `"name"` — the only values the bundled renderer implements.
- Put the unit or format in `description` when the title alone is ambiguous.

### MediaContent (hook / value statement)
- One claim per screen. `title` = promise, `description` = proof.
- Use a hosted brand image from the app probe (`{ type: "image", url }`) — other media types render a placeholder.
- CTA verb from app voice ("Get started", "Let's go", "Begin") in `continueButtonLabel`.

### Ratings
- Place AFTER user has seen value, not as cold ask.
- Lead with one strong quote; `socialProofs[0]` is the one displayed, the rest only feed the user count.
- The first tap opens the store review prompt; the second advances.

### Loader
- `variant: "circle"` advances by itself; use it for a pure wait. `"bars"` shows each row's `label`, switching to its `completed` text when that bar fills, then waits for a tap.
- 2–3 rows. `didYouKnowImages` makes the wait feel like value.
- When the wait must cover real backend work, the host has to gate it; no built-in type waits on a host call.

### Commitment
- 2–3 commitment items, present tense, "I will" phrasing.
- `variant: "signature"` forces a physical action: the CTA stays disabled until the user signs.

### Carousel
- 3–5 slides max. More than 5 = swipe fatigue.
- Keep `pagination.show` on.

## Step linking (auto-link via multi-path)

Every step in a multi-step flow uses the explicit multi-path link form:

```jsonc
"nextStep": {
  "defaultTargetStepId": "<next step id>",
  "branches": []          // empty when linear; populated when conditional routing applies
}
```

- **Linear by default**: each step's `defaultTargetStepId` points at the next step's `id`. Terminal step is the only `nextStep: null`.
- **Branching where needed**: when routing depends on a captured variable, add `branches: [{ condition, targetStepId }]`. First matching branch wins; `defaultTargetStepId` is the catch-all.
- **Why explicit, not `null` linear fallback**: `nextStep: null` resolves to "next in array" at runtime (`resolveNextStepNumber.test.ts`) but that couples flow order to array index — reordering silently re-routes the flow. Explicit links survive reordering and make branching trivial to layer in.
- Branch `condition` is a `LeafCondition` (`{ variable, operator, value }`) or `ConditionGroup` (`{ logic: "and" | "or", conditions: [...] }`). Binary operators (need `value`): `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`, `not_in`. Unary operators (omit `value`): `is_empty`, `is_not_empty`, `is_null`, `is_not_null` — prefer these over `{ operator: "neq", value: "" }` for presence checks (`empty` is type-aware over string/array/null; `null` is unset-only). `in` / `not_in` take a list: an authored array, or a `{{ref}}` to a multi-select variable (bare or array-wrapped — both flatten to the same members, compared stringified).
- Variables referenced in conditions MUST be stored upstream. A `Question` / `Picker` `variableName` names the answer, but the bundled renderers pass it to `onContinue` without storing it, so a branch on it needs the host to store the answer under that name. Say so when you emit one.
- Every `targetStepId` (branch + default) MUST exist in the flow.

## Branching

- Branch on highest-cardinality variable first (gender, goal).
- Default flow = most common path; branches handle long tail.
- Branch depth ≤ 2. Deeper = unmaintainable.

## Variables

- Match app variable naming (probe). `goal` vs `userGoal` vs `q_goal`.
- Reuse captured answers across branching — don't ask twice.

## Copy

- Title < 50 chars, sentence case.
- Subtitle one sentence. Cut filler.
- CTA verb-first, never "Next". Mirror app voice (probe).
- Avoid "Welcome to...", "Let's begin..." — burn screen on substance.

## Accessibility

- `Question` answer labels must be the visible text — screen reader reads them.
- Contrast: `text.primary` on `surface.*` must hit WCAG AA. Default tokens pass; custom themes must verify.

## Performance

- Media: hosted `https://` image URLs on a fast CDN. `localPathId` renders a placeholder on the built-in types.
- `Carousel` of 4+ images: keep each image small; every slide's image is mounted up front.

## A/B test surface

- Hook copy variants
- Question order (high-info-gain first vs. easiest first)
- Loader duration
- Commitment screen presence
- Question count (5 vs 7 vs 9)

## Anti-patterns

- Email capture mid-onboarding before value delivered. Always after.
- Push notification prompt before user has any reason to want them.
- "Skip" button on any non-info screen — kills funnel. (Quiet ghost-button opt-outs on permission screens — "Later" — are fine and expected.)
- Onboarding > 15 screens.
- Asking for permissions *prematurely* — before value is delivered.
- Authoring a new `ComposableScreen` step. The step type is deprecated.
- Generic brand colors when app probe data is available.
- Inventing font names not loaded by `expo-font`.
- Long-form copy that won't translate (if multi-locale).
## Existing ComposableScreen steps and paywalls

These apply to element trees only: editing an existing ComposableScreen step, or composing a paywall's `elements`. Do not use them to author a new step.

- Select-and-advance questions: Button rows with `[{setVariable}, "continue"]` + `pressedStyle`; `RadioGroup` (+ explicit Continue, with `variableName`) when the user should review the pick. `CheckboxGroup` with `minSelected: 1` for multi-select.
- Inputs: `autoFocus: true` on the first field; disable Continue until non-empty. Numeric captures: `variableName` with `kind: "int"` or `"float"`.
- Reflection: reference a prior variable via `{{varName}}` in a `Text` with `mode: "expression"`.
- Self-completing loaders: chain `ProgressIndicator`s via `delay`, flip each row to a check-row via `renderWhen` at 100, gate the CTA on the last bar.
- Recipes: `../create-step-json/references/screen-patterns.md` and `../create-step-json/references/composable-archetypes.md`.
- Accessibility: `RadioGroup` / `CheckboxGroup` labels are the visible text; don't use color alone for selection. `Image.url` is the only image prop (no `source.localPathId`).
- Writing `payload.root` or `payload.variables` — those keys do not exist in the ComposableScreen schema. Correct shape: `payload: { "elements": UIElement[] }`. Wrong shape crashes Studio with `els is not iterable`.
- Emitting a container element (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `ScrollView`, `KeyboardAvoidingView`, `Carousel`, `RichText`, `Repeat`) without a `children` array. Empty container → `"children": []`. Missing `children` crashes Studio with `Cannot read properties of undefined (reading 'map')`.
