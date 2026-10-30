---
name: export-existing-onboarding
description: Finds an existing onboarding flow already implemented in the target app's source code (screens/modules named onboarding, welcome, intro, getting-started) and converts each screen into a Rocapine step JSON using the built-in step types (MediaContent, Question, Picker, Carousel, Loader, Ratings, Commitment, Paywall). Preserves the app's copy and navigation order, and maps its design tokens into the onboarding theme. Never emits new ComposableScreen steps, a deprecated step type. Use when the user says "export my existing onboarding", "convert my onboarding screens to Rocapine", "I already have onboarding in the app — generate the JSON", "migrate the onboarding to the SDK", or "recreate my onboarding as steps".
allowed-tools: Read, Write, Glob, Grep, Bash
argument-hint: [optional path or screen module name]
---

# Export Existing Onboarding

Walk the target app's source code, identify the existing onboarding flow, and emit a step array that maps each screen onto a built-in step type.

> **The `ComposableScreen` step type is deprecated** (#353) and this skill no longer emits it. A screen no built-in type can express is reported under "Gaps requiring decisions", not recreated as a UIElement tree. Payload reference: `../create-step-json/references/built-in-step-types.md`.

## Phase 0 — Run the Design Profile probe

Before exporting, run `../onboarding-best-practices/references/inspect-target-app.md` and capture the full Design Profile. The exporter maps it into the onboarding theme (`customize-onboarding-theme`) — colors, fonts, radii must come from real source values, not invented.

## Phase 1 — Locate the onboarding flow

Search in this order; stop at first hit:

1. **Routes** (Expo Router): `app/onboarding/**/*.tsx`, `app/(onboarding)/**/*.tsx`, `app/welcome.tsx`, `app/intro.tsx`, `app/getting-started.tsx`
2. **Screens dir**: `src/screens/Onboarding*`, `src/screens/onboarding/**`, `screens/Onboarding*`, `screens/onboarding/**`
3. **Features dir**: `src/features/onboarding/**`, `features/onboarding/**`, `src/modules/onboarding/**`
4. **React Navigation stack**: `grep -rn "Onboarding" --include="*.tsx" --include="*.ts" | grep -i "Stack\|Navigator\|createStack\|Screen name"`
5. **Component names**: `grep -rln "function Welcome\|function Intro\|function Onboarding\|export.*Onboarding" --include="*.tsx"`
6. **Fallback**: ask the user for the directory.

For each found file, classify:
- screen component (default export, returns JSX)
- navigator config (registers screens in order)
- shared component (Button wrapper, AnimatedText, TypewriterText, etc.)

Resolve screen ordering from the navigator config or directory file order (Expo Router file-based routing).

## Phase 2 — For each screen, extract the structure

Read the screen file. Build an intermediate AST-ish representation:

```ts
type ScreenIR = {
  id: string;                 // derived from file name → kebab-case
  name: string;               // derived from component name
  intent: StepType;           // best-match built-in step type (see Phase 3)
  variables: { name: string; type: "string" | "int" | "float" }[];
  elements: ElementIR[];      // tree of UI nodes
  cta: { label: string; variant?: string; action: "continue" | "custom" };
  nextScreen?: string;        // from navigation.navigate() call in CTA handler
};

type ElementIR =
  | { type: "text"; content: string; styleHints: StyleHints }
  | { type: "image"; url: string; styleHints: StyleHints }
  | { type: "lottie"; source: string }
  | { type: "input"; variableName: string; placeholder?: string; keyboardType?: string }
  | { type: "radioGroup"; variableName: string; items: {label:string;value:string}[] }
  | { type: "checkboxGroup"; variableName: string; items: {label:string;value:string}[] }
  | { type: "button"; label: string; action: ButtonAction }
  | { type: "stack"; direction: "y"|"x"|"z"; children: ElementIR[]; styleHints: StyleHints }
  | { type: "scroll"; children: ElementIR[] };
```

Extraction rules. The IR is analysis only: it records what the screen contains so Phase 3 can pick a step type and Phase 4 can fill its payload. Nothing below is emitted as a UIElement tree.

- **Layout containers**: `<View style={{flexDirection:'row'}}>` → `XStack`; `<View>` default → `YStack`; `<ScrollView>` → `YStack`.
- **SafeArea**: any `<SafeAreaView>` / `useSafeAreaInsets()` → outer `SafeAreaView` with `edges: ["top","bottom"]`.
- **Text**: `<Text>` → `Text` element with `content` = the literal or interpolated string. If JSX expression with template literal `` `Hi ${name}` `` → `content: "Hi {{name}}"` + `mode: "expression"`. Variable name MUST be one we can plausibly capture upstream — else skip interpolation and keep the literal value.
- **Image**: `<Image source={require(...)}>` → emit a TODO placeholder URL with the asset path noted in a comment field; `<Image source={{uri: '...'}}>` → `Image.url`.
- **Buttons**: any `<Pressable onPress={...}>` / `<TouchableOpacity>` / `<Button>` / custom button component with `navigation.navigate('Next')` → `Button` with `actions: ["continue"]`. If onPress does more (sets state, calls API), prefer a `custom` action with `function: "<inferred-name>"` and surface the gap.
- **Selection lists**: if you see `Array.prototype.map` over options with `Pressable` and `selected` state → `RadioGroup` or `CheckboxGroup` based on selection semantics (single ref state vs Set). Items derived from the array literal.
- **Inputs**: `<TextInput>` → `Input`. Bind `variableName` to the state setter's name (`setName` → `name`).
- **Lottie**: `<LottieView source={...}>` → `Lottie`.
- **Custom branded Button component** (e.g. `<AppButton variant="primary" label="Go" />`): unwrap. Record its underlying styles (border-radius, color, padding, font) for the theme mapping. Read the component definition once and cache the style map.

Style extraction:

- Read inline `style={{...}}` and resolved `StyleSheet.create({...})`.
- Resolve token references: `theme.colors.primary` → `<DP.brand.primary>` value.
- Resolve `useColorScheme()` branches: capture both light + dark literal sets; default to light.
- For each container: extract `padding*`, `gap`, `alignItems`, `justifyContent`, `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`.

## Phase 3 — Match each screen to a built-in step type
For each `ScreenIR`, classify intent:

| Signal | Step type |
| --- | --- |
| Single big image + title + CTA, no inputs | `MediaContent` |
| `RadioGroup` semantics (single selection state) | `Question` (`multipleAnswer: false`) |
| `CheckboxGroup` semantics (multi-selection) | `Question` (`multipleAnswer: true`) |
| `TextInput` capturing a name | `Picker` (`pickerType: "name"`) |
| Numeric `TextInput` + unit label (age, weight, height), date, gender | `Picker` |
| Text uses prior screens' variables | `MediaContent` |
| Multiple quote/testimonial cards | `Ratings` |
| Lottie + status text + auto-advance / spinner | `Loader` |
| Multiple checkboxes pre-filled with "I will…" copy | `Commitment` |
| Horizontal pager (FlatList horizontal, ViewPager, Carousel) | `Carousel` |
| A paywall shown inside the flow | `Paywall` (the user names the moment) |
| None match | Report it under "Gaps requiring decisions". Do not emit a ComposableScreen step. |

Preserve the source's copy, answers and order. Layout the built-in type cannot express is a gap to report, not something to approximate silently.

## Phase 4 — Emit steps

For each `ScreenIR`, build the step:

```json
{
  "id": "<file-derived-id>",
  "name": "<component-name>",
  "type": "<built-in step type from Phase 3>",
  "displayProgressHeader": <inferred: false for first screen, true for question-funnel screens, false for terminal>,
  "customPayload": null,
  "continueButtonLabel": "<extracted CTA label>",
  "nextStep": <linear: null; if branching detected, build branches>,
  "payload": { /* the fields built-in-step-types.md lists for that type, filled from ScreenIR copy and media */ }
}
```

Set `variableName` on `Question` / `Picker` steps from the state the source screen writes. Map the extracted colors, fonts and radii into the onboarding theme (`customize-onboarding-theme`), not into the step.

## Phase 5 — Detect navigation graph

Build the `nextStep` graph:

- For each screen, find the CTA's `onPress` handler.
- If `navigation.navigate('NextScreenName')`: set `nextStep.defaultTargetStepId` to the kebab-case of `NextScreenName`.
- If `navigation.replace(...)`: same.
- If `if/else` routing: emit `nextStep.branches` with a leaf condition derived from the same `if` expression (must reference a variable already captured).
- If the handler does setState then navigate: that's a normal advance. The `setState` becomes the `variableName` capture upstream — already handled in element extraction.
- Last screen (no further `navigate` call, or calls `navigation.replace('/(app)')`): `nextStep: null`.

## Phase 6 — Surface gaps + ambiguities

After the JSON, list every gap explicitly:

```
## Gaps requiring decisions
- screen "intro": uses local require('./assets/hero.png'). Replace with hosted URL or use `localPathId` once SDK supports it.
- screen "loader": original implementation auto-advances after 3s via setTimeout. Mapped to `Loader` with `duration: 3000`.
- screen "permissions": asks for notification permission. Permission asks shouldn't live in the onboarding payload. Recommend moving to post-onboarding.
- screen "name": custom validation regex on TextInput. `Picker` (`pickerType: "name"`) has no regex validation — validation now lives in the host.
```

## Output format

```
## Discovered flow
- src/screens/Onboarding/Welcome.tsx → "welcome" (MediaContent)
- src/screens/Onboarding/Goal.tsx    → "goal" (Question)
- src/screens/Onboarding/Weight.tsx  → "weight" (Picker)
- src/screens/Onboarding/Plan.tsx    → "plan" (MediaContent)
- src/screens/Onboarding/Done.tsx    → "done" (MediaContent, terminal)
Navigation order from src/navigation/OnboardingStack.tsx:8-22

## Design Profile applied
<the probe summary>

## Variables captured
- goal: string (Goal.tsx:14)
- weight: float (Weight.tsx:18)

## Flow JSON
```json
[ /* full step array, faithfully reflecting source */ ]
```

## Gaps requiring decisions
- ...

## Suggested next steps
1. Replace `REPLACE_ME` URLs with hosted assets (or use `localPathId` once supported)
2. Run `validate-step-json` skill on the output
3. Run `step-json-reviewer` agent to audit conversion + a11y
4. Map the Design Profile into the onboarding theme (`customize-onboarding-theme`)
```

## Don'ts

- Don't invent screens that aren't in the source — emit only what exists.
- Don't squeeze a screen into a built-in type it does not fit — report it as a gap.
- Don't lose copy. Carry JSX text into the step's `title` / `subtitle` / answer labels verbatim.
- Don't replace branded styling with generic defaults — extract it into the theme.
- Don't auto-fix anti-patterns silently — surface them in "Gaps requiring decisions".
- Don't iterate over the navigator more than once; cache the screen list.
- Don't follow asset `require()` imports recursively — note the path and move on.
- Don't write the output to disk unless the user asks; emit inline.
