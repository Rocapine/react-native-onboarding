# Changelog

All notable changes to `@rocapine/react-native-onboarding` are documented here.

---

## [Unreleased]

---

## [1.51.1] - 2026-06-22

### Changed

- **Version parity bump.** No headless SDK changes; released to stay in lockstep with `@rocapine/react-native-onboarding-ui` 1.51.1 (UI-only fix: centered RadioGroup/CheckboxGroup item labels).

---

## [1.51.0] - 2026-06-19

### Added

- **`RadioGroup` / `CheckboxGroup` per-item `image`.** Each `items[]` entry accepts an optional `image: { url, width?, height?, aspectRatio?, resizeMode?, borderRadius? }`, rendered above the label/sub-label as a column (image → label → subLabel). Validated in both step schemas (empty `url` and invalid `resizeMode` rejected).
- **`RadioGroup` / `CheckboxGroup` item layout props.** New group-level `itemAlignItems` (`"flex-start" | "center" | "flex-end" | "stretch"`, default `"center"`) controls the cross-axis alignment of each item's contents, and `itemGap` (number, default `12`) controls the spacing between an item's inner pieces (tick ↔ content, image ↔ text).

---

## [1.50.1] - 2026-06-19

### Changed

- **Version parity bump.** No functional changes to the headless SDK; released alongside `@rocapine/react-native-onboarding-ui` 1.50.1 (UI-only `RadioGroup` / `CheckboxGroup` tick-at-end layout fix).

---

## [1.50.0] - 2026-06-19

### Added

- **ComposableScreen `RadioGroup` / `CheckboxGroup` — tick + sub-label customization.** New tick props `tickPosition` (`"start"` | `"end"`, default `"start"`), `tickColor`, `tickSelectedColor`, `tickBorderRadius` (default: radio `tickSize / 2` full circle, checkbox `4`), and `tickSize` (tick diameter / box side in px, default `20` — radio's inner dot and checkbox's ✓ glyph scale with it). Each item now accepts an optional `subLabel` (secondary line) with state-aware styling: `itemSubLabelColor`, `itemSelectedSubLabelColor`, `itemSubLabelFontSize`, `itemSubLabelFontWeight`, `itemSubLabelFontFamily`, `itemSubLabelFontStyle`. Item `label` is now optional — when a label or sub-label is absent no gap is rendered.

---

## [1.49.1] - 2026-06-19

### Changed
- Version parity bump — no headless SDK changes. Released alongside the UI fix for ComposableScreen Carousel active dot sizing.

---

## [1.49.0] - 2026-06-19

### Added

- **ComposableScreen `Carousel` element — more dot controls.** New props `activeDotWidth`, `activeDotHeight` (active-dot size; default to `dotWidth`/`dotHeight` when unset), `dotsPosition` (`"top"` | `"bottom"`, default `"bottom"`), and `dotsMarginBottom` (default `0`). Complements the existing `dotColor`/`activeDotColor`/`dotWidth`/`dotHeight`/`dotsGap`/`dotsMarginTop`.

---

## [1.48.0] - 2026-06-19

### Added

- **Carousel pagination dot customization** — the `Carousel` step payload accepts an optional `pagination` object: `show`, `dotColor`, `activeDotColor`, `dotWidth`, `dotHeight`, `activeDotWidth`, `activeDotHeight`, `gap`, `position` (`"top"` | `"bottom"`), `marginTop`, `marginBottom`. All fields optional; omitting `pagination` keeps the previous default look.

---

## [1.47.0] - 2026-06-19

### Added

- **Injectable navigation** — new `OnboardingNavigationAdapter` type, default `expoRouterAdapter`, and `useOnboardingNavigation()` hook. `OnboardingProvider` accepts an optional `navigation` prop to plug in any navigation library (react-navigation, custom) instead of `expo-router`.

### Changed

- **`expo-router` is now an optional peer dependency** (was a hidden hard import). When installed it is used automatically; otherwise inject a `navigation` adapter. `useOnboardingStep` calls `navigation.useFocusEffect` instead of importing `expo-router` directly. Existing expo-router apps require no changes.

---

## [1.46.0] - 2026-06-18

### Added

- New `DrawingPad` ComposableScreen `UIElement` type (type + Zod schema). A
  freehand drawing / signature surface that serializes the captured drawing
  into runtime variable(s): `variableName` receives an SVG path string,
  `imageVariableName` receives a base64 image data URI. Props: `strokeColor`,
  `strokeWidth`, `backgroundColor`, `clearable`, `imageFormat` (`"png"|"jpeg"`),
  a customizable clear button (`clearButtonPosition` (4 corners),
  `clearButtonOffset`, `clearButtonSize`, `clearButtonColor`,
  `clearButtonIconColor`, `clearButtonLabel`), plus all `BaseBoxProps`. The
  renderer (UI package) requires the optional peer dependency
  `@shopify/react-native-skia`.

---

## [1.45.0] - 2026-06-18

### Added

- **`Slider` ComposableScreen UIElement** — a continuous numeric input bound to
  a variable. Value is stored as a stringified float (`kind: "float"`) so
  expressions/conditions coerce it numerically. Props: `variableName`,
  `defaultValue` (number), `min` (0), `max` (1), `step` (0 = continuous), plus
  `minimumTrackTintColor` / `maximumTrackTintColor` / `thumbTintColor` and
  `disabled`. Schema refines `min <= max`. Exposed via `SliderElementProps` and
  the `UIElement` union / `UIElementSchema`.

---

## [1.44.7] - 2026-06-18

### Changed

- Version sync with `@rocapine/react-native-onboarding-ui@1.44.7` (gradient
  elements no longer fill the screen). No headless changes.

---

## [1.44.6] - 2026-06-18

### Fixed

- Asset prefetch/preload now works for `ComposableScreen` steps. The element
  tree walker in `extractAssetUrls` recursed into `props.children`, but the
  `UIElement` schema stores `children` as a top-level sibling of `props`, so
  container recursion never fired — every nested `Image`/`Video`/`Lottie`/`Rive`
  asset was skipped (composable screens always wrap content in
  `SafeAreaView`/`ScrollView`/stacks). Now recurses into `element.children`, so
  nested assets warm the cache as intended.

---

## [1.44.5] - 2026-06-16

### Changed

- Version sync with `@rocapine/react-native-onboarding-ui@1.44.5` (staggered
  autoplay `ProgressIndicator` loader bars no longer reset to empty). No
  headless changes.

---

## [1.44.4] - 2026-06-16

### Changed

- Version sync with `@rocapine/react-native-onboarding-ui@1.44.4` (empty/null
  `fontFamily` now falls back to the theme default). No headless changes.

---

## [1.44.3] - 2026-06-16

### Fixed

- **Production no longer gets pinned to the offline fallback.** The production
  onboarding query was cache-first with `staleTime: Infinity`: it returned the
  AsyncStorage cache and **never called the edge function again**, and it cached
  whatever `getSteps` returned — including the offline fallback. So a single
  first-launch fetch failure (timeout / offline / cold-start) cached the
  fallback and pinned every subsequent launch to it, while the device stopped
  hitting the studio entirely. The query now (1) **never caches the fallback**
  (detected via the `ONBS-Onboarding-Id: "fallback"` header), so a bad launch
  self-heals on the next start, and (2) uses **stale-while-revalidate** — it
  serves the cache for an instant first paint while refreshing from the network
  in the background, so studio re-deploys propagate and a stale cache recovers.

---

## [1.44.2] - 2026-06-15

### Fixed

- **Italic font faces are no longer dropped.** The runtime font registry keyed
  variants by weight only, so a `700-italic` face was overwritten by the
  `700-normal` face at the same weight — any `fontStyle: "italic"` text then
  rendered upright. Variants are now keyed by **weight + style**, both faces are
  registered, and `resolveFontFamily` / `useResolvedFontStyle` /
  `useResolvedFontFamily` accept an optional `fontStyle` argument and pick the
  italic face when requested (falling back to the upright face when no italic is
  registered at that weight).
- **Apple SF Pro fonts now render at all weights on iOS.** A manifest family
  whose name collides with the iOS system font (`SF Pro`, `SF Pro Display`,
  `SF Pro Text`, `SF Pro Rounded`, `system`, … — matched case- and
  separator-insensitively) is no longer registered as a bundled face on iOS:
  registering under the system family name made iOS give the system font
  precedence, so only Regular resolved (other weights rendered as tofu). On iOS
  such families now resolve to `fontFamily: undefined` so React Native uses the
  real system font honoring `fontWeight`. On Android (no SF Pro system font) the
  bundled faces register and resolve normally.

### Added

- `isSystemFontFamily`, `normalizeStyle`, and the `FontStyleKey` /
  `RegisteredFace` types are now exported from the package.

---

## [1.44.1] - 2026-06-15

### Changed

- **Runtime font registration** — fonts now register under their file's
  PostScript name (the font file's base name, e.g. `Inter-SemiBold.ttf` →
  `Inter-SemiBold`) instead of a synthesized `<family>-<weight>` name.
  `buildRegisteredName` now derives the name from the font URL, stripping
  directory, query string, and extension.

---

## [1.44.0] - 2026-06-11

### Changed

- Version bump only — paired with `@rocapine/react-native-onboarding-ui` 1.44.0
  (`OnboardingPage` `keyboardVerticalOffset` prop). No headless changes.

---

## [1.43.0] - 2026-06-11

### Added

- **`ProgressiveBlurImage` `blurAppear`** — optional `{ delay?, duration?, easing? }`
  on the element schema. Drives a delayed fade-in of the blur layer over the
  always-visible sharp base image (the photo shows immediately, then the
  progressive blur arrives). Omitting it keeps the legacy static-on-mount blur.
  `easing` ∈ `"linear" | "ease-in" | "ease-out" | "ease-in-out"`. New exported
  `BlurAppear` type.

---

## [1.42.1] - 2026-06-11

### Changed
- **Version sync** — no functional change to the headless SDK. Released alongside `@rocapine/react-native-onboarding-ui@1.42.1` (Button `flex` fix) to keep both packages on the same version.

---

## [1.42.0] - 2026-06-10

### Added
- **RadioGroup / CheckboxGroup per-item shadow** — new optional props on both element schemas: `itemShadowColor`, `itemShadowOffset` (`{ width, height }`), `itemShadowOpacity` (0–1), `itemShadowRadius` (≥0), and `itemElevation` (≥0, Android). Applied to each item row.

---

## [1.41.2] - 2026-06-10

### Changed

- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.41.2 (applies `shadow*` props on Stack/ZStack containers).

---

## [1.41.1] - 2026-06-09

### Changed

- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.41.1 (fixes a static `transform` being suppressed until an element's entering animation finished).

---

## [1.41.0] - 2026-06-09

### Added

- **`autoFocus` prop on `Input` element** — when `true`, the input focuses on mount and the keyboard opens automatically. Optional, defaults to `false`.

---

## [1.40.0] - 2026-06-09

### Added
- **Background asset preloader** — once the onboarding payload is fetched, every remote image/video/Lottie/Rive/SVG asset referenced anywhere in the flow is warmed in the background so later screens render without a load flash. Fully non-blocking (never gates first render) and always on (no config). Covers ComposableScreen element trees (`Image`/`ProgressiveBlurImage`/`Video`/`Lottie`/`Rive`, recursing through container children), `MediaContent`, `Carousel`, and `Loader` `didYouKnowImages`. Bundled assets (MediaSource `localPathId`) are skipped — only remote URLs are warmed.
- **New exports** — `extractAssetUrls(onboarding)` (pure: returns deduped `AssetRef[]` of remote assets, safe on partial/malformed payloads) and `preloadAssets(assets)` (fire-and-forget; native image prefetch via expo-image/RN Image, HTTP-cache warm for video/Lottie/Rive/SVG with bounded concurrency). `AssetRef`/`AssetKind` types exported. Hosts can call these manually for custom preloading.

### Changed
- **`expo-image` added as an optional peer dependency** — used for batched image prefetch when present; falls back to `Image.prefetch` from react-native when absent. No-op if neither warms.

---

## [1.39.0] - 2026-06-08

### Added
- **`AnimatedText` UIElement schema** — type + Zod schema for the new count-up text element (`from`/`to`/`duration`/`delay`/`easing`/`autoplay`/`loop`/`decimals`/`thousandsSeparator` + text styling). Added to the ComposableScreen `UIElement` union. `to` is required; the element renders the number only and never writes a variable. See the UI package for the animated `TextInput` renderer.

---

## [1.38.2] - 2026-06-08

### Changed
- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.38.2 (UI-side fix: memoize `AnimatedBox` entering/exiting/layout builders so entry transitions don't restart on re-render).

---

## [1.38.1] - 2026-06-08

### Changed
- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.38.1 (UI-side re-render fixes in the Loader animations and ComposableScreen render tree).

---

## [1.38.0] - 2026-06-08

### Added
- **`ProgressIndicator` value range (`minValue` / `maxValue` / `step`)** — the indicator is no longer fixed to 0–100. `minValue` (default 0) and `maxValue` (default 100) set an arbitrary value range, so `autoplay` animates `initialValue → maxValue` and the bound `variableName` / label carry the **raw value** (not a percentage). Enables an animated count-up to N: `{ minValue: 0, maxValue: 5000, step: 50, autoplay: true, variableName: "…" }`, then read `{{var}}` in a `Text` (`mode: "expression"`). `step` (default 1, `> 0`) snaps the displayed/written value and bounds the per-sweep write count to `(maxValue − minValue) / step` — use a coarse step for large ranges.
- **`ProgressIndicator.labelSuffix`** — suffix appended after the label value (default `"%"`); set `""` or a unit (e.g. `" kg"`) for non-percentage ranges.

### Changed
- **`ProgressIndicator` `value` / `initialValue` no longer capped at 100** — their Zod `.min(0).max(100)` was relaxed to a plain number; out-of-range values clamp to `[minValue, maxValue]` at runtime instead of failing parse. Defaults (`minValue:0`, `maxValue:100`, `step:1`, `labelSuffix:"%"`) keep existing percentage payloads byte-identical.

---

## [1.37.0] - 2026-06-08

### Added
- **`onPress` on every UIElement** — `BaseBoxProps` now carries an optional `onPress: ButtonAction[]`, so any element can be made tappable with the same action list as `Button.actions` (`"continue"` / `{type:"setVariable"}` / `{type:"custom"}`, run sequentially, `"continue"` terminal). Flows automatically to every ComposableScreen element variant via the shared `BaseBoxProps`. The UI runtime ignores it on elements that own their own gesture (`Button`, `RadioGroup`, `CheckboxGroup`, `DatePicker`, `Input`, `WheelPicker`) — see the UI changelog.
- **`arrayOp` on the `setVariable` action** — `SetVariableButtonAction` gains an optional `arrayOp: "append" | "remove" | "toggle"` that treats the target variable as the JSON-encoded `string[]` multi-select used by `CheckboxGroup`. `value`/`label` are the single member to add (dedup), drop, or flip; the stored `label` stays comma-joined like a real checkbox and `kind` is ignored. Lets any element (via `onPress`) or `Button` add/remove a chip from a multi-select without a `CheckboxGroup` widget. Omitting `arrayOp` keeps the existing overwrite behavior.

### Changed
- **`ButtonAction` moved to `common.types.ts`** — `ButtonAction`, `CustomButtonAction`, `SetVariableButtonAction` and their Zod schemas now live in `steps/common.types.ts` (shared with the new `onPress`), re-exported from `steps/ComposableScreen/elements/ButtonElement.ts` for back-compat. No change to the public API surface or payload shape.

---

## [1.36.2] - 2026-06-08

### Changed
- **Version alignment** — no headless changes; bumped to stay in lockstep with `@rocapine/react-native-onboarding-ui` 1.36.2 (ComposableScreen text-element font fallback fix).

---

## [1.36.1] - 2026-06-04

### Changed
- **Expo SDK 56 / React Native 0.85 alignment** — bumped build-time `react` (19.2.3) and `react-native` (0.85.3) dev dependencies so the package builds against the SDK 56 toolchain. No runtime/API changes (peer deps stay `*`).

---

## [1.36.0] - 2026-06-04

### Added
- **`blurRadius` prop on the `Image` ComposableScreen element** — optional non-negative number applying a uniform Gaussian blur (native `Image.blurRadius`, no extra dependency). `0`/omitted = sharp; ignored for SVGs.
- **New `ProgressiveBlurImage` ComposableScreen element** — a full-bleed image with a gradient-masked Gaussian blur baked in (sharp where the `mask` is transparent, progressively blurred where it's opaque — the "welcome screen" hero look). Props: `url`, `intensity` (0–100, maps to a blur radius), `tint` (`light`/`dark`/`default`), `mask`, `maxBlurOpacity`, plus standard box props. The `mask` is a union — **linear** (`{ from, to, stops }`, `type` optional) or **radial** (`{ type:"radial", center?:{x,y}, radius?, stops }`); each stop's `opacity` = blur strength. Existing `{ from, to, stops }` payloads stay valid as linear. Leaf element (no `children`); intended as the bottom layer of a `ZStack`. New exported types `LinearBlurMask` / `RadialBlurMask`. (UI renders this by masking a blurred copy of the image — see the UI changelog.)

---

## [1.35.0] - 2026-06-02

### Added
- **`haptic` prop on `Button`, `RadioGroup`, `CheckboxGroup` ComposableScreen elements** — optional enum `"none" | "light" | "medium" | "heavy" | "soft" | "rigid"` mapping to expo-haptics `ImpactFeedbackStyle`. Opt-in: absent or `"none"` = no feedback, so existing onboardings are unchanged. Backed by the shared `HapticStyle` type + `HapticStyleSchema` enum in `steps/common.types.ts`.

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
