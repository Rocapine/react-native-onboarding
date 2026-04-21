# Changelog

All notable changes to `@rocapine/react-native-onboarding-ui` are documented
here.

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
