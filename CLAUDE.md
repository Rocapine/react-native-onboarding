# CLAUDE.md

Guidance for Claude Code working in this repository.

Path-scoped rules auto-load from `.claude/rules/`:
- `page-renderers.md` — page renderer rules, adding a Page Type
- `composable-screen-runtime.md` — UIElement runtime conventions, BaseBoxProps, font hook rule, gradient peer dep
- `example-app.md` — example app workflow, workspace type-resolution gotcha

## Project Overview

**Monorepo** with two npm packages for Rocapine Onboarding Studio — CMS-driven onboarding system for React Native apps:

- **`@rocapine/react-native-onboarding`** (`packages/onboarding/`) — Headless SDK: data fetching, state management, hooks, Zod schemas for step types
- **`@rocapine/react-native-onboarding-ui`** (`packages/onboarding-ui/`) — UI layer: renderers, theme system, components, templates

UI package depends on headless package as peer dependency.

## Development Commands

### Root (Monorepo)

```bash
npm run build              # Build both packages (trailing "Missing script: build" for `example` workspace is expected — both packages still build)
npm run build:headless     # packages/onboarding only
npm run build:ui           # packages/onboarding-ui only (also copies src/assets → dist/assets)
npm run watch:headless     # Watch mode for headless
npm run watch:ui           # Watch mode for UI
npm run clean              # Remove all dist/ and node_modules/
npm run publish:all        # Build + publish both packages to npm
npm test --workspace=packages/onboarding  # vitest (evaluateCondition, resolveNextStepNumber)
```

After modifying `packages/`, run `npm run build` (or relevant workspace build) before reloading the example app — it references local packages via `file:../packages/*`.

## Architecture

### Two-Package Split

**Headless SDK** (`packages/onboarding/src/`):
- `OnboardingStudioClient.ts` — API client fetching steps from Supabase backend. URL params: `projectId`, `platform`, `appVersion`, `locale`, `draft`. Returns step data + custom headers (`ONBS-Onboarding-Id`, `ONBS-Audience-Id`, `ONBS-Onboarding-Name`).
- `infra/provider/` — `OnboardingProvider`: wraps app with `QueryClientProvider` + `ThemeProvider`, manages caching via AsyncStorage, **automatically includes ProgressBar**. Internal `OnboardingDataGate` reads `useQuery({ data, error })` and **throws `error`** so host `ErrorBoundary` catches network/parse failures — never swallow error and fall through to `fontsFallback`.
- `infra/hooks/useOnboardingQuestions.ts` — Hook returning `{ step, isLastStep, stepsLength, onboardingMetadata, steps }`. Uses `useSuspenseQuery`; manages progress context automatically.
- `infra/fonts/` — Runtime font registry.
- `steps/` — Zod schemas + TypeScript types for each step variant (source of truth)
- `types.ts` — Core types; `index.ts` — public exports. **CHANGELOG entries describing union/enum members are illustrative** — check actual exported type (e.g. `FontWeightKey`) for canonical set.

**UI Package** (`packages/onboarding-ui/src/`):
- `UI/OnboardingPage.tsx` — Central router: switch on `step.type` → specific Renderer
- `UI/Pages/` — One dir per step type (each with `types.ts`, `Renderer.tsx`, `index.ts`)
- `UI/Templates/OnboardingTemplate.tsx` — Reusable layout: safe area, progress header, CTA at bottom
- `UI/Components/` — `ProgressBar`, `CircularProgress`, `StaggeredTextList`
- `UI/Theme/` — Theme context, hooks, deep-merge utils, `tokens/lightTokens.ts`, `darkTokens.ts`, `typography.ts`
- `UI/Provider/` — `OnboardingProgressProvider`
- `UI/ErrorBoundary/` — HOC for error handling

### Page Types

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

## Custom Components System

`OnboardingProvider` accepts `customComponents` prop to replace UI components while keeping SDK data flow.

**Context**: `src/infra/provider/CustomComponentsContext.tsx` → `useCustomComponents()` hook

**Customizable components**: `QuestionAnswerButton`, `QuestionAnswersList` (more can be added following same pattern)

**Resolution order**: Custom List → Custom Button → Default implementation

**Pattern in renderers**:
```typescript
const { theme } = useTheme();
const customComponents = useCustomComponents();
const AnswersList = customComponents.QuestionAnswersList || DefaultQuestionAnswersList;
```

**Adding new customizable components**: define props interface → create default impl → add to `CustomComponents` interface → use in renderer → export from module.

## Theme Customization

`OnboardingProvider` accepts `theme`, `lightTheme`, `darkTheme`, `initialColorScheme` props.

### Available Tokens

```typescript
// Colors
colors.primary / secondary / disable
colors.tertiary.{ tertiary1, tertiary2, tertiary3 }
colors.neutral.{ highest, higher, high, medium, low, lower, lowest }
colors.surface.{ lowest..highest, opposite }
colors.text.{ primary, secondary, tertiary, opposite, disable }

// Typography
typography.fontFamily.{ title, text, tagline }   // Names only; load fonts via expo-font
typography.fontSize.{ xs, sm, md, lg, xl, "2xl", "3xl", "4xl" }
typography.fontWeight.{ regular, medium, semibold, bold, extrabold }
typography.lineHeight.{ tight, normal, relaxed }
typography.textStyles.{ heading1, heading2, heading3, body, bodyMedium, label, caption, button }
```

**In components**:
```typescript
import { useTheme, getTextStyle } from "@rocapine/react-native-onboarding-ui";
const { theme } = useTheme();
// theme.colors.*, theme.typography.textStyles.*, getTextStyle(theme, "heading1")
```

**Import default tokens for extension**:
```typescript
import { lightTokens, darkTokens, typography } from "@rocapine/react-native-onboarding-ui";
```

## Peer Dependencies

UI package optional peer deps (install only if using feature):
- `@react-native-picker/picker` — Picker step type
- `@shopify/react-native-skia` — specific visual components
- `expo-store-review` — Ratings step type

## Updating ComposableScreen UIElement Schema

**Adding a prop to an existing element** is narrower than adding an element: edit only the headless element `*.ts` (type + Zod schema) and its UI mirror `*.tsx`. The `types.ts` UIElement union/schema is untouched — each variant references the element's props type, so new props flow through automatically.

**Animated elements**: `react-native-reanimated` + `react-native-svg` are already available (precedent: `UI/Components/CircularProgress.tsx`) — don't add a peer dep for SVG/animation. Call reanimated hooks (`useAnimatedProps`/`useAnimatedStyle`) **unconditionally** — compute every variant's animated value before any `variant` branch, else rules-of-hooks breaks when the element switches shape.

When adding/changing a `UIElement` type in either ComposableScreen `types.ts`, **always**:

1. **Update `packages/onboarding/src/onboarding-example.ts`** — add/update example step exercising the new/changed element type so default onboarding stays in sync with schema.
2. **Update `example/app/example/composable-screen.tsx`** — add/update element in rendered example payload.
3. **Watch for schema duplication in UI renderers.** Several UI element renderers re-declare their Zod schemas + `*Props` type in lockstep with the headless source (known mirrors: `Pages/ComposableScreen/elements/ButtonElement.tsx`, `IconElement.tsx` — grep for `IconElementPropsSchema`-style re-exports to find others). When changing headless `elements/*.ts`, update the UI mirror's field set too — TS won't catch the drift because the UI re-declares its own type. **Drift runs both ways**: a variant added only to the UI mirror (e.g. `setVariable` `ButtonAction`) still fails parsing — the headless schema validates the payload, so a UI-only variant throws `invalid_union` even though the renderer handles it.
4. **Mirror schema docs in-repo** — update `claude-plugin/skills/{compose-screen-builder,validate-step-json,customize-onboarding-components}/SKILL.md` + `create-step-json/references/composable-archetypes.md`, and `website/docs/page-types.mdx` (Button/element prop tables). Grep these for the changed field name.
5. **Display this prompt for `onboarding-studio` repo** (CMS backend that must mirror schema changes):

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

## Debugging ComposableScreen schema parse errors

- Fetch a project's draft payload directly: `curl "$EXPO_PUBLIC_ONBOARDING_BASE_URL/get-onboarding-steps?projectId=$PID&platform=ios&appVersion=1.0.0&draft=true&locale=en"`.
- Env values live in `example/.env` + `example/.env.local` (`.env.local` overrides → local Supabase `localhost:64321`); a fresh **worktree** has empty/missing env, so read the values from the **main repo's** `example/.env*`.
- Validate against the schema in Node using the **headless** dist only (`require('./packages/onboarding/dist/steps/ComposableScreen/types.js')`) — the UI dist imports `react-native` and won't load under Node.
- The parse entry point is the exported `ComposableScreenStepTypeSchema` (`.safeParse(step)`).
- A minimal step for `.safeParse` needs top-level `id`, `name` (string), `type`, `displayProgressHeader` (boolean), and `payload.elements` — missing `name`/`displayProgressHeader` reads as element errors, not obviously a step-shape problem.
- Zod v4 `invalid_union` paths are cumulative across nested variant errors; walk the issue tree and concatenate `prefix + it.path` recursively to surface the real failing path.
- Triage data-vs-schema: many parse failures are CMS **data** bugs, not SDK bugs (e.g. `variant:"clear"` — only `filled/outlined/ghost`; `shadowOpacity:12` — RN bounds `0..1`). Fix in studio, not the schema.
