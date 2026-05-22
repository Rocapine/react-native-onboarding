---
name: create-step-json
description: Authors a new Rocapine Onboarding Studio step JSON payload. Use when the user wants to add an onboarding screen, create a step, draft a Ratings/MediaContent/Picker/Commitment/Carousel/Loader/Question/ComposableScreen step, or asks "give me JSON for an onboarding step".
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: [step-type] [brief description]
---

# Create Step JSON

Author a valid step JSON payload for Rocapine Onboarding Studio. Output must round-trip through the headless SDK Zod schemas without errors.

## When invoked

1. Identify the step `type` requested. Supported values: `Ratings`, `MediaContent`, `Picker`, `Commitment`, `Carousel`, `Loader`, `Question`, `ComposableScreen`.
2. If ambiguous, ask the user once; otherwise pick the closest fit.
3. Read the source-of-truth Zod schema for that type before writing JSON:
   - Schemas: `packages/onboarding/src/steps/<Type>/types.ts`
   - Shared base: `packages/onboarding/src/steps/common.types.ts`
4. Draft JSON matching the schema exactly. Always include `BaseStepTypeSchema` fields:
   - `id` (kebab-case, unique within flow)
   - `name` (human-readable)
   - `displayProgressHeader` (boolean)
   - `customPayload` (null unless host needs it)
   - `continueButtonLabel` (default "Continue")
   - `nextStep` (null for linear flow, else `{ defaultTargetStepId, branches }`)
5. Use `references/step-type-cheatsheet.md` for per-type payload shapes.
6. For `ComposableScreen`, hand off to the `compose-screen-builder` skill — its UIElement tree is too detailed for inline authoring.
7. Validate mentally against schema. Then offer to run `validate-step-json` skill on the output.

## Output format

Return a fenced JSON block. No prose around it unless the user asked for explanation.

```json
{
  "id": "welcome",
  "name": "Welcome",
  "type": "MediaContent",
  "displayProgressHeader": false,
  "customPayload": null,
  "continueButtonLabel": "Get started",
  "nextStep": null,
  "payload": { "...": "..." }
}
```

## Branching

When user asks for conditional next-step routing, build `nextStep`:

```json
"nextStep": {
  "defaultTargetStepId": "step-b",
  "branches": [
    {
      "targetStepId": "step-c",
      "condition": { "variable": "gender", "operator": "eq", "value": "female" }
    }
  ]
}
```

Operators: `eq | neq | gt | lt | gte | lte | contains | in | not_in`.
Group with `{ logic: "and" | "or", conditions: [...] }` for nesting.

## Variables

`Picker` and `Question` steps may set `variableName` to capture user input into the flow variables map. Reference these variables in later branching conditions or in `ComposableScreen` `{{varName}}` interpolation.

## Anti-patterns

- Don't invent fields — only what's in the Zod schema validates.
- Don't omit `displayProgressHeader` — it controls the auto-injected progress bar.
- Don't put long-form content in `Question` answer labels — keep ≤ 30 chars.
- Don't use http:// media URLs — always https.
