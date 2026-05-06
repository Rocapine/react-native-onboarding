---
paths:
  - "packages/onboarding-ui/src/UI/Pages/**"
---

# Page Renderers

## Renderer rules

- Wrap with `OnboardingTemplate` (safe area, progress, CTA positioning)
- Inner `ScrollView` with `alwaysBounceVertical={false}`
- Validate first: `const validatedData = StepTypeSchema.parse(step)`
- Use `validatedData.continueButtonLabel` for CTA button text
- Always `useTheme()` — never hardcode colors/typography
- **Never add ProgressBar manually** — `OnboardingProvider` includes it
- `onContinue(value?)` — selected value passed back (Picker, Question)

## Adding a Page Type

1. Zod schema + types in `packages/onboarding/src/steps/{NewType}/`
2. `Pages/{NewType}/`: `types.ts` (re-export schema, default `continueButtonLabel: z.string().optional().default("Continue")`), `Renderer.tsx`, `index.ts`
3. Export from `Pages/index.ts`, add to union in `UI/types.ts`, switch case in `UI/OnboardingPage.tsx`
4. Demo in `example/app/example/`, register in `example/app/example/index.tsx`
