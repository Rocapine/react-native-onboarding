---
name: export-existing-onboarding
description: Finds an existing onboarding flow already implemented in the target app's source code (screens/modules named onboarding, welcome, intro, getting-started) and converts each screen into a Rocapine ComposableScreen step JSON. Preserves the app's exact design — colors, fonts, radii, copy, navigation order — pulled from the source code. Use when the user says "export my existing onboarding", "convert my onboarding screens to Rocapine", "I already have onboarding in the app — generate the JSON", "migrate the onboarding to the SDK", or "recreate my onboarding as steps".
allowed-tools: Read, Write, Glob, Grep, Bash
argument-hint: [optional path or screen module name]
---

# Export Existing Onboarding

Walk the target app's source code, identify the existing onboarding flow, and emit a ComposableScreen step array that recreates each screen pixel-faithfully using ComposableScreen UIElements.

## Phase 0 — Run the Design Profile probe

Before exporting, run `../onboarding-best-practices/references/inspect-target-app.md` and capture the full Design Profile. The exporter uses this for every UIElement it emits — colors, fonts, radii must come from real source values, not invented.

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
  intent: ArchetypeName;      // best-match archetype (see Phase 3)
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

Extraction rules:

- **Layout containers**: `<View style={{flexDirection:'row'}}>` → `XStack`; `<View>` default → `YStack`; `<ScrollView>` → `YStack` (note: vertical scroll handled by ComposableScreen renderer if content overflows).
- **SafeArea**: any `<SafeAreaView>` / `useSafeAreaInsets()` → outer `SafeAreaView` with `edges: ["top","bottom"]`.
- **Text**: `<Text>` → `Text` element with `content` = the literal or interpolated string. If JSX expression with template literal `` `Hi ${name}` `` → `content: "Hi {{name}}"` + `mode: "expression"`. Variable name MUST be one we can plausibly capture upstream — else skip interpolation and keep the literal value.
- **Image**: `<Image source={require(...)}>` → emit a TODO placeholder URL with the asset path noted in a comment field; `<Image source={{uri: '...'}}>` → `Image.url`.
- **Buttons**: any `<Pressable onPress={...}>` / `<TouchableOpacity>` / `<Button>` / custom button component with `navigation.navigate('Next')` → `Button` with `actions: ["continue"]`. If onPress does more (sets state, calls API), prefer a `custom` action with `function: "<inferred-name>"` and surface the gap.
- **Selection lists**: if you see `Array.prototype.map` over options with `Pressable` and `selected` state → `RadioGroup` or `CheckboxGroup` based on selection semantics (single ref state vs Set). Items derived from the array literal.
- **Inputs**: `<TextInput>` → `Input`. Bind `variableName` to the state setter's name (`setName` → `name`).
- **Lottie**: `<LottieView source={...}>` → `Lottie`.
- **Custom branded Button component** (e.g. `<AppButton variant="primary" label="Go" />`): unwrap. Apply its underlying styles (border-radius, color, padding, font) to the ComposableScreen `Button` props directly. Read the component definition once and cache the style map.

Style extraction:

- Read inline `style={{...}}` and resolved `StyleSheet.create({...})`.
- Resolve token references: `theme.colors.primary` → `<DP.brand.primary>` value.
- Resolve `useColorScheme()` branches: capture both light + dark literal sets; default to light.
- For each container: extract `padding*`, `gap`, `alignItems`, `justifyContent`, `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`.

## Phase 3 — Match each screen to an archetype

For each `ScreenIR`, classify intent:

| Signal | Archetype |
|--------|-----------|
| Single big image + title + CTA, no inputs | `hero` |
| `RadioGroup` semantics (single selection state) | `question-single` |
| `CheckboxGroup` semantics (multi-selection) | `question-multi` |
| `TextInput` capturing one field | `input` |
| Numeric `TextInput` + unit label | `picker` |
| Text uses prior screens' variables | `reflection` |
| Multiple quote/testimonial cards | `social-proof` |
| Lottie + status text + auto-advance / spinner | `loader` |
| Multiple checkboxes pre-filled with "I will…" copy | `commitment` |
| Horizontal pager (FlatList horizontal, ViewPager, Carousel) | `carousel` |
| None match | `ComposableScreen freeform` — emit the tree literally |

The archetype guides defaults but the emitted JSON should preserve the original tree exactly. Don't replace a 4-button layout with the canonical 3-button card pattern just because it's the archetype's default — match the source.

## Phase 4 — Emit ComposableScreen steps

For each `ScreenIR`, build the step:

```json
{
  "id": "<file-derived-id>",
  "name": "<component-name>",
  "type": "ComposableScreen",
  "displayProgressHeader": <inferred: false for first screen, true for question-funnel screens, false for terminal>,
  "customPayload": null,
  "continueButtonLabel": "<extracted CTA label>",
  "nextStep": <linear: null; if branching detected, build branches>,
  "payload": {
    "elements": [/* tree mirroring ScreenIR.elements + outer SafeAreaView */]
  }
}
```

For each element, apply Design Profile values:

- Background of outer SafeAreaView → screen container `backgroundColor` extracted from source
- Text `fontFamily` / `fontSize` / `fontWeight` / `color` → extracted from source (or fallback to Design Profile heading/body)
- Button styling → extracted from underlying button component
- Card containers → preserve extracted `backgroundColor` / `borderRadius` / `borderWidth` / `borderColor`

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
- screen "loader": original implementation auto-advances after 3s via setTimeout. ComposableScreen lacks built-in delayedContinue — emit a `custom` action `delayedContinue` and wire it in the host.
- screen "permissions": asks for notification permission. Permission asks shouldn't live in the onboarding payload. Recommend moving to post-onboarding.
- screen "name": custom validation regex on TextInput. ComposableScreen Input lacks regex validation — emit as-is; validation now lives in the host.
```

## Output format

```
## Discovered flow
- src/screens/Onboarding/Welcome.tsx → "welcome" (hero)
- src/screens/Onboarding/Goal.tsx    → "goal" (question-single)
- src/screens/Onboarding/Weight.tsx  → "weight" (picker)
- src/screens/Onboarding/Plan.tsx    → "plan" (reflection)
- src/screens/Onboarding/Done.tsx    → "done" (hero, terminal)
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
4. Wire `delayedContinue` custom action in the host (loader)
```

## Don'ts

- Don't invent screens that aren't in the source — emit only what exists.
- Don't simplify multi-step screens to fit an archetype — preserve the original tree.
- Don't lose copy. Translate JSX text to `Text.content` verbatim.
- Don't replace branded button styling with generic CTA defaults — extract and apply.
- Don't auto-fix anti-patterns silently — surface them in "Gaps requiring decisions".
- Don't iterate over the navigator more than once; cache the screen list.
- Don't follow asset `require()` imports recursively — note the path and move on.
- Don't write the output to disk unless the user asks; emit inline.
