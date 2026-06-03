---
name: onboarding-best-practices
description: Provides conversion-optimized onboarding patterns for Rocapine ComposableScreen-only flows. Includes the target-app inspection protocol. Use when the user asks "how should I design this onboarding", "what's the best order", "how to improve conversion", or any open-ended onboarding strategy question.
---

# Onboarding Best Practices

Knowledge for designing high-converting Rocapine onboarding flows. Every screen is a ComposableScreen tree.

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

1. **Hook** (1 screen, archetype `hero`) — single benefit promise. `displayProgressHeader: false`.
2. **Question funnel** (3–7 screens, archetypes `question-single` / `question-multi` / `input` / `picker`) — gather personalization. Progress bar ON.
3. **Reflection** (1–2 screens, archetype `reflection`) — mirror answers back. Drives investment.
4. **Social proof** (1 screen, archetype `social-proof`) — validate the choice.
5. **Loader** (1 screen, archetype `loader`) — perceived value via deliberate wait. 2–4s.
6. **Commitment** (1 screen, archetype `commitment`) — verbal lock-in.
7. **Paywall handoff** — exit onboarding to host paywall.

Permission/integration asks (`permission` archetype) slot in after the question funnel, once value is established — and a granted integration should *shorten* the funnel (branch past manual-entry screens it makes redundant).

Total: 8–12 screens. > 15 = measurable drop-off.

Composition recipes (motion choreography, select-and-advance, loaders, social-proof layering): `../create-step-json/references/screen-patterns.md`.

## displayProgressHeader rule

Progress bar ON only while the user is actively answering — `question-*`, `input`, `picker` screens. OFF for narrative/value moments: `hero`, `carousel`, `reflection`, `social-proof`, `permission`, `loader`, `commitment`. The bar signals "almost done with questions"; on storytelling screens it only adds friction.

## Per-archetype heuristics

### question-single
- 3–5 options. 6+ = paralysis (7 acceptable for attribution screens).
- Labels ≤ 30 chars. Action-oriented ("Lose weight" not "Weight loss").
- **Default to select-and-advance**: Button rows with `[{setVariable}, "continue"]` + `pressedStyle` previewing the selected state — one less tap per screen. Use `RadioGroup` (+ explicit Continue) only when the user should review the pick before advancing; then always declare `variableName`.

### question-multi
- Use only when answers are non-exclusive (e.g. obstacles, dietary restrictions).
- `minSelected: 1` to enforce engagement.

### input
- `autoFocus: true` on first input field.
- Disable Continue until non-empty.
- For free-text reflection, cap at 80 chars.

### picker
- Always set `variableName` and `kind: "int"` or `"float"` for numeric inputs.
- Show unit suffix ("kg", "cm", "years").

### hero
- One claim per screen. Title = promise, subtitle = proof.
- Use brand image / Lottie from app probe.
- CTA verb from app voice ("Get started", "Let's go", "Begin").

### reflection
- Reference at least one prior variable via `{{varName}}`.
- Keep brief — 1 heading + 1 body sentence.

### social-proof
- Place AFTER user has seen value, not as cold ask.
- One quote, one name. Multiple = noise.
- Compose in layers, not a flat list: laurels + gold stars + user-count claim, ONE floating testimonial card (big soft shadow), a payoff line, then the rate CTA. Stat-anchored variant: one big accent-colored number ("82%") inside gray supporting copy.

### loader
- **Self-completing**: chain `ProgressIndicator`s via `delay` (bar *i* starts when *i−1* ends), flip each row's label to a check-row via `renderWhen` at 100, gate the CTA on the last bar. No host timer needed.
- ~5s per bar, 2–3 bars. A horizontal "Did you know?" card rail makes the wait feel like value.
- Use the host-wired `delayedContinue` custom action only when gating on real backend work.

### permission (notifications, HealthKit, …)
- Ask late — after the question funnel, with value established. Never a bare OS dialog: designed screen with logo, benefit rows (icon-in-circle + title/body), and a privacy reassurance line ("Your data is encrypted and private" + shield icon).
- Always offer a ghost-button opt-out ("Later", "Add data manually") — never trap.
- CTA fires a host `custom` action (`requestNotifications`, `connectAppleHealth`).
- **Branch on the grant**: if the integration populates variables later screens collect manually, add `is_not_null` branches that skip those screens. Granted permission = shorter funnel.

### commitment
- 2–3 commitment items, present tense, "I will" phrasing.
- Use `CheckboxGroup` to force physical action.

### carousel
- 3–5 slides max. More than 5 = swipe fatigue.
- Show progress dots.

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
- Branch `condition` is a `LeafCondition` (`{ variable, operator, value }`) or `ConditionGroup` (`{ logic: "and" | "or", conditions: [...] }`). Binary operators (need `value`): `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`, `not_in`. Unary operators (omit `value`): `is_empty`, `is_not_empty`, `is_null`, `is_not_null` — prefer these over `{ operator: "neq", value: "" }` for presence checks (`empty` is type-aware over string/array/null; `null` is unset-only).
- Variables referenced in conditions MUST be captured upstream (`Input` / `RadioGroup` / `CheckboxGroup` / `DatePicker` / `WheelPicker` `variableName`, or a `setVariable` action).
- Every `targetStepId` (branch + default) MUST exist in the flow.

## Branching

- Branch on highest-cardinality variable first (gender, goal).
- Default flow = most common path; branches handle long tail.
- Branch depth ≤ 2. Deeper = unmaintainable.

## Variables

- Match app variable naming (probe). `goal` vs `userGoal` vs `q_goal`.
- Tag `kind: "int" | "float"` for numerics.
- Reuse variables across reflection + branching — don't ask twice.

## Copy

- Title < 50 chars, sentence case.
- Subtitle one sentence. Cut filler.
- CTA verb-first, never "Next". Mirror app voice (probe).
- Avoid "Welcome to...", "Let's begin..." — burn screen on substance.

## Accessibility

- `RadioGroup` / `CheckboxGroup` labels must be the visible text — screen reader reads them.
- Contrast: `text.primary` on `surface.*` must hit WCAG AA. Default tokens pass; custom themes must verify.
- Don't use color alone for selection — use border + color (default `RadioGroup` does this).

## Performance

- `Image.url` is the only valid prop (no `source.localPathId`). For above-fold media use fast CDN URLs; prefer WebP/SVG (decoded via `expo-image` / `react-native-svg`).
- `Lottie` with remote source: preload or show blank.
- `Carousel` of 4+ images: lazy-load via SDK's built-in mechanism.

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
- Asking for permissions *prematurely* — before value is delivered, or via a bare OS dialog instead of a designed `permission` screen.
- Generic brand colors when app probe data is available.
- Inventing font names not loaded by `expo-font`.
- Long-form copy that won't translate (if multi-locale).
- Writing `payload.root` or `payload.variables` — those keys do not exist in the ComposableScreen schema. Correct shape: `payload: { "elements": UIElement[] }`. Wrong shape crashes Studio with `els is not iterable`.
- Emitting a container element (`YStack`, `XStack`, `ZStack`, `SafeAreaView`, `Carousel`) without a `children` array. Empty container → `"children": []`. Missing `children` crashes Studio with `Cannot read properties of undefined (reading 'map')`.
