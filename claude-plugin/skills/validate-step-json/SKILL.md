---
name: validate-step-json
description: Validates a Rocapine Onboarding Studio step JSON payload against the headless SDK Zod schemas. Use when the user pastes step JSON and asks "is this valid", "check this onboarding step", "validate this payload", or after creating step JSON.
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: [path-to-json-file or inline JSON]
---

# Validate Step JSON

Run real Zod validation against the headless SDK schemas. Don't eyeball.

## When invoked

1. Locate the step JSON: inline in user message, file path, or clipboard. If unclear, ask.
2. Identify the `type` field — pick the matching schema:
   - `Ratings` → `RatingsStepTypeSchema`
   - `MediaContent` → `MediaContentStepTypeSchema`
   - `Picker` → `PickerStepTypeSchema`
   - `Commitment` → `CommitmentStepTypeSchema`
   - `Carousel` → `CarouselStepTypeSchema`
   - `Loader` → `LoaderStepTypeSchema`
   - `Question` → `QuestionStepTypeSchema`
   - `ComposableScreen` → `ComposableScreenStepTypeSchema`
3. Write a temporary validation script and run it:

```ts
// scripts/_validate-step.ts
import { RatingsStepTypeSchema /* ...others */ } from "@rocapine/react-native-onboarding";

const schemas: Record<string, any> = {
  Ratings: RatingsStepTypeSchema,
  // ...
};

const input = JSON.parse(process.argv[2]);
const schema = schemas[input.type];
if (!schema) { console.error(`Unknown type: ${input.type}`); process.exit(1); }
const result = schema.safeParse(input);
if (result.success) { console.log("OK"); }
else { console.error(JSON.stringify(result.error.format(), null, 2)); process.exit(1); }
```

Run: `npx tsx scripts/_validate-step.ts "$(cat step.json)"`

4. If `tsx` not available, fall back to manual structural check using `references/schema-checklist.md`.
5. Report ALL errors at once with path + reason. Don't stop on first.
6. For each error, suggest a fix referencing the schema field.

## Common failure modes

- `displayProgressHeader` missing — required boolean on every step.
- `MediaContent.mediaSource` missing `type` discriminator.
- `Question.answers[].value` duplicated — must be unique for variable capture.
- `Loader.steps` empty — schema allows but UI breaks; warn.
- `Carousel.screens` < 2 — defeats the purpose; warn.
- `nextStep.branches[].condition` malformed — must be leaf `{variable,operator,value}` or group `{logic,conditions}`.
- `customPayload` set to `{}` instead of `null` — both validate, prefer `null`.
- Variable references like `{{name}}` in text fields without matching `variableName` upstream.

## Output

```
✗ payload.title
  Required (got undefined)
  Fix: add "title": "..." inside payload.

✗ payload.answers[2].value
  Duplicate value "yes" (also in payload.answers[0])
  Fix: change to unique slug.
```

End with `valid: true|false` and a one-line summary.
