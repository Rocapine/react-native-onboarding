# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** containing two npm packages for Rocapine Onboarding Studio — a CMS-driven onboarding system for React Native apps:

- **`@rocapine/react-native-onboarding`** (`packages/onboarding/`) — Headless SDK: data fetching, state management, hooks, Zod schemas for step types
- **`@rocapine/react-native-onboarding-ui`** (`packages/onboarding-ui/`) — UI layer: renderers, theme system, components, templates

The UI package depends on the headless package as a peer dependency.

## Development Commands

### Root (Monorepo)

```bash
npm run build              # Build both packages
npm run build:headless     # Build packages/onboarding only
npm run build:ui           # Build packages/onboarding-ui only (also copies src/assets → dist/assets)
npm run watch:headless     # Watch mode for headless package
npm run watch:ui           # Watch mode for UI package
npm run clean              # Remove all dist/ and node_modules/
npm run publish:all        # Build and publish both packages to npm
```

### Example App

```bash
cd example/
npm install
npm start             # Start Expo dev server
npm run type          # TypeScript type checking (tsc --noEmit)
npm run lint          # ESLint via expo lint
npm run ios
npm run android
```

**Important**: After modifying anything in `packages/`, run `npm run build` (or the relevant workspace build) before reloading the example app, since the example references local packages via `file:../packages/*`.

## Architecture

### Two-Package Split

**Headless SDK** (`packages/onboarding/src/`):
- `OnboardingStudioClient.ts` — API client that fetches steps from Supabase backend. URL params: `projectId`, `platform`, `appVersion`, `locale`, `draft`. Returns step data + custom headers (`ONBS-Onboarding-Id`, `ONBS-Audience-Id`, `ONBS-Onboarding-Name`).
- `infra/provider/` — `OnboardingProvider`: wraps app with `QueryClientProvider` + `ThemeProvider`, manages caching via AsyncStorage, and **automatically includes ProgressBar**
- `infra/hooks/useOnboardingQuestions.ts` — Hook returning `{ step, isLastStep, stepsLength, onboardingMetadata, steps }`. Uses `useSuspenseQuery`; manages progress context automatically.
- `steps/` — Zod schemas and TypeScript types for each step variant (source of truth for data shapes)
- `types.ts` — Core types; `index.ts` — public exports

**UI Package** (`packages/onboarding-ui/src/`):
- `UI/OnboardingPage.tsx` — Central router: switch on `step.type` → delegates to specific Renderer
- `UI/Pages/` — One directory per step type; each has `types.ts` (Zod schema), `Renderer.tsx`, `index.ts`
- `UI/Templates/OnboardingTemplate.tsx` — Reusable layout: safe area insets, progress header, CTA button at bottom
- `UI/Components/` — Shared components: `ProgressBar`, `CircularProgress`, `StaggeredTextList`
- `UI/Theme/` — Theme context, hooks, deep-merge utils, `tokens/lightTokens.ts`, `tokens/darkTokens.ts`, `tokens/typography.ts`
- `UI/Provider/` — `OnboardingProgressProvider`
- `UI/ErrorBoundary/` — HOC for error handling

### Page Types

Available step types (each in `UI/Pages/{Type}/`):

| Type | Key Behavior |
|------|-------------|
| `Ratings` | App store rating prompts with social proofs |
| `MediaContent` | Image/video content with title/description |
| `Picker` | Native picker UI; routes by `pickerType` (weight, height, age, gender, coach, name); requires `@react-native-picker/picker` peer dep |
| `Commitment` | User commitment/agreement screens |
| `Carousel` | Horizontal `ScrollView` with `pagingEnabled`; page dots; button label changes on last page |
| `Loader` | Sequential animated progress bars using React Native `Animated` (NOT Reanimated); optional "Did you know?" carousel |
| `Question` | Q&A with single/multi-select; supports custom answer button/list components |

### ProgressBar

- **Automatically included in `OnboardingProvider`** — never add it manually in individual screens
- Shows/hides based on `step.displayProgressHeader`
- Back button appears when `router.canGoBack()` is true (uses expo-router)
- Control back nav: use `router.push()` vs `router.replace()` in `onContinue` handlers

## Adding a New Page Type

1. Add Zod schema + TypeScript type in `packages/onboarding/src/steps/{NewType}/` (source of truth)
2. Create `packages/onboarding-ui/src/UI/Pages/{NewType}/`:
   - `types.ts` — re-export or re-define schema; include `continueButtonLabel: z.string().optional().default("Continue")`
   - `Renderer.tsx` — use `OnboardingTemplate`, validate with Zod, use `useTheme()`, **no ProgressBar**
   - `index.ts` — export both
3. Export from `packages/onboarding-ui/src/UI/Pages/index.ts`
4. Add to union in `packages/onboarding-ui/src/UI/types.ts`
5. Add case to switch in `packages/onboarding-ui/src/UI/OnboardingPage.tsx`
6. Add example to `example/app/example/` and register in `example/app/example/index.tsx`

### Renderer Guidelines

- Use `OnboardingTemplate` for consistent layout and CTA positioning
- Wrap content in `ScrollView` with `alwaysBounceVertical={false}`
- Always `const validatedData = StepTypeSchema.parse(step)` before use
- Use `validatedData.continueButtonLabel` for button text
- Use `useTheme()` for all colors and typography — never hardcode values
- `onContinue` receives selected value as parameter (for types like Picker, Question)

## Custom Components System

`OnboardingProvider` accepts `customComponents` prop to replace UI components while keeping SDK data flow.

**Context**: `src/infra/provider/CustomComponentsContext.tsx` → `useCustomComponents()` hook

**Customizable components**: `QuestionAnswerButton`, `QuestionAnswersList` (more can be added following the same pattern)

**Resolution order**: Custom List → Custom Button → Default implementation

**Pattern in renderers**:
```typescript
const { theme } = useTheme();
const customComponents = useCustomComponents();
const AnswersList = customComponents.QuestionAnswersList || DefaultQuestionAnswersList;
```

**Adding new customizable components**: define props interface → create default implementation → add to `CustomComponents` interface → use in renderer → export from module.

## Theme Customization

`OnboardingProvider` accepts `theme`, `lightTheme`, `darkTheme`, and `initialColorScheme` props.

### Available Tokens

```typescript
// Colors
colors.primary / secondary / disable
colors.tertiary.{ tertiary1, tertiary2, tertiary3 }
colors.neutral.{ highest, higher, high, medium, low, lower, lowest }
colors.surface.{ lowest..highest, opposite }
colors.text.{ primary, secondary, tertiary, opposite, disable }

// Typography
typography.fontFamily.{ title, text, tagline }   // Names only; you must load fonts via expo-font
typography.fontSize.{ xs, sm, md, lg, xl, "2xl", "3xl", "4xl" }
typography.fontWeight.{ regular, medium, semibold, bold, extrabold }
typography.lineHeight.{ tight, normal, relaxed }
typography.textStyles.{ heading1, heading2, heading3, body, bodyMedium, label, caption, button }
```

**In components**:
```typescript
import { useTheme, getTextStyle } from "@rocapine/react-native-onboarding-ui";
const { theme } = useTheme();
// Use: theme.colors.*, theme.typography.textStyles.*, getTextStyle(theme, "heading1")
```

**Import default tokens for extension**:
```typescript
import { lightTokens, darkTokens, typography } from "@rocapine/react-native-onboarding-ui";
```

## Peer Dependencies

The UI package has these **optional** peer dependencies (install only if using the feature):
- `@react-native-picker/picker` — required by Picker step type
- `@shopify/react-native-skia` — required by specific visual components
- `expo-store-review` — required by Ratings step type

## Updating ComposableScreen UIElement Schema

When adding or changing a `UIElement` type in either ComposableScreen `types.ts` file, **always**:

1. **Update `packages/onboarding/src/onboarding-example.ts`** — add or update an example step that exercises the new/changed element type so the default onboarding stays in sync with the schema.

2. **Update `example/app/example/composable-screen.tsx`** — add or update the element in the rendered example payload.

3. **Display the following prompt for the `onboarding-studio` repository** (the CMS backend that must mirror these schema changes) after completing the changes:

```
The ComposableScreen UIElement schema in the React Native SDK has been updated.
Please mirror these schema changes in onboarding-studio.

Changes made:
<describe what was added/changed — element type name, props, Zod schema>

Files changed in the SDK:
- packages/onboarding/src/steps/ComposableScreen/types.ts
- packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts

In onboarding-studio, update:
- The UIElement union type / discriminated union to include the new element
- The Zod schema (or equivalent validation) for the new element's props
- Any CMS editor UI that lets users pick element types (add the new type to the picker)
- Any JSON serialization/deserialization logic that handles UIElement variants
```

## Publishing Workflow

```bash
# Patch release for both packages
npm run publish:all

# Individual package release
cd packages/onboarding && npm run patch    # bump + build + publish
cd packages/onboarding-ui && npm run patch # bump + build + publish
```

## Example App

Located in `example/`. Uses local packages via `"file:../packages/onboarding"` and `"file:../packages/onboarding-ui"`.

- `app/example/` — Individual page type demos; registered in `app/example/index.tsx`
- `app/onboarding/[questionId].tsx` — Full onboarding flow with real API
- `app/onboarding_custom_screens/` — Custom component override demos
- `app/_layout.tsx` — Root layout with `OnboardingProvider` setup
- `components/` — Demo custom components (e.g., `MinimalAnswerButton`, `AnimatedAnswersList`)
