# Changelog

All notable changes to `@rocapine/react-native-onboarding` are documented here.

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
