# Built-in step types

The step types to author new onboarding steps with. `ComposableScreen` is
deprecated as a step type (#353): existing ComposableScreen steps keep rendering,
but do not author new ones. Paywalls still use UIElement trees; that is not a
step type and is not deprecated.

Source of truth: `@rocapine/react-native-onboarding/dist/steps/<Type>/types.d.ts`
in the target app (`packages/onboarding/src/steps/<Type>/types.ts` in the SDK
repo). This file summarises those schemas; when it and the installed `.d.ts`
disagree, the `.d.ts` wins.

## Fields every step has (`BaseStepTypeSchema`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable, readable. `"__END__"` is reserved and rejected. |
| `name` | string | Human-readable. |
| `type` | literal | One of the types below. |
| `displayProgressHeader` | boolean | `true` while the user is answering, `false` on narrative screens. |
| `customPayload` | object \| null | `null` unless the host reads it. |
| `continueButtonLabel` | string, optional | Defaults to `"Continue"`. The CTA label (unless `buttonSection.label` is set) on `MediaContent`, `Picker`, `Commitment`, `Loader` (`bars`), multi-select `Question`, the last page of `Carousel`, and `Ratings` once the review prompt has opened. See "What the bundled renderers show" for the exceptions. |
| `buttonSection` | `{ label?, icon? }`, optional | Overrides the CTA label and adds an icon. |
| `figmaUrl` | string, optional | |
| `nextStep` | `{ defaultTargetStepId, branches: [{ condition, targetStepId }] }` \| null | See the auto-linking rule in `../SKILL.md`. |

`MediaSource` (used below) is `{ type: "image" | "video" | "lottie" | "rive", url }`
or `{ type: …, localPathId }`.
`SocialProof` is `{ numberOfStar: number, content: string, authorName: string }`.

## Per-type payloads

What each schema accepts. A field the schema accepts is not necessarily rendered; check the next section before relying on one.

| Type | Use for | `payload` | Step-level extras |
| --- | --- | --- | --- |
| `MediaContent` | Welcome / hook, value statement | `mediaSource: MediaSource`, `title`, `description?`, `socialProof?: SocialProof`, `layoutStyle?: "default" \| "media_top" \| "media_bottom"` | |
| `Question` | Single- or multi-select question | `title`, `subtitle?`, `answers: [{ label, value, icon?, description? }]`, `multipleAnswer: boolean`, `infoBox?: { title, content }` | `variableName?` |
| `Picker` | Height, weight, date or name input | `title`, `description?`, `pickerType` | `variableName?` |
| `Carousel` | Multi-slide intro | `screens: [{ mediaUrl, title, subtitle? }]`, `pagination?: { show?, dotColor?, activeDotColor?, dotWidth?, dotHeight?, activeDotWidth?, activeDotHeight?, gap?, position?: "top" \| "bottom", marginTop?, marginBottom? }` | |
| `Loader` | "Building your plan" wait | `title`, `steps: [{ label, completed }]`, `didYouKnowImages?: MediaSource[]`, `duration?` (ms, default 2000), `variant?: "bars" \| "circle" \| "texts_fading"` | |
| `Ratings` | Social proof + store rating prompt | `title`, `subtitle`, `socialProofs: SocialProof[]`, `rateTheAppButtonLabel?` | |
| `Commitment` | Commitment / signature | `title`, `subtitle?`, `description?`, `commitments?: [{ text }]`, `signatureCaption?`, `variant?: "signature" \| "simple"` | |
| `Paywall` | A paywall in flow position | `moment: string` — the key of a moment configured in the project; its audience waterfall picks the paywall | |

## What the bundled renderers show

Read from `@rocapine/react-native-onboarding-ui`'s `UI/Pages/<Type>/Renderer.tsx`. When an installed version disagrees, the installed renderer wins.

- **`MediaContent`** — only `{ type: "image", url }` renders as media. `localPathId`, `lottie`, `rive` and `video` render a grey placeholder with a text label. `socialProof` is not rendered. CTA: `continueButtonLabel`.
- **`Question`** — single-select advances on tap and shows no CTA. Multi-select shows the CTA once an answer is selected. `answers[].icon`, `answers[].description` and `infoBox` are not rendered; the default answer row shows `label` only.
- **`Picker`** — renders `"height"`, `"weight"`, `"date"` and `"name"`. The schema also accepts `"age"`, `"gender"`, `"coach"` and any string, but those render a "not yet implemented" placeholder. CTA: `continueButtonLabel`.
- **`Carousel`** — `mediaUrl` renders as an image. A URL containing `.riv` or `.json` renders a grey "Rive Animation" / "Lottie Animation" placeholder. The CTA reads a hardcoded `"Next"` on every page but the last, which shows `continueButtonLabel`.
- **`Loader`** — `variant: "circle"` advances **by itself** when its progress ring completes, after roughly `duration * (steps.length + 0.5)` ms; it shows no CTA and ignores `continueButtonLabel`. `"bars"` (the default) animates its rows one after another — each row runs `duration` ms after a delay of `index * duration / 2` — then fades in a `continueButtonLabel` CTA and waits for a tap. `"texts_fading"` has no renderer of its own and renders as `"bars"`. `didYouKnowImages` shows only `{ type: "image", url }` entries.
- **`Ratings`** — the first tap opens the store review prompt (requires `expo-store-review`) with `rateTheAppButtonLabel` as the label; the button then switches to `continueButtonLabel`, and the next tap advances.
- **`Commitment`** — with `variant: "signature"` (the default) the CTA stays disabled until the user signs. CTA: `continueButtonLabel`.
- **`Paywall`** — no CTA of its own; only a purchase advances.

`variableName` (on `Question` and `Picker`) is a schema field naming the answer: the bundled renderers pass the answer to `onContinue` and do not write it to the variables store themselves, so a `nextStep` branch on it only works if the host stores the answer under that name.

Text fields are rendered literally on every built-in type: there is no `{{variable}}` interpolation, so a screen that quotes a prior answer has no built-in type.

## Styling

Built-in types are styled by the UI SDK theme (see `customize-onboarding-theme`), not by
per-element props. Put the Design Profile there (`customize-onboarding-theme`);
`Question` answer rows can also be replaced through `customComponents`
(`customize-onboarding-components`).

## Not covered by a built-in type

A permission ask (notifications, HealthKit, ...), a message built from prior
answers, an `age`, `gender` or `coach` picker, and Lottie / Rive / video media
have no built-in step type that renders them. Say
so to the user and let them choose how to handle it in the host app; do not fall
back to a new ComposableScreen step.

## Example

```json
{
  "id": "goal",
  "name": "Goal selection",
  "type": "Question",
  "displayProgressHeader": true,
  "customPayload": null,
  "continueButtonLabel": "Continue",
  "variableName": "goal",
  "nextStep": { "defaultTargetStepId": "experience", "branches": [] },
  "payload": {
    "title": "What is your main goal?",
    "subtitle": null,
    "multipleAnswer": false,
    "answers": [
      { "label": "Lose weight", "value": "lose_weight" },
      { "label": "Build muscle", "value": "build_muscle" },
      { "label": "Stay healthy", "value": "stay_healthy" }
    ]
  }
}
```
