---
name: onboarding-best-practices
description: Provides conversion-optimized onboarding design patterns for Rocapine flows. Use when the user asks "how should I design this onboarding", "what's the best order", "how to improve conversion", "review my onboarding flow", or any open-ended onboarding strategy question.
---

# Onboarding Best Practices

Knowledge for designing high-converting Rocapine onboarding flows. Pull from this when reviewing or proposing flow structure.

## Flow shape

A strong consumer-app onboarding follows this rough arc:

1. **Hook** (1 screen) — `MediaContent` with a single benefit promise. No skip. No progress bar.
2. **Question funnel** (3–7 `Question` steps) — gather inputs that personalize the rest. Progress bar ON.
3. **Reflection** (1–2 `MediaContent` or `ComposableScreen`) — mirror answers back ("You said X — here's what that means"). Drives investment.
4. **Social proof** (1 `Ratings` or `MediaContent` with `socialProof`) — validate the choice.
5. **Loader / "building your plan"** (1 `Loader`) — perceived value via deliberate wait. 2–4s.
6. **Commitment** (1 `Commitment`) — make user verbalize intent. Hard psychological lock-in.
7. **Paywall handoff** — exit onboarding to the host paywall screen.

Total: 8–12 screens. More than 15 → measurable drop-off.

## Per-step heuristics

### Question
- Single-select ≫ multi-select for personalization (forces a clean variable).
- Answers: 3–5 options. 6+ = analysis paralysis.
- Labels: ≤ 30 chars. Action-oriented ("Lose weight" not "Weight loss").
- Always set `variableName` — unused questions waste a screen.
- Use `infoBox` sparingly — only when the question is non-obvious.

### MediaContent
- One claim per screen. Title = promise, description = proof.
- `layoutStyle: "media_top"` for hero shots; `"media_bottom"` for charts.
- Use `socialProof` on the last `MediaContent` before paywall, not earlier.

### Picker
- Always set `variableName`. Pickers without variable capture are just friction.
- For weight/height, the SDK handles unit toggle — don't reinvent.

### Loader
- 2000ms per step × 2–3 steps total. Faster feels fake; slower feels broken.
- `variant: "bars"` for measurable progress; `"texts_fading"` for tips/edutainment.
- `didYouKnowImages` boost perceived value but only if the content matters.

### Commitment
- `variant: "signature"` outperforms `simple` in studies — physical action = ownership.
- Keep `commitments` list to 2–3 items, present tense, "I will" phrasing.

### Ratings
- Place AFTER the user has seen value, not as a cold ask.
- 3 social proofs with diverse names. Real reviews if possible.

### ComposableScreen
- Use when no typed step fits — but ask first: "could this be a Question or MediaContent?" Custom = more drift risk.
- Always set safe area edges explicitly.

## Branching

- Branch on the highest-cardinality variable first (gender, goal). Don't branch every question.
- Default flow should be the most common path; branches handle the long tail.
- Keep branch depth ≤ 2. Deeper trees are unmaintainable in the CMS.

## Variables

- Name them like product variables: `goal`, `gender`, `weight`, `experience`. Not `q1`, `answer_2`.
- Tag `kind: "int"` for numeric values you'll do math on (calorie targets, etc.).
- Reuse variables across steps — don't ask the same thing twice.

## Copy

- Title: < 50 chars, sentence case.
- Subtitle/description: one sentence. Cut filler.
- CTA: verb-first ("Get started", "Continue", "Build my plan"). Don't say "Next".
- Avoid "Are you sure?", "Welcome to...", "Let's begin..." — burn a screen on substance.

## Accessibility

- Question answer labels readable by screen reader — keep them as the visible text, not just icons.
- Color contrast: `text.primary` on `surface.*` must hit WCAG AA. The default tokens do; custom themes must verify.
- Don't use color alone to signal selection — default `QuestionAnswerButton` adds a border too.

## Performance

- `mediaSource.localPathId` ≫ `url` for above-the-fold content. Bundle the hero image.
- `Loader` with `didYouKnowImages` from URL: preload via `Image.prefetch` or the user sees blanks.
- `Carousel` of 4+ images: lazy-load.

## A/B test ideas

- Hook copy variants
- Question order (high-info-gain first vs. easiest first)
- Loader duration
- Commitment screen presence/absence
- Number of questions (5 vs 7 vs 9)

## Anti-patterns

- "Email capture" mid-onboarding before value is delivered. Always after.
- Push notification prompt before user has any reason to want them.
- Skip buttons on any non-info screen — they kill funnel.
- Onboarding longer than 15 screens.
- Asking for permissions inside onboarding instead of after.
