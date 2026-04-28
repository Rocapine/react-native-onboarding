# Changelog

All notable changes to `@rocapine/react-native-onboarding` are documented here.

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
