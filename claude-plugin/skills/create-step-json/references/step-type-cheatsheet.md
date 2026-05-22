# Step Type Cheatsheet

All step types extend `BaseStepTypeSchema` (`id`, `name`, `displayProgressHeader`, `customPayload`, `continueButtonLabel`, `buttonSection?`, `figmaUrl?`, `nextStep`). Only the `type` literal + `payload` shape differ.

## Ratings

```json
{
  "type": "Ratings",
  "payload": {
    "title": "Rate us",
    "subtitle": "It helps a lot",
    "rateTheAppButtonLabel": "Rate the app",
    "socialProofs": [
      { "numberOfStar": 5, "content": "Changed my routine", "authorName": "Alex" }
    ]
  }
}
```

## MediaContent

```json
{
  "type": "MediaContent",
  "payload": {
    "title": "Track every meal",
    "description": "Logging takes seconds.",
    "mediaSource": { "type": "image", "url": "https://..." },
    "layoutStyle": "default",
    "socialProof": null
  }
}
```

`layoutStyle`: `default | media_top | media_bottom`.
`mediaSource.type`: `image | video | lottie | rive`.
Use `{ "type": "image", "localPathId": "..." }` for app-bundled assets.

## Picker

```json
{
  "type": "Picker",
  "variableName": "weight",
  "payload": {
    "title": "Your weight",
    "description": null,
    "pickerType": "weight"
  }
}
```

`pickerType`: `height | weight | age | date | gender | coach | name` (or custom string the host renders).
Requires `@react-native-picker/picker` peer dep in the consuming app.

## Commitment

```json
{
  "type": "Commitment",
  "payload": {
    "title": "I'm committing to my plan",
    "subtitle": null,
    "description": null,
    "variant": "signature",
    "signatureCaption": "Your signature is not recorded",
    "commitments": [
      { "text": "Show up for 21 days" },
      { "text": "Be kind to myself" }
    ]
  }
}
```

`variant`: `signature | simple`.

## Carousel

```json
{
  "type": "Carousel",
  "payload": {
    "screens": [
      { "mediaUrl": "https://...", "title": "Step 1", "subtitle": "Intro" },
      { "mediaUrl": "https://...", "title": "Step 2", "subtitle": null }
    ]
  }
}
```

Last page swaps continue button label automatically (UI SDK behavior).

## Loader

```json
{
  "type": "Loader",
  "payload": {
    "title": "Building your plan",
    "duration": 2000,
    "variant": "bars",
    "steps": [
      { "label": "Analyzing answers", "completed": "Done" },
      { "label": "Tuning macros", "completed": "Done" }
    ],
    "didYouKnowImages": null
  }
}
```

`variant`: `bars | circle | texts_fading`. `duration` is per-step ms.

## Question

```json
{
  "type": "Question",
  "variableName": "goal",
  "payload": {
    "title": "What's your goal?",
    "subtitle": null,
    "multipleAnswer": false,
    "answers": [
      { "label": "Lose weight", "value": "lose", "icon": "scale", "description": null },
      { "label": "Build muscle", "value": "muscle", "icon": "dumbbell", "description": null }
    ],
    "infoBox": null
  }
}
```

`multipleAnswer: true` → user selects multiple; `variableName` then captures an array.
`infoBox`: `{ "title": "...", "content": "..." }` shown below answers.

## ComposableScreen

Fully custom UIElement tree. Use the `compose-screen-builder` skill — payload shape:

```json
{
  "type": "ComposableScreen",
  "payload": {
    "variables": { "name": { "value": "", "kind": "string" } },
    "root": { "id": "root", "type": "YStack", "props": { /* BaseBoxProps */ }, "children": [ /* UIElements */ ] }
  }
}
```
