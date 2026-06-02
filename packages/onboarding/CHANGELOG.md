# Changelog

All notable changes to `@rocapine/react-native-onboarding` are documented here.

---

## [Unreleased]

---

## [1.34.1] - 2026-06-02

### Changed
- **Example onboarding** — added a second WebP image (landscape, 16:9) to the default onboarding's first composable screen, alongside the existing portrait WebP. No schema or API change.

---

## [1.34.0] - 2026-06-02

### Added
- **`ScrollView` element `alignItems` / `justifyContent`** — two optional props on the `ScrollView` UIElement controlling cross-axis alignment (`alignItems`: `"flex-start"` | `"center"` | `"flex-end"` | `"stretch"` | `"baseline"`) and distribution along the scroll axis (`justifyContent`: `"flex-start"` | `"center"` | `"flex-end"` | `"space-between"` | `"space-around"`). Applied to the scroll content container.

---

## [1.33.0] - 2026-06-01

### Added
- **`RichText` container UIElement** — a **wrapping flex row** of child `Text` elements (words + padded/rounded/rotated "chips" that wrap and align together, e.g. a "Boost your `[energy]`" marketing title). Because each child renders as a real flex child of a `<View>` (not a nested `<Text>` like inline `TextSpan`s), it honors its own box props — `padding`, `borderRadius`, `borderWidth`, `backgroundColor`, `margin`, `transform` — plus `renderWhen` and `expression` mode. Plain-text children are split into one item per word so the row wraps word-by-word like a paragraph (chips flow inline with the text); children with box styling or motion stay atomic. `children` are schema-restricted to `Text` only. `props` are layout props (`gap`, `alignItems` — incl. `"baseline"` — `justifyContent`, `flexWrap` defaulting to `"wrap"`) plus all `BaseBoxProps`, plus **inherited text-style defaults** (`fontSize`, `fontWeight`, `fontFamily`, `fontStyle`, `color`, `textAlign`, `letterSpacing`, `lineHeight`) — declare the title's base typography once on the container and each child `Text` inherits it (child overrides win). New exported type: `RichTextElementProps`. (Distinct from inline `TextSpan`, which stays a single text-style-only wrapping paragraph.)

---

## [1.32.0] - 2026-06-01

### Added
- **Animations / transitions / effects on every UIElement** — `BaseBoxProps` gains two optional fields, so any ComposableScreen element can declare motion. Schema mirrors `react-native-reanimated`: `preset` values are the **exact reanimated builder names** and modifier fields map to builder methods.
  - **`transform`** (static): `{ translateX?, translateY?, scale?, scaleX?, scaleY?, rotate? (deg) }`.
  - **`animation`**: `{ entering?, exiting?, layout?, effect? }`.
    - `entering` / `exiting`: `{ preset, duration?, delay?, easing?, spring? }`. Entering presets: `FadeIn(Up/Down/Left/Right)`, `SlideIn(Up/Down/Left/Right)`, `ZoomIn(Rotate/Up/Down/Left/Right/EasyUp/EasyDown)`, `BounceIn(Up/Down/Left/Right)`, `FlipIn(XUp/YLeft/XDown/YRight/EasyX/EasyY)`, `StretchIn(X/Y)`, `RotateIn(DownLeft/DownRight/UpLeft/UpRight)`, `RollIn(Left/Right)`, `PinwheelIn`, `LightSpeedIn(Left/Right)`; exiting presets are the matching `…Out…` names.
    - `layout`: `{ preset, duration?, spring? }` — `LinearTransition`, `FadingTransition`, `SequencedTransition`, `JumpingTransition`, `CurvedTransition`, `EntryExitTransition`.
    - `effect` (continuous loop, not a reanimated builder name): `{ preset: "pulse" | "fade" | "rotate" | "shimmer" | "bounce", duration?, delay?, easing?, loop?, minScale?/maxScale? (pulse), minOpacity? (fade), degrees? (rotate) }`.
  - `easing` (`"linear"` | `"ease-in"` | `"ease-out"` | `"ease-in-out"`) and `spring` (`{ damping?, stiffness?, mass? }`, mirrors `.springify(config)` and wins over `easing`). New exported types: `AnimationEasing`, `SpringConfig`, `EnteringPreset`, `ExitingPreset`, `LayoutPreset`, `EffectPreset`, `EnteringAnimation`, `ExitingAnimation`, `LayoutAnimation`, `ElementEffect`, `ElementAnimation`, `ElementTransform`.
- **`TextSpan` extended** — inline rich-text spans gain `backgroundColor`, `opacity` (0–1), `textTransform` (`"none"` | `"uppercase"` | `"lowercase"` | `"capitalize"`), `textDecorationColor`, `textDecorationStyle` (`"solid"` | `"double"` | `"dotted"` | `"dashed"`), and `lineHeight`. All optional, inline-safe (animation/transform remain element-level only — spans are not UIElements).

---

## [1.31.0] - 2026-06-01

### Added
- **Inline rich text for `Text`** — `TextElementProps.content` is now `string | TextSpan[]`. A span array renders styled fragments inline (nested `<Text>`) that wrap together on one baseline. New `TextSpan` type and `TextSpanSchema` exported from the headless package. Span fields (all optional except `text`): `text`, `fontWeight`, `fontStyle`, `fontFamily`, `fontSize`, `letterSpacing`, `color`, `textDecorationLine` (`"none"` | `"underline"` | `"line-through"` | `"underline line-through"`). Omitted span props inherit from the parent `Text`. In `mode: "expression"`, `{{variable}}` interpolation applies to each span's `text`.

### Changed
- **`TextElementPropsSchema.content`** widened from `z.string()` to `z.union([z.string(), z.array(TextSpanSchema)])`. Backward compatible — existing string payloads validate and render unchanged.

---

## [1.30.0] - 2026-05-29

### Added
- **`ProgressIndicator` UIElement** — new ComposableScreen element rendering a linear or circular progress display bound to an int variable (0–100). Schema (`ProgressIndicatorElementPropsSchema`) and type (`ProgressIndicatorElementProps`, `ProgressEasing`) exported from the headless package and added to the `UIElement` union. Props (all optional, plus `BaseBoxProps`): `variant` (`"linear"` | `"circular"`), `variableName` (bound int variable — written each frame during autoplay, read otherwise), `value` (static 0–100), `autoplay`, `loop`, `initialValue` (0–100), `duration` (ms), `delay` (ms before the animation starts), `easing` (`"linear"` | `"ease-in"` | `"ease-out"` | `"ease-in-out"`), `color`, `trackColor`, `thickness`, `size`, `showLabel`, `labelColor`.

---

## [1.29.0] - 2026-05-29

### Added
- **`DatePicker`: `"now"` sentinel for date bounds** — `defaultValue`, `minimumDate`, and `maximumDate` now accept the literal string `"now"` in addition to ISO 8601 date strings. `"now"` resolves to the current date/time at render, so a max date that should always be "today" no longer goes stale at module-load time. Schema validation accepts a value when it is `"now"` or parses via `Date.parse`.
- **`SetVariableButtonActionSchema` / `SetVariableButtonAction`** — exported from the headless package and added to the `ButtonActionSchema` union (`{ type: "setVariable", name, value, label?, valueMode?, kind? }`).

### Fixed
- **`ButtonActionSchema` rejected `setVariable` actions** — the headless union only accepted `"continue"` and `{ type: "custom" }`, while the UI package and runtime already supported `setVariable`. Any ComposableScreen payload using a `setVariable` button action failed parsing with `invalid_union`. Headless now mirrors the UI variant, fixing the schema drift.

---

## [1.28.0] - 2026-05-29

### Added
- **`RadioGroup` / `CheckboxGroup`: `showTick` prop** — both schemas extend with optional `showTick: boolean` (default `true`). When `false`, the per-item indicator (radio circle / checkbox box) is omitted; the item label and selected background / border styling still render. Lets authors build pill / card-style single- and multi-select groups without the tick glyph.

---

## [1.27.0] - 2026-05-29

### Added
- **Unary condition operators `is_empty` / `is_not_empty` / `is_null` / `is_not_null`** — usable in `renderWhen`, `Button.disabledWhen`, and `nextStep.branches[].condition`. They take no `value` (schema makes `value` optional for these and still required for binary operators). `empty` is type-aware (empty/whitespace string, empty array, or unset/null); `null` is unset/null only — a set-but-empty `""` is **not null** yet **is empty**. Exports `UNARY_CONDITION_OPERATORS` + `isUnaryConditionOperator`.
- **`WheelPicker` UIElement** — scrolling wheel selector for the ComposableScreen system. Binds a variable via `variableName` / `defaultValue`. Options come from either an explicit `items: Array<{label, value}>` or an auto-generated numeric `range: {min, max, step?, unit?}` (exactly one required; `unit` formats labels as `"<value> <unit>"`). Styling via `itemColor` / `itemFontSize` / `itemFontFamily` plus standard `BaseBoxProps`. Exports `WheelPickerElementProps`, `WheelPickerItem`, `WheelPickerRange`, `WheelPickerElementPropsSchema`, and helpers `resolveWheelPickerItems` / `generateWheelPickerRangeItems` (shared with the UI renderer + default collection). Rendered via the optional `@react-native-picker/picker` peer dep (same as the `Picker` step).

### Fixed
- **Condition evaluation now decodes JSON-array variable values** — multi-select elements (`CheckboxGroup`) store their value as a JSON string (`"[]"` when empty). `evaluateCondition` decodes such strings back to an array before testing, so a fully-deselected group correctly reads as empty: a `renderWhen` / `disabledWhen` using `is_not_empty` now hides/disables again when the last item is unselected (previously `"[]"` was treated as a non-empty string and never fell back). `contains` against these values is now real array membership rather than a substring match.

---

## [1.26.0] - 2026-05-28

### Added
- **`Icon` UIElement: `fill` + `fillOpacity` props** — `IconElementPropsSchema` extends with optional `fill: string` (any CSS color; omit ⇒ Lucide default `"none"` outlined) and `fillOpacity: number` (0–1, clamped). Enables filled / tinted Lucide icons (`Star`, `Heart`, `Bookmark`, `Circle`, `CheckCircle2`, …) from CMS payload.

### Changed
- **`onboarding-example.ts` ComposableScreen demo** — wrapped `root` YStack in a `ScrollView` UIElement so the payload scrolls (page renderer is intentionally a plain `View flex:1`, see `composable-screen-runtime.md`). Hero `Star` icon also showcases `fill` + `fillOpacity: 0.2` tint.

---

## [1.25.1] - 2026-05-28

### Added

- **`aspectRatio` on `BaseBoxProps`** — every UIElement now accepts an
  optional positive `aspectRatio` number, mirroring the React Native
  style prop. Pair with `width` / `height` to derive the other dimension
  instead of hard-coding both.

---

## [1.25.0] - 2026-05-27

### Added

- **`ScrollView` ComposableScreen UIElement** — new container element wrapping
  children in a scrollable view. Props (`ScrollViewElementProps`, extends
  `BaseBoxProps`): `horizontal`, `bounces`, `showsVerticalScrollIndicator`,
  `showsHorizontalScrollIndicator`, `alwaysBounceVertical`,
  `alwaysBounceHorizontal`, `contentInset` (`ScrollViewContentInset`:
  `{ top, right, bottom, left }`, iOS-only), `contentContainerPadding`,
  `keyboardShouldPersistTaps`.
- **`KeyboardAvoidingView` ComposableScreen UIElement** — new container element.
  Props (`KeyboardAvoidingViewElementProps`, extends `BaseBoxProps`):
  `behavior` (`KeyboardAvoidingBehavior`: `"padding" | "height" | "position"`,
  defaults to iOS `padding` / Android `height`), `keyboardVerticalOffset`,
  `enabled`.
- **Schema guard: no nested KeyboardAvoidingView** — `ComposableScreenStepPayloadSchema`
  now `superRefine`s the element tree and rejects any `KeyboardAvoidingView`
  nested inside another, reporting the offending element `id`.

> **Backend note:** `onboarding-studio` should mirror both new UIElement types
> (union + Zod schema + editor picker) and the nested-KAV validation rule, and
> default the `picker` archetype template to wrap its picker in a
> `KeyboardAvoidingView`.

---

## [1.24.0] - 2026-05-27

### Added

- **Button per-state style overrides** — `ButtonElementProps` gains
  `pressedStyle?: ButtonStyleOverride` and `disabledStyle?: ButtonStyleOverride`,
  each a `Partial` of the overridable Button props (`BaseBoxProps` plus
  `variant`, `backgroundColor`, `color`, `fontSize`, `fontWeight`,
  `fontFamily`, `fontStyle`, `textAlign`). Nested `pressedStyle`/`disabledStyle`
  are not overridable. New `transitionDurationMs?: number` controls the
  rest/pressed/disabled animation length (default `150`).
- **Shadow fields on `BaseBoxProps`** — `shadowColor`, `shadowOffset`
  (`{ width, height }`), `shadowOpacity` (0–1), `shadowRadius`, and `elevation`
  (Android) on every UIElement variant. Currently applied by the `Button`
  renderer in the UI package; schema accepts them on all elements.

### Changed

- **`disabledBackgroundColor` / `disabledColor` deprecated** — superseded by
  `disabledStyle.backgroundColor` / `disabledStyle.color`. Still honored as a
  fallback when `disabledStyle` is absent, so existing payloads are unaffected.

> **Backend note:** `onboarding-studio` should mirror the new `pressedStyle`,
> `disabledStyle`, and `transitionDurationMs` Button fields plus the shadow
> fields on `BaseBoxProps`, and surface per-state style editors. JSON
> serialization passes through unchanged.

---

## [1.23.0] - 2026-05-26

### Added

- **`renderWhen` on every UIElement variant** — optional
  `renderWhen?: LeafCondition | ConditionGroup` field on every entry of the
  `UIElement` discriminated union (Stack, Text, Image, Lottie, Rive, Icon,
  Video, Input, Button, RadioGroup, CheckboxGroup, DatePicker, Carousel,
  ZStack, SafeAreaView). Reuses the existing `LeafConditionSchema` /
  `ConditionGroupSchema` from `common.types` — no new condition types. When
  the condition evaluates falsy against current ComposableScreen variables,
  the runtime skips rendering the element and its entire subtree. Companion
  to `Button.disabledWhen` (visual disabled state) and `Branch.condition`
  (flow-level next-step selection); use `renderWhen` for in-screen
  conditional visibility (validation errors, variable-gated sections, etc.).

> **Backend note:** `onboarding-studio` should mirror the optional
> `renderWhen` field on every UIElement variant and surface a "Render when"
> condition picker in the element properties panel, reusing the Branch
> condition builder. JSON serialization passes through unchanged.

---

## [1.22.0] - 2026-05-11

### Added

- **`kind` on `ComposableVariableEntry`** — optional `"int" | "float" | "string"`
  tag on stored variables, exported as `ComposableVariableKind`. Drives
  expression-mode coercion for `setVariable` actions (numeric math vs string
  concat). Existing code paths ignore the tag, so back-compat is preserved.

> **Backend note:** `onboarding-studio` should optionally surface a `kind`
> field on `setVariable` actions and on any default variable seeding UI.

---

## [1.21.0] - 2026-05-11

### Added

- **`defaultIndex` and `variableName` on ComposableScreen `Carousel`** — new
  optional props on `CarouselElementProps`. `defaultIndex` (integer, ≥ 0,
  nullable) sets the initial page at mount. `variableName` binds the carousel
  index to a variable in the ComposableScreen variable store: `setVariable`
  button actions targeting that name scroll the carousel imperatively, and
  user swipes write the new index back to the variable so other elements
  (`Text` `{{var}}` interpolation, branching `evaluateCondition`) can react.
  Invalid / out-of-range values clamp to `[0, children.length - 1]`; missing
  / non-numeric values fall back to `defaultIndex ?? 0`.

> **Backend note:** `onboarding-studio` should mirror the `defaultIndex` and
> `variableName` fields on the Carousel UIElement schema and surface them in
> the CMS editor.

---

## [1.20.0] - 2026-05-11

### Added

- **`disabledWhen` on ComposableScreen `Button`** — new optional prop on
  `ButtonElementProps` accepting a `LeafCondition | ConditionGroup` (the
  same schema used by `Branch.condition`). When the condition evaluates
  truthy against current onboarding variables, the button blocks all
  press actions (continue, setVariable, custom) and renders in a disabled
  visual style.
- **`disabledBackgroundColor` and `disabledColor` on `Button`** — optional
  per-button overrides for the disabled-state colors. Defaults fall back to
  `theme.colors.disable` and `theme.colors.text.disable`.
- **`evaluateCondition`, `evaluateLeaf`, `isConditionGroup`, `Condition`**
  now exported from the package root so UI code (and host apps) can reuse
  the same condition runtime that powers branching.

> **Backend note:** `onboarding-studio` should mirror these `Button`
> schema fields and reuse the existing condition-builder UI from the
> `Branch.condition` editor.

---

## [1.19.0] - 2026-05-07

### Added

- **`fontFamily: "inherit"` on ComposableScreen `Text`/`Button`/`Input`** —
  `TextElementProps`, `ButtonElementProps`, and `InputElementProps` now type
  `fontFamily` as `string | "inherit"`. Omitting the prop or passing the
  literal `"inherit"` makes the renderer fall back to
  `theme.typography.defaultFontFamily`. Zod schemas remain
  `z.string().optional()` — the `"inherit"` literal is just a recognised
  string, no migration required for existing payloads.

> **Backend note:** The `onboarding-studio` server should surface
> `"inherit"` (or omission) as a first-class option when authoring
> Text/Button/Input `fontFamily` so CMS users can opt into the host app's
> default font.

---

## [1.18.0] - 2026-05-06

### Added

- **`fontStyle: "normal" | "italic"`** on Text-rendering ComposableScreen
  UIElements. Top-level prop on `TextElementProps`, `ButtonElementProps`,
  `InputElementProps`. Per-item prop `itemFontStyle` on
  `RadioGroupElementProps` and `CheckboxGroupElementProps`. All optional;
  Zod-validated as `z.enum(["normal", "italic"]).optional()`.
- **`setVariable` button action** — `Button.actions` accepts a new entry
  `{ type: "setVariable", name: string, value: string, label?: string }`
  that writes directly into the variable map. Useful to capture which
  branch a user chose before `"continue"` triggers `resolveNextStepNumber`.
  Stored shape matches existing element writes (`{ value, label }`).
- **`OnboardingProgressContext.getVariables()`** — synchronous getter that
  returns the latest variable snapshot from a ref. Use it inside
  `onContinue` handlers to feed `resolveNextStepNumber` with values just
  written by `setVariable`, since React state reads are stale within the
  same tick.

### Fixed

- **Branching with same-tick `setVariable` + `continue`** — variables were
  read from React state in the handler that just wrote them, so branch
  conditions evaluated against pre-set values and fell through to the
  default target. `setVariable` now updates a ref synchronously alongside
  the state setter; `getVariables()` exposes the fresh snapshot.

> **Backend note:** The `onboarding-studio` server must mirror the new
> `fontStyle` (and `itemFontStyle` for RadioGroup/CheckboxGroup) field on the
> affected UIElement schemas, and the new `setVariable` button action variant
> in the `ButtonAction` union and CMS editor.

---

## [1.17.1] - 2026-05-04

### Fixed

- **Runtime fonts manifest** — `registerFonts` now accepts the array shape
  returned by `onboarding-studio`
  (`{ family: [{ weight, style, url }, ...] }`) in addition to the legacy
  `{ family: { weightKey: url } }` map. Previously, iterating an array with
  `Object.entries` produced numeric indices (`"0".."N"`) as weight keys and
  passed the variant object as `url`, causing native expo-font to throw
  `loadSingleFontAsync expected resource of type Asset` and warnings like
  `Failed to load font "X" weight 8 from [object Object]`. The new
  `normalizeFamilyVariants` dedupes by weight and prefers `style: "normal"`
  variants over italic.

### Added

- **`FontVariantEntry`** and **`FontFamilyManifestInput`** exported types.
  `FontsManifest` widened to `Record<string, FontFamilyManifestInput>` so
  array-shape manifests are typed end-to-end.

---

## [1.17.0] - 2026-04-30

### Added

- **Runtime font download + load** — `Onboarding` response now accepts an
  optional top-level `fonts?: FontsManifest` field, where
  `FontsManifest = Record<string, Partial<Record<FontWeightKey, string>>>`.
  Font files are downloaded and registered via `expo-font` (optional peer
  dependency) when the onboarding payload is fetched. `FontWeightKey` accepts
  named (`regular`, `medium`, `semibold`, `bold`, `extrabold`) or numeric
  (`100`…`900`) keys, normalized internally.
- **`OnboardingProvider.fontsFallback?: ReactNode`** — rendered while the
  onboarding payload is fetched and remote fonts are downloading. Defaults to
  `null`.
- **`<FontLoaderGate fonts={...} fallback={...}>`** — standalone gate component
  that registers fonts and exposes a `FontRegistry` via context, for hosts that
  do not use `OnboardingProvider`.
- **`useFontRegistry()`** and **`useResolvedFontFamily(family, weight)`** hooks
  for resolving a `family + weight` request to the registered font name with a
  closest-weight fallback (CSS-style font matching).
- New exports: `FontWeightKey`, `FontFamilyManifest`, `FontsManifest`,
  `FontRegistry`, `registerFonts`, `resolveFontFamily`, `normalizeWeight`,
  `FontRegistryProvider`, `useFontRegistry`, `useResolvedFontFamily`,
  `FontLoaderGate`.

### Changed

- `OnboardingProvider` now wraps children in an internal `OnboardingDataGate`
  (`useQuery`) followed by `FontLoaderGate`, blocking render until the
  onboarding payload is fetched and any declared fonts finish loading. The
  previous `prefetchQuery` call is removed.

> **Backend note:** `onboarding-studio` should mirror the new `Onboarding.fonts`
> field — see the migration prompt in the PR description. ComposableScreen
> UIElement schemas are unchanged; this is an API-level addition.

---

## [1.16.0] - 2026-04-29

### Added

- **`Button.actions` ordered action array** — `ButtonElement.props` now accepts
  `actions?: ButtonAction[]`, where `ButtonAction = "continue" | { type: "custom"; function: string; variables?: string[] }`.
  Actions run sequentially on press; `await`s any returned Promise; aborts the
  remaining chain on a thrown error; `"continue"` is terminal.
- **`OnboardingProvider.customActions` prop** — `Record<string, CustomActionHandler>`
  where `CustomActionHandler = (args: { variables: Record<string, ComposableVariableEntry | undefined> }) => void | Promise<void>`.
  Functions are invoked by name from `Button.actions` `{ type: "custom", function, variables }`,
  receiving the requested variables filtered from the live ComposableScreen
  variable map.
- New exports: `ButtonAction`, `CustomButtonAction`, `ButtonActionSchema`,
  `CustomButtonActionSchema`, `CustomActionHandler`, `CustomActions`,
  `ComposableVariableEntry`.

### Changed

- `Button.action?: "continue"` is now **deprecated** but still accepted as a
  back-compat alias. When `actions` is absent and `action === "continue"`,
  runtime treats it as `actions: ["continue"]`. CMS payloads should migrate to
  `actions`.

> **Backend note:** The `onboarding-studio` server must mirror the new
> `Button.actions` field in its `ComposableScreen` UIElement schema (Zod) and
> CMS editor (ordered list of `"continue"` or
> `{ type: "custom"; function: string; variables?: string[] }`). The legacy
> `action` field should be kept readable for historical payloads.

---

## [1.15.0] - 2026-04-28

### Added

- **`SafeAreaView` UIElement** — new container element mirroring
  `react-native-safe-area-context`'s `SafeAreaView`. Props: `mode?: "padding" | "margin"`,
  `edges?` accepting either `("top" | "right" | "bottom" | "left")[]` or a per-edge
  object mapping each edge to `"off" | "additive" | "maximum"`. Extends `BaseBoxProps`.
  Exports: `SafeAreaViewElementProps`, `SafeAreaEdge`, `SafeAreaEdgeMode`,
  `SafeAreaViewElementPropsSchema`.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> validate the new `"SafeAreaView"` element type in the `ComposableScreen`
> UIElement union. Mirror `SafeAreaViewElementPropsSchema` (with the strict
> per-edge object) in the backend validation layer and add `SafeAreaView` to the
> CMS editor element-type picker. Run the schema-sync/publish process in
> `onboarding-studio` (regenerate Zod schemas, bump validator package, deploy)
> before publishing this SDK release so CI and runtime payloads do not drift.

---

## [1.14.0] - 2026-04-28

### Added

- **`ZStack` UIElement** — new container type that stacks children on top of each
  other using absolute positioning. Props: all `BaseBoxProps` fields (width,
  height, padding, borderRadius, overflow, backgroundGradient, etc.). Children
  fill the container bounds by default, enabling image-with-overlay patterns.
  `ZStackElementProps` and `ZStackElementPropsSchema` exported from the headless
  package.

---

## [1.13.1] - 2026-04-28

### Added

- **`ZStack` UIElement** — new container type that stacks children on top of each
  other using absolute positioning. Props: all `BaseBoxProps` fields (width,
  height, padding, borderRadius, overflow, backgroundGradient, etc.). Children
  fill the container bounds by default, enabling image-with-overlay patterns.
  `ZStackElementProps` and `ZStackElementPropsSchema` exported from the headless
  package.

---

## [1.13.0] - 2026-04-28

### Added

- **`backgroundGradient` on `BaseBoxProps`** — all UIElement types now accept an
  optional `backgroundGradient` prop alongside `backgroundColor`. Accepts a
  `GradientBackground` discriminated union (currently `type: "linear"`).

- **`LinearGradientConfig`** — linear gradient config: `from` and `to` are named
  `GradientEdge` positions (`"top"`, `"bottom"`, `"left"`, `"right"`, `"topLeft"`,
  `"topRight"`, `"bottomLeft"`, `"bottomRight"`); `stops` is an array of
  `{ color: string; position?: number }` (min 2 stops, position 0–1).

- **Exports** — `GradientBackground`, `GradientEdge`, `GradientStop`,
  `LinearGradientConfig`, and `GradientBackgroundSchema` exported from the
  headless package.

---

## [1.12.0] - 2026-04-28

### Added

- **Multi-path branching** — every step schema now includes a `nextStep` field
  (nullable, defaults to `null`). When `null`, navigation proceeds linearly.
  When set, an ordered list of `branches` is evaluated; the first matching branch
  wins and navigation jumps to `branch.targetStepId`. If no branch matches,
  `defaultTargetStepId` is used as a fallback; if that is absent or unresolved,
  linear progression applies.

- **`Branch.condition` nullable** — a `null` condition on a branch is treated as
  unconditional (always matches). Useful as a final catch-all entry after guarded
  branches.

- **Condition schema** — `LeafConditionSchema`, `ConditionGroupSchema`,
  `BranchSchema`, and `NextStepSchema` added to `common.types.ts` and exported
  from the package. Supported operators: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`,
  `contains`, `in`, `not_in`. Conditions nest recursively via `ConditionGroup`
  (`logic: "and" | "or"`, `conditions: Array<LeafCondition | ConditionGroup>`).
  `ConditionValueSchema` accepts `string | number | boolean | Array<string | number | boolean>`.

- **`BaseStepTypeSchema`** — all per-step Zod schemas now extend a single shared
  base (`id`, `name`, `displayProgressHeader`, `customPayload`,
  `continueButtonLabel`, `buttonSection`, `figmaUrl`, `nextStep`) via `.extend()`.
  Previously each schema declared these fields independently.

- **`variableName` on `Question` and `Picker`** — optional `z.string().min(1)`
  field. When set, the answer selected on that step is stored in the global
  variable store under this key and becomes available to branch conditions on
  subsequent steps.

- **Variable store** — `OnboardingProgressContext` gains `variables:
  Record<string, any>` and `setVariable(name, value)`. The store is written by
  the host app's `onContinue` handler and read by `resolveNextStepNumber`.

- **`resolveNextStepNumber(currentStep, variables, steps)`** — new exported pure
  function. Returns the 1-indexed step number to navigate to, or `null` when the
  flow ends. Resolution order: matching branch → `defaultTargetStepId` → linear
  next → `null`. Self-referencing targets (branch or default pointing back to the
  current step) are silently skipped to prevent infinite-loop routing.

- **`evaluateCondition` module** — pure condition-evaluation logic extracted to
  `src/evaluateCondition.ts` with no domain dependencies. Exports
  `evaluateLeaf`, `evaluateCondition`, `isConditionGroup`, and the `Condition`
  type.

- **Test suite** — Vitest added as a dev dependency. 75 tests across
  `evaluateCondition.test.ts` and `resolveNextStepNumber.test.ts` covering all
  operators, AND/OR nesting up to 3 levels, branch ordering, unconditional
  branches, `defaultTargetStepId` fallback, self-loop guard, and edge cases.

### Changed

- `NextStepSchema.branches` now defaults to `[]` — omitting `branches` from a
  `nextStep` object is valid; callers can set only `defaultTargetStepId`.

---

## [1.11.1] - 2026-04-27

### Changed

- **`BaseBoxProps` expanded** — all UIElement schemas now inherit `minWidth`,
  `maxWidth`, `minHeight`, `maxHeight`, `flexShrink`, `flexGrow`, `backgroundColor`,
  and `overflow` from the base. Previously these were missing or inconsistently
  defined per element.

- **`StackElement` (`YStack` / `XStack`) props** — now correctly extends
  `BaseBoxProps` instead of declaring `width`/`height` as number-only standalone
  fields. `width` and `height` now accept `number | string` (e.g. `"100%"`).
  Stack-specific props retained: `gap`, `alignItems`, `justifyContent`, `flexWrap`.

- **`TextElement` props** — now correctly extends `BaseBoxProps` instead of
  duplicating margin/padding/border fields. Text-specific props retained: `content`,
  `mode`, `fontSize`, `fontWeight`, `fontFamily`, `color`, `textAlign`,
  `letterSpacing`, `lineHeight`.

- **`InputElement` props** — added `fontFamily`, `lineHeight`, `letterSpacing`.

- **`ButtonElement` props** — removed redundant `alignSelf` override (now inherited
  from `BaseBoxProps` with the full enum).

- **`RiveElement` props** — renamed `autoplay` → `autoPlay` (consistent casing with
  all other elements).

- **`CarouselElement` props** — added dot style props: `dotColor`, `activeDotColor`,
  `dotWidth` (default `20`), `dotHeight` (default `4`), `dotsGap` (default `8`),
  `dotsMarginTop` (default `12`).

---

## [1.11.0] - 2026-04-24

### Added

- **`Carousel` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Carousel"`. Takes `children: UIElement[]` — any renderable
  UIElement tree as slide content (same recursive system as `YStack`/`XStack`).
  Props: `carouselType` (`"normal"` | `"left-align"` | `"parallax"` | `"stack"`,
  default `"normal"`), `autoPlay` (boolean, default `false`), `autoPlayInterval`
  (number ms, default `3000`), `loop` (boolean, default `true`), `showDots`
  (boolean, default `true`), `height` (number, optional), plus all `BaseBoxProps`.
  Validated by `CarouselElementPropsSchema` (Zod). Exports `CarouselElementProps`
  type.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `Carousel` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `CarouselElementPropsSchema` in the backend validation layer and add `Carousel`
> to the CMS element-type picker.

---

## [1.10.0] - 2026-04-23

### Added

- **`DatePicker` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "DatePicker"`. Props: `variableName` (string, optional — context
  key; selected date written as ISO 8601 string), `defaultValue` (ISO string, optional),
  `minimumDate` / `maximumDate` (ISO strings, optional), `mode`
  (`"date"` | `"time"` | `"datetime"`, default `"date"`), `display`
  (`"default"` | `"spinner"` | `"calendar"` | `"clock"` | `"compact"` | `"inline"`,
  optional — platform-specific), `textColor`, `accentColor`, `locale` (strings,
  optional), plus all `BaseBoxProps`. Validated by `DatePickerElementPropsSchema` (Zod).

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `DatePicker` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `DatePickerElementPropsSchema` in the backend validation layer and add `DatePicker`
> to the CMS element-type picker.

---

## [1.9.0] - 2026-04-22

### Added

- **`CheckboxGroup` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "CheckboxGroup"`. Props: `variableName` (string, optional —
  context key; selected values written as a JSON `string[]`), `items`
  (`Array<{ label: string; value: string }>`, required, min 1), `defaultValues`
  (`string[]`, optional — must reference valid item values), `gap` (number),
  `direction` (`"vertical"` | `"horizontal"`), per-item styling
  (`itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`,
  `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`, `itemColor`,
  `itemSelectedColor`, `itemFontSize`, `itemFontWeight`, `itemFontFamily`,
  `itemPadding`, `itemPaddingHorizontal`, `itemPaddingVertical`), plus all
  `BaseBoxProps`. Validated by `CheckboxGroupElementPropsSchema` (Zod); includes
  `superRefine` checks for unique item values and valid `defaultValues` entries
  (per-index error paths).

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `CheckboxGroup` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `CheckboxGroupElementPropsSchema` in the backend validation layer and add `CheckboxGroup`
> to the CMS element-type picker.

---

## [1.8.1] - 2026-04-22

### Added

- **`alignSelf` prop on `BaseBoxProps`** — available on all elements that extend `BaseBoxProps` (`Input`, `RadioGroup`, `Image`, `Lottie`, `Rive`, `Icon`, `Video`). Accepts `"auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline"`.

### Changed

- **`alignSelf` on `StackElement`** — `StackElementProps` and `StackElementPropsSchema` now include `alignSelf` (same enum) in addition to the existing `alignItems`.

---

## [1.8.0] - 2026-04-21

### Added

- **`Button` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Button"`. Props: `label` (string, **required**, non-empty),
  `action` (`"continue"`, optional — defaults to calling `onContinue`), `variant`
  (`"filled"` | `"outlined"` | `"ghost"`), `backgroundColor`, `color`, `fontSize`,
  `fontWeight`, `fontFamily`, `textAlign`, `alignSelf`, plus all `BaseBoxProps`.
  Validated by `ButtonElementPropsSchema` (Zod).
- **`RadioGroup` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "RadioGroup"`. Renders a group of radio options from an inline
  `items: Array<{ label: string; value: string }>` array. Props: `variableName`
  (string, optional — context key), `defaultValue`, `gap`, `direction`
  (`"vertical"` | `"horizontal"`), all `BaseBoxProps`, and per-item styling
  (`itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`,
  `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`, `itemColor`,
  `itemSelectedColor`, `itemFontSize`, `itemFontWeight`, `itemFontFamily`,
  `itemPadding`, `itemPaddingHorizontal`, `itemPaddingVertical`). Validated by
  `RadioGroupElementPropsSchema` (Zod).
- **Structured variable entries** — `ComposableVariableEntry` type introduced:
  `{ value: string; label?: string }`. The `composableVariables` context map is now
  `Record<string, ComposableVariableEntry>` instead of `Record<string, string>`.
  `RadioGroup` writes both `value` (raw) and `label` (human-readable) when an item
  is selected. Expression interpolation in `Text` elements resolves `label` first,
  falling back to `value`.

> **Note on semver:** The `composableVariables` type changed from
> `Record<string, string>` to `Record<string, ComposableVariableEntry>`. This is
> published as a minor bump (not major) because `composableVariables` is an internal
> context value not part of the public API contract. Existing consumers remain
> unaffected — access `.value` on the entry for the same string result.

### Changed (internal)

- `ComposableScreen` element types and Zod schemas split into `elements/` subfolder —
  one file per element type. `types.ts` now assembles the `UIElement` union and
  `UIElementSchema` by importing individual schemas.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `RadioGroup` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `RadioGroupElementPropsSchema` in the backend validation layer and add `RadioGroup`
> to the CMS element-type picker.

---

## [1.7.0] - 2026-04-21

### Added

- **`fontFamily` prop on `Text` UIElement** — optional `fontFamily?: string` added
  to the `Text` variant of `UIElement` and to `TextElementPropsSchema` (Zod).
  Pass any font family name loaded via `expo-font` (or a system font) to apply a
  custom typeface to a text node.

> **Backend note:** The `onboarding-studio` server should be updated to accept
> and emit `fontFamily` on `Text` UIElement props, and to expose a font-family
> input in the CMS text-element editor.

---

## [1.6.0] - 2026-04-21

### Added

- **`Input` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Input"`. Renders a `<TextInput>` that writes its value
  into shared context via `variableName`. Props: `variableName` (string, optional
  — context key), `placeholder`, `placeholderColor`, `defaultValue`,
  `keyboardType`, `returnKeyType`, `autoCapitalize`, `secureTextEntry`,
  `maxLength`, `multiline`, `numberOfLines`, `editable`, plus typography and
  layout props (`color`, `fontSize`, `textAlign`, `padding*`) and all
  `BaseBoxProps` (`backgroundColor`, `borderWidth`, `borderRadius`, `borderColor`,
  `width`, `height`, `opacity`, `margin*`). Validated by
  `InputElementPropsSchema` (Zod).
- **Variable context** — `OnboardingProgressContext` now holds
  `composableVariables: Record<string, string>` and `setComposableVariable`.
  Values written by `Input` elements survive navigation between
  `ComposableScreen` steps.
- **Expression mode for `Text` elements** — `mode?: "plain" | "expression"`
  prop added to `TextElementPropsSchema`. When `"expression"`, `{{variableName}}`
  patterns in `content` are interpolated from `composableVariables` at render
  time. Default (`"plain"`) is unchanged.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `Input` `UIElement` variant in `ComposableScreen` payloads, and to
> support the `mode` prop on `Text` elements. Mirror `InputElementPropsSchema`
> and the updated `TextElementPropsSchema` in the backend validation layer and
> add `Input` to the CMS element-type picker.

---

## [1.5.0] - 2026-04-21

### Added

- **`Icon` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Icon"`. Props: `name` (string, **required** — Lucide icon
  name), `size` (number), `color` (string), `strokeWidth` (number), plus all
  `BaseBoxProps`. Validated by `IconElementPropsSchema` (Zod).
- **`Video` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Video"`. Props: `url` (string, **required**), `autoPlay`
  (boolean), `loop` (boolean), `muted` (boolean), `controls` (boolean), plus all
  `BaseBoxProps`. Validated by `VideoElementPropsSchema` (Zod).

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit `Icon` and `Video` `UIElement` variants in `ComposableScreen` payloads.
> Mirror `IconElementPropsSchema` and `VideoElementPropsSchema` in the backend
> validation layer and add both types to the CMS element-type picker.

---

## [1.4.0] - 2026-04-21

### Added

- **`Lottie` UIElement** for `ComposableScreen` — renders a Lottie animation
  from a remote JSON URL via `lottie-react-native` (optional peer dep). Supports
  `source` (required), `autoPlay`, `loop`, `speed`, and all `BaseBoxProps`
  (`width`, `height`, `opacity`, `margin*`, `padding*`, `border*`).
- **`Rive` UIElement** for `ComposableScreen` — renders a Rive animation from a
  remote `.riv` URL via `rive-react-native` (optional peer dep). Supports `url`
  (required), `autoplay`, `fit`, `alignment`, `artboardName`,
  `stateMachineName`, and all `BaseBoxProps`.

### Changed

- **`BaseBoxProps` refactor** — `width`, `height`, `opacity`, `margin*`,
  `padding*`, `borderWidth`, `borderRadius`, and `borderColor` are now defined
  once in a shared `BaseBoxProps` type and `BaseBoxPropsSchema`, then extended by
  `Image`, `Lottie`, and `Rive` element schemas. Stack and Text schemas are
  unchanged.

---

## [1.3.0] - 2026-04-17

### Added

- **`Image` UIElement** for `ComposableScreen` — renders a remote image via
  React Native `<Image>`. Supports `url` (required), `width`, `height`,
  `aspectRatio`, `resizeMode` (`cover` | `contain` | `stretch` | `center`),
  `borderRadius`, `borderWidth`, `borderColor`, `opacity`, and all margin /
  padding shorthand props.
- `aspectRatio` prop on `Image` elements — applied as a size fallback when
  `height` is omitted; defaults to `16/9` so images never collapse to zero
  height.

---

## [1.2.0]

### Added

- **ComposableScreen** _(under development)_ — new step type that defines a
  declarative UI element tree (`YStack`, `XStack`, `Text`) driven entirely from
  the CMS. The `UIElement` type and its Zod schema now support the following
  props on stack elements: `borderWidth`, `borderRadius`, `borderColor`,
  `overflow`, `opacity`, `margin`, `marginHorizontal`, `marginVertical`,
  `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`. Text
  elements gain `margin`, `marginHorizontal`, `marginVertical`, `borderWidth`,
  `borderRadius`, `borderColor`, and `opacity`.

> **Note:** `ComposableScreen` is under active development. The schema may
> change before it is considered stable.
