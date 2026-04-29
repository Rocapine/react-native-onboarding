# Changelog

All notable changes to `@rocapine/react-native-onboarding-ui` are documented
here.

---

## [1.16.0] - 2026-04-29

### Added

- **Button `actions` execution** — `ButtonElement` now runs the headless
  `ButtonAction[]` chain on press: sequential, `await`s async handlers,
  warns on missing handler, aborts on thrown error, `"continue"` is terminal.
- **`customActions` plumbing** — `RenderContext` exposes `customActions` to
  every ComposableScreen element. `ComposableScreenRenderer` reads them from
  the headless `OnboardingProgressContext` (set via
  `<OnboardingProvider customActions={...}>`).
- Re-exports `ButtonAction`, `CustomButtonAction`, `CustomActionHandler`,
  `CustomActions`, `ComposableVariableEntry` from the headless package.

### Changed

- `ComposableVariableEntry` is now sourced from the headless package
  (`@rocapine/react-native-onboarding`); the UI provider re-exports it.
  Existing imports from `OnboardingProgressProvider` continue to work.

---

## [1.15.0] - 2026-04-28

### Added

- **`SafeAreaView` UIElement renderer** — new `SafeAreaViewElementComponent` that
  delegates to `SafeAreaView` from `react-native-safe-area-context`. Forwards
  `mode` and `edges` (array or per-edge object) and applies `BaseBoxProps`
  styling.

### Changed

- **`OnboardingTemplate` no longer applies safe-area insets.** The template
  previously read `useSafeAreaInsets()` and added `paddingTop`/`paddingBottom`.
  Renderers now own safe-area handling: `Carousel`, `Commitment`, `Loader`,
  `MediaContent`, `Picker`, `Question`, and `Ratings` wrap their content with
  `<SafeAreaView edges={["top", "bottom"]}>`. The `ComposableScreen` renderer
  intentionally does **not** wrap — author safe-area placement using the new
  `SafeAreaView` UIElement so screens can render edge-to-edge backgrounds.
- The progress-header offset (40px) remains in `OnboardingTemplate` as plain
  padding, no longer combined with the top inset.

---

## [1.14.0] - 2026-04-28

### Added

- **`ZStack` UIElement renderer** — new `ZStackElementComponent` that renders
  children layered on top of each other. Each child is wrapped in
  `position: "absolute"` filling the container, enabling image-with-text-overlay
  and other depth-compositing patterns. Supports all `BaseBoxProps` including
  `backgroundGradient` via `GradientBox`.

---

## [1.13.1] - 2026-04-28

### Added

- **`ZStack` UIElement renderer** — new `ZStackElementComponent` that renders
  children layered on top of each other. Each child is wrapped in
  `position: "absolute"` filling the container, enabling image-with-text-overlay
  and other depth-compositing patterns. Supports all `BaseBoxProps` including
  `backgroundGradient` via `GradientBox`.

---

## [1.13.0] - 2026-04-28

### Added

- **Gradient backgrounds on all `ComposableScreen` elements** — every element
  that renders a container (`YStack`, `XStack`, `Icon`, `Image`, `Text`,
  `Button`, `Lottie`, `Video`, `RadioGroup`, `CheckboxGroup`, `Carousel`,
  `DatePicker`) now respects `backgroundGradient` from `BaseBoxProps`.

- **`GradientBox` component** — internal utility that wraps `expo-linear-gradient`
  (`LinearGradient`) when the library is installed, falling back to a plain `View`
  silently when it is not. All element renderers delegate their outer container to
  `GradientBox`.

- **`expo-linear-gradient` optional peer dependency** — install it to enable
  gradient rendering; omitting it degrades gracefully to a solid background.

- **Linear gradient API** — `backgroundGradient: { type: "linear", from: GradientEdge,
  to: GradientEdge, stops: GradientStop[] }`. `GradientEdge` is one of 8 named
  positions (`"top"`, `"bottom"`, `"left"`, `"right"`, `"topLeft"`, `"topRight"`,
  `"bottomLeft"`, `"bottomRight"`). Stops support optional explicit `position`
  (0–1); when all stops declare a position, `locations` is passed to
  `LinearGradient`.

### Fixed

- **`figmaUrl` type in `ComposableScreen` step schema** — changed from `.nullable()`
  to `.nullish()` to align with all other page-type schemas and the headless SDK.

---

## [1.12.0] - 2026-04-28

### Changed

- **`ComposableScreen` element variable sync** — when a `ComposableScreen`
  element with a `variableName` (e.g. `Input`, `RadioGroup`, `DatePicker`,
  `CheckboxGroup`) changes its value, the change is now written to both the
  UI-layer `composableVariables` store (drives `{{interpolation}}` within the
  current screen) and the headless `variables` store
  (`OnboardingProgressContext.setVariable`). This makes composable element
  answers available to `resolveNextStepNumber` branch conditions on subsequent
  steps.

---

## [1.11.1] - 2026-04-27

### Changed

- **All element renderers** updated to apply the full expanded `BaseBoxProps`:
  `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `flexShrink`, `flexGrow`,
  `backgroundColor`, `overflow` are now wired into every element's style output.

- **`dim()` helper added** (`shared.ts`) — casts `number | string` width/height
  values to React Native's `DimensionValue`, enabling percentage strings (e.g.
  `"100%"`) across all elements.

- **`StackElement` renderer** — applies `flexGrow`, all new `BaseBoxProps` layout
  props. `width`/`height` now support percentage strings.

- **`TextElement` renderer** — applies `flex`, `flexShrink`/`flexGrow`, `alignSelf`,
  `width`/`height` (via `dim()`), `minWidth`/`maxWidth`/`minHeight`/`maxHeight`,
  `overflow`.

- **`InputElement` renderer** — applies `fontFamily`, `lineHeight`, `letterSpacing`;
  also `flex`, `flexShrink`/`flexGrow`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`,
  `overflow`.

- **`ButtonElement` renderer** — `alignSelf` now uses the complete enum from
  `BaseBoxProps`.

- **`RiveElement` renderer** — prop renamed `autoplay` → `autoPlay` (schema-level
  rename; the underlying `rive-react-native` library still receives `autoplay`).

- **`CarouselElement` renderer** — `Pagination.Basic` now driven by dot style props:
  `dotColor`, `activeDotColor`, `dotWidth`, `dotHeight`, `dotsGap`, `dotsMarginTop`.

- **`IconElement`, `LottieElement`, `VideoElement` renderers** — apply `flex`,
  `flexShrink`/`flexGrow`, `alignSelf`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`.

---

## [1.11.0] - 2026-04-24

### Added

- **`Carousel` element renderer** — renders `Carousel` UIElements using
  `react-native-reanimated-carousel` (now a **required** peer dependency). Each slide
  is a `UIElement` subtree rendered by the same recursive engine as `YStack`/`XStack`,
  giving full layout flexibility per slide. Four modes via `carouselType`:
  - `"normal"` — full-width paged carousel (default)
  - `"parallax"` — depth-zoom effect using library `mode="parallax"`
  - `"stack"` — stacked cards at 75 % window width via `mode="horizontal-stack"`
  - `"left-align"` — peek effect at 82 % window width with `overflow: "visible"`

  Pagination uses `Pagination.Basic` from the library: animated pill dots in theme
  `primary` / `neutral.low` colors, tappable to jump to any slide. `autoPlay`
  defaults to `false`; `loop` defaults to `true`; `showDots` defaults to `true`.
  Width defaults to `useWindowDimensions().width`; height defaults to `220 px`. All
  `BaseBoxProps` applied to the outer container.

---

## [1.10.0] - 2026-04-23

### Added

- **`DatePicker` element renderer** — renders `DatePicker` UIElements using
  `@react-native-community/datetimepicker` (new optional peer dependency). On mount,
  initialises the variable from `defaultValue` (or today if omitted) as
  `{ value: ISO string, label: locale-formatted string }`. On change, updates the
  same variable; the `label` is human-readable (e.g. `"Apr 23, 2026"` for `mode: "date"`).
  Supports `minimumDate`, `maximumDate`, `mode` (`date` / `time` / `datetime`),
  `display` (platform-specific — iOS defaults to `"spinner"`, Android to `"default"`),
  `textColor`, `accentColor`, `locale`, and all `BaseBoxProps` for the wrapping
  container.

---

## [1.9.0] - 2026-04-22

### Added

- **`CheckboxGroup` element renderer** — renders `CheckboxGroup` UIElements as a
  vertical (default) or horizontal list of tappable checkbox items. Each item shows
  a square checkbox indicator and a label; tapping toggles the item's value in/out
  of the selected set. On mount, sets `defaultValues` into `composableVariables` (keyed
  by `variableName`) as `{ value: JSON.stringify(string[]), label: string }`.
  Subsequent toggles update the same entry. Supports all per-item style props
  (`itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`,
  `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`, `itemColor`,
  `itemSelectedColor`, `itemFontSize`, `itemFontWeight`, `itemFontFamily`,
  `itemPadding`, `itemPaddingHorizontal`, `itemPaddingVertical`), `gap`,
  `direction`, and all `BaseBoxProps` for the group container.

---

## [1.8.1] - 2026-04-22

### Added

- **`alignSelf` on all `BaseBoxProps` elements** — `Input`, `RadioGroup`, `Image`, `Lottie`, `Rive`, `Icon`, and `Video` renderers now pass `alignSelf` from props to their root style. Accepts `"auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline"`.
- **`alignSelf` on `StackElement`** — `YStack` / `XStack` root `View` now applies `alignSelf` from props.

### Fixed

- **`InputElement` flattened to bare `<TextInput>`** — removed the wrapping `<View>` so `alignSelf`, `width`, `height`, and other layout props apply directly to the input rather than a container. All style props previously split between the wrapper and the inner `TextInput` are now on the single `TextInput`.
- **`RadioGroup` item text collapse** — replaced `flex: 1` with `flexShrink: 1` on the label `<Text>` inside each radio item. Prevents Yoga from collapsing the text when the item is inside an `XStack`.

---

## [1.8.0] - 2026-04-21

### Added

- **`Button` element renderer** — renders `Button` UIElements as a
  `<TouchableOpacity>`. Supports three variants: `filled` (solid primary
  background), `outlined` (transparent background with border), and `ghost`
  (no background or border). Tapping calls `onContinue` when `action` is
  `"continue"` or unset; other future action values are no-ops. Supports
  `label`, `variant`, `backgroundColor`, `color`, `fontSize`, `fontWeight`,
  `fontFamily`, `textAlign`, `alignSelf`, and all `BaseBoxProps`.
- **`RadioGroup` element renderer** — renders `RadioGroup` UIElements as a
  vertical (default) or horizontal list of tappable radio items, each with a
  circular indicator. Reads/writes the selected value via `composableVariables`
  (keyed by `variableName`). On mount, sets the `defaultValue` entry including
  the matching item's human-readable `label`. Supports all per-item style props
  (`itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`,
  `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`, `itemColor`,
  `itemSelectedColor`, `itemFontSize`, `itemFontWeight`, `itemFontFamily`,
  `itemPadding`, `itemPaddingHorizontal`, `itemPaddingVertical`) and all
  `BaseBoxProps` for the group container.
- **Structured variable entries** — `composableVariables` is now
  `Record<string, ComposableVariableEntry>` where
  `ComposableVariableEntry = { value: string; label?: string }`. `RadioGroup`
  stores `{ value, label }` on selection; `Input` stores `{ value }`. Expression
  interpolation in `Text` elements resolves `label ?? value`, so
  `{{variableName}}` on a radio-backed variable displays the human-readable
  label (e.g. `"Monthly"`) instead of the raw value (e.g. `"monthly"`).

> **Note on semver:** The `composableVariables` type changed from
> `Record<string, string>` to `Record<string, ComposableVariableEntry>`. This is
> a technically breaking change to the context shape, but is published as a minor
> bump because `composableVariables` is an internal context value (not part of the
> public API contract). Existing consumers that only read the value string via
> `variables[key]` remain unaffected — access `.value` for the same result.

### Changed (internal)

- `ComposableScreen` element components and types split into `elements/`
  subfolder — one file per element. `Renderer.tsx` reduced from 630 to 58 lines;
  `types.ts` from 443 to 173 lines. A `RenderContext` object replaces the five
  individual parameters previously threaded through `renderElement`.

---

## [1.7.0] - 2026-04-21

### Added

- **`fontFamily` support on `Text` elements** — the `Text` renderer now passes
  `fontFamily` from element props directly to the React Native `<Text>` style.
  Any font family loaded by the host app (e.g. via `expo-font`) can be applied
  to a text node by setting `fontFamily` in its props.

---

## [1.6.0] - 2026-04-21

### Added

- **`Input` element renderer** — renders `Input` UIElements as a styled
  `<TextInput>`. Supports all text input props (`placeholder`, `placeholderColor`,
  `defaultValue`, `keyboardType`, `returnKeyType`, `autoCapitalize`,
  `secureTextEntry`, `maxLength`, `multiline`, `numberOfLines`, `editable`) plus
  typography (`color`, `fontSize`, `textAlign`, `padding*`) and `BaseBoxProps`
  (`backgroundColor`, `borderWidth`, `borderRadius`, `borderColor`, `width`,
  `height`, `opacity`, `margin*`).
- **Variable context** — `OnboardingProgressContext` extended with
  `composableVariables: Record<string, string>` and `setComposableVariable`.
  `Input` elements write their value into this shared map on every keystroke
  (keyed by `variableName`). Values survive navigation between `ComposableScreen`
  steps because the context lives above the router.
- **Expression interpolation for `Text` elements** — when `mode: "expression"`,
  `{{variableName}}` patterns in `content` are replaced with values from
  `composableVariables` at render time. Default `mode: "plain"` is unchanged.
- **`OnboardingProgressProvider` and `OnboardingProgressContext`** exported from
  the package's public API so host apps can wrap their root layout with the
  provider.

### Fixed

- `InputElementComponent` no longer subscribes to `OnboardingProgressContext`
  directly; `setComposableVariable` is threaded as a stable prop through
  `renderElement` instead, preventing context-driven re-renders from stealing
  `TextInput` focus on every keystroke.
- `ComposableScreenStepTypeSchema.parse(step)` is now wrapped in `useMemo`
  so the `elements` array reference is stable across context-driven re-renders.
- `ScrollView` in `ComposableScreenRenderer` now uses
  `keyboardShouldPersistTaps="handled"` so a first tap on an `Input` inside a
  `ScrollView` correctly focuses the field rather than being swallowed.

---

## [1.5.0] - 2026-04-21

### Added

- **`Icon` element renderer** — renders `Icon` UIElements using
  `lucide-react-native` (bundled, no extra install needed). Supports `name`,
  `size`, `color`, `strokeWidth`, and all `BaseBoxProps`. Unknown icon names
  render nothing rather than crashing.
- **`Video` element renderer** — renders `Video` UIElements via `expo-video`
  (optional peer dep). Supports `url`, `autoPlay`, `loop`, `muted`, `controls`,
  and all `BaseBoxProps`. Shows an install-hint placeholder if `expo-video` is
  absent. `expo-video` added as optional peer dependency.

---

## [1.4.0] - 2026-04-21

### Added

- **`Lottie` element renderer** — renders `Lottie` UIElements via
  `lottie-react-native`. The package is an optional peer dep; if absent a
  placeholder view with an install hint is shown instead of crashing. Supports
  `source`, `autoPlay`, `loop`, `speed`, and all `BaseBoxProps`.
- **`Rive` element renderer** — renders `Rive` UIElements via
  `rive-react-native` (optional peer dep with same graceful fallback). Supports
  `url`, `autoplay`, `fit`, `alignment`, `artboardName`, `stateMachineName`, and
  all `BaseBoxProps`.

### Changed

- **`BaseBoxProps` refactor** — `width`, `height`, `opacity`, `margin*`,
  `padding*`, `borderWidth`, `borderRadius`, and `borderColor` are now defined
  once in a shared `BaseBoxProps` type and `BaseBoxPropsSchema`, then extended by
  `Image`, `Lottie`, and `Rive` element schemas.

### Fixed

- `borderWidth`, `borderRadius`, and `borderColor` on `Lottie` and `Rive`
  elements now render correctly. Both native canvas components are wrapped in a
  `View` with `overflow: hidden` so border styles are applied by the wrapper
  rather than the animation view directly.

---

## [1.3.0] - 2026-04-17

### Added

- **`Image` UIElement renderer** for `ComposableScreen` — maps `Image` nodes to
  React Native `<Image>` with full prop pass-through: `url`, `width`, `height`,
  `aspectRatio`, `resizeMode`, `borderRadius`, `borderWidth`, `borderColor`,
  `opacity`, and all margin / padding shorthand props.
- `aspectRatio` fallback on `Image` — when `height` is not provided, the
  renderer applies `aspectRatio` (explicit value or `16/9` default) so the
  image is always visible.

### Fixed

- Removed unused `useSafeAreaInsets` import and call from
  `ComposableScreenRenderer` (safe area is handled by `OnboardingTemplate`).

---

## [1.2.0]

### Added

- **ComposableScreen renderer** _(under development)_ — renders the new
  `ComposableScreen` step type by recursively walking a `UIElement` tree and
  mapping each node to a native `View` or `Text`. The renderer now passes
  through all new layout props added in this release: `borderWidth`,
  `borderRadius`, `borderColor`, `overflow`, `opacity`, `margin`,
  `marginHorizontal`, `marginVertical`, `width`, `height`, `minWidth`,
  `maxWidth`, `minHeight`, `maxHeight` on stack elements; `margin`,
  `marginHorizontal`, `marginVertical`, `borderWidth`, `borderRadius`,
  `borderColor`, and `opacity` on text elements.
- `packages/onboarding-ui/README.md` — new README documenting the UI package,
  the `ComposableScreen` element tree API, and its supported props.

> **Note:** `ComposableScreen` is under active development. The renderer and
> element schema may change before they are considered stable.
