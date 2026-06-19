# Changelog

All notable changes to `@rocapine/react-native-onboarding-ui` are documented
here.

---

## [Unreleased]

---

## [1.50.0] - 2026-06-19

### Added

- **ComposableScreen `RadioGroup` / `CheckboxGroup` renderers — tick + sub-label customization.** Tick placement honors `tickPosition` (`"start"`/`"end"`); tick color/radius/size come from `tickColor` / `tickSelectedColor` / `tickBorderRadius` / `tickSize` per selection state (`tickSize` default `20` — radio's inner dot and checkbox's ✓ glyph fontSize/lineHeight scale with it; radio `tickBorderRadius` defaults to `tickSize / 2`). Items render an optional `subLabel` line (own font + color resolved once via `useResolvedFontStyle`, state-aware via `itemSubLabel*` / `itemSelectedSubLabelColor`). Item `label` is optional; the tick↔text and label↔sub-label gaps collapse when a line is absent. Accessibility label falls back `label → subLabel → value`.

---

## [1.49.1] - 2026-06-19

### Fixed
- **ComposableScreen Carousel active dot sizing** — `activeDotWidth` / `activeDotHeight` had no visual effect because the renderer used `Pagination.Basic`, which sizes every dot from `dotStyle` (clipped via `overflow: hidden`) and never applies `activeDotStyle` width/height (active resizing is an unimplemented TODO in `react-native-reanimated-carousel`). Switched to `Pagination.Custom`, which interpolates width/height/borderRadius/backgroundColor between active and inactive dots, so active dot sizing now renders.

---

## [1.49.0] - 2026-06-19

### Added

- **ComposableScreen `Carousel` element dots now support active-dot sizing and placement.** The renderer applies `activeDotWidth`/`activeDotHeight` to `Pagination.Basic`'s active dot, renders the dot row above or below the carousel via `dotsPosition`, and honors `dotsMarginBottom`. Defaults preserve the prior look (active dot = inactive size, dots below, no bottom margin).

---

## [1.48.0] - 2026-06-19

### Added

- **Carousel pagination dots are now customizable** — the `Carousel` renderer reads `payload.pagination` to control dot colors, inactive/active width & height, gap, vertical placement (`position: "top" | "bottom"`), and top/bottom margins, and can hide the dots entirely (`show: false`). Defaults reproduce the previous hardcoded styling.

---

## [1.47.0] - 2026-06-19

### Changed

- **`ProgressBar` no longer imports `expo-router`** — its back button now uses the navigation adapter from `useOnboardingNavigation()` (`canGoBack()` / `goBack()`). `expo-router` is now an optional peer dependency; existing expo-router apps keep the same behavior with no changes, and other navigation libraries work by injecting a `navigation` adapter into `OnboardingProvider`.

---

## [1.46.0] - 2026-06-18

### Added

- `DrawingPad` ComposableScreen element renderer — a freehand drawing /
  signature canvas. Captures multi-stroke input via `react-native-gesture-handler`
  and Skia paths; on each completed stroke it serializes the drawing into the
  bound variable(s): an SVG path string (`variableName`) via `path.toSVGString()`
  and/or a base64 image data URI (`imageVariableName`) rendered off an offscreen
  Skia surface. Supports `strokeColor`, `strokeWidth`, `backgroundColor`,
  `clearable`, `imageFormat`, a fully customizable clear button
  (`clearButtonPosition` (top/bottom × left/right), `clearButtonOffset`,
  `clearButtonSize`, `clearButtonColor`, `clearButtonIconColor`,
  `clearButtonLabel`), and all `BaseBoxProps`. Requires
  the optional peer dependency `@shopify/react-native-skia` (throws an explicit
  install error when absent). Wired into `renderElement` and added to
  `PRESS_HANDLED_TYPES` (owns its own gesture).

---

## [1.45.0] - 2026-06-18

### Added

- **`Slider` element renderer** — renders a continuous numeric slider that
  reads/seeds/writes its bound variable as a float. Backed by the new optional
  peer dep `@react-native-community/slider`; degrades to an empty box when the
  dep is absent (mirrors `GradientBox`'s silent fallback). Track/thumb tints
  default to the theme `primary` / `neutral.low`. Wired into `renderElement`
  (dispatch + `PRESS_HANDLED_TYPES`, since it owns its gesture) and
  `collectElementDefaults` (first-render default seed).

---

## [1.44.7] - 2026-06-18

### Fixed

- **`backgroundGradient` on `Button` (and other elements) no longer blows the
  element up to fill the screen.** The gradient render path nested the content
  inside `<GradientBox style={{ flex: 1 }}>` with an inner `flex: 1` view, while
  the non-gradient path was content-sized. In a `ZStack`/flex container that
  `flex: 1` grabbed the parent's full main-axis, so a gradient `Button` (or
  `SafeAreaView`/`KeyboardAvoidingView`/`ScrollView`) expanded to the whole
  screen. The inner `flex: 1` is now gated behind an explicit
  `height`/`flex`/`flexGrow`, so a content-sized element stays content-sized
  with or without a gradient. Affected renderers: `ButtonElement`,
  `SafeAreaViewElement`, `KeyboardAvoidingViewElement`, `ScrollViewElement`.

---

## [1.44.6] - 2026-06-18

### Changed

- Version sync with `@rocapine/react-native-onboarding@1.44.6` (asset
  prefetch/preload now works for `ComposableScreen` steps). No UI changes.

---

## [1.44.5] - 2026-06-16

### Fixed

- **Staggered autoplay `ProgressIndicator` loader bars no longer reset to
  empty.** When several `autoplay` linear bars ran on one screen (e.g. a
  "curating your profile…" loader), bars that finished early painted empty while
  only the last-finishing bar stayed filled — even though every bar's bound
  variable correctly reached its max (so `renderWhen: eq max` checkmarks stayed
  visible, exposing the desync). Cause: each autoplay bar wrote its bound
  variable on every animation step (~20×/s), and every `setVariable` re-rendered
  all ComposableScreen variable consumers; on Fabric / Reanimated 4 that
  re-render storm reverted the already-settled animated fill of sibling bars.
  Fixes:
  - Autoplay bars now write the bound variable only at the sweep **boundaries**
    (start / completion) instead of on every step, eliminating the re-render
    storm. The live numeric `%` is still rendered natively via `showLabel`.
    (A consumer interpolating the variable mid-sweep with `{{var}}` now sees it
    jump min→max — use `showLabel` for a live readout.)
  - The linear fill is driven by a left-anchored `scaleX` transform instead of
    an animated percentage `width`, which commits reliably on Fabric.
  - Autoplay progress is seeded from the bound variable on mount, so a completed
    bar is restored to full if the screen subtree remounts.
  - Added dependency arrays to the animated worklets to avoid mapper churn.

---

## [1.44.4] - 2026-06-16

### Fixed

- **Empty / null `fontFamily` now falls back to the theme default.** A text
  element (`Text`, `Button`, `Input`, `RadioGroup`, `CheckboxGroup`,
  `WheelPicker`, `AnimatedText`, rich-text spans) that provided no usable font
  only fell back to `theme.typography.defaultFontFamily` when `fontFamily` was
  `undefined` or `"inherit"`. The CMS emits an **empty string** (`""`) or
  `null` for "no font selected", which slipped through
  `resolveInheritedFontFamily` unchanged — a falsy family then reached
  `resolveFontFamily`, which returns `undefined` (system font) and silently
  ignored the configured default. `resolveInheritedFontFamily` now treats any
  falsy value (`""` / `null` / `undefined`) as well as `"inherit"` as "use the
  theme default".
- **`fontStyle` now resolves the italic face on `Button` / `Input` /
  `RadioGroup` / `CheckboxGroup`.** These passed only `fontFamily` + `fontWeight`
  to `useResolvedFontStyle`, so a registered italic variant (e.g.
  `PlayfairDisplay-Italic`) was never selected — text fell back to synthetic
  italic over the upright face. `fontStyle` is now threaded into resolution so
  the real italic face is picked when registered (matching `Text` /
  `AnimatedText`).

---

## [1.44.3] - 2026-06-16

### Changed

- Version sync with `@rocapine/react-native-onboarding@1.44.3` (production
  fallback-cache fix in the headless SDK). No UI/renderer changes.

---

## [1.44.2] - 2026-06-15

### Fixed

- **Italic text renders with the italic face.** `TextElement` (incl. rich-text
  spans) and `AnimatedTextElement` now pass `fontStyle` into
  `useResolvedFontStyle`, so an italic request resolves to the registered italic
  font face instead of the upright one. Paired with
  `@rocapine/react-native-onboarding` 1.44.2.

---

## [1.44.1] - 2026-06-15

### Changed

- Version bump only — paired with `@rocapine/react-native-onboarding` 1.44.1
  (runtime fonts register under their PostScript / file name). No UI changes.

---

## [1.44.0] - 2026-06-11

### Added

- **`OnboardingPage` `keyboardVerticalOffset`** — optional number forwarded to the
  `ComposableScreen` renderer's `KeyboardAvoidingView` (default `0`). Hosts that
  render `OnboardingPage` below a fixed header (e.g. a `paddingTop: HEADER_HEIGHT`
  wrapper when `displayProgressHeader` is true) push the view's top down, so the
  iOS `behavior="padding"` math under-compensates by exactly that offset and the
  bottom CTA stays hidden behind the keyboard on steps containing an `Input`.
  Pass the header height (`keyboardVerticalOffset={HEADER_HEIGHT}`) to compensate.
  Other step renderers are unchanged.

---

## [1.43.0] - 2026-06-11

### Added

- **`ProgressiveBlurImage` `blurAppear`** — fades the masked-blur + tint layer in
  over the always-visible sharp base image after an optional delay, via a
  reanimated opacity wrapper (`withDelay` + `withTiming`, reusing the shared
  `EASING_MAP`). `{ delay? (ms, default 0), duration? (ms, default 400), easing?
  (default "ease-out") }`. Omitting it renders the blur statically at full
  strength on mount (unchanged). The degraded scrim fallback is unaffected.

---

## [1.42.1] - 2026-06-11

### Fixed
- **Button `flex` ignored** — `ButtonElement` now forwards `flex` / `flexShrink` / `flexGrow` from its resolved props in both render branches (gradient + default outer `Animated.View`). Previously these `BaseBoxProps` fields were dropped, so a `Button` with `flex: 1` always sized to its content; equal-width / proportional buttons inside an `XStack` now work without wrapping each Button in a `flex: 1` container. The `alignSelf` default (`"stretch"` when no `width`) is unchanged, so content-sized buttons behave as before.

---

## [1.42.0] - 2026-06-10

### Added
- **RadioGroup / CheckboxGroup per-item shadow** — item rows now honor `itemShadowColor` / `itemShadowOffset` / `itemShadowOpacity` / `itemShadowRadius` / `itemElevation` via `buildShadowStyle` on each `TouchableOpacity`. Items carry no `overflow: hidden`, so the iOS shadow is not clipped; a lone `itemShadowColor` defaults opacity to `1` and radius to `4`.

---

## [1.41.2] - 2026-06-10

### Fixed

- **`shadow*` props now render on `XStack` / `YStack` / `ZStack` containers** — `buildShadowStyle` was only wired into `ButtonElement` and `ImageElement`, so `shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius` / `elevation` set on Stack containers were silently dropped. `StackElement` and `ZStackElement` now spread `buildShadowStyle(p)` into their style objects. (iOS shadows still require `overflow` ≠ `hidden` on the shadowed view.)

---

## [1.41.1] - 2026-06-09

### Fixed

- **Static `transform` now applies from frame 0 when an element also has an entering animation** — reanimated's `entering`/`exiting`/`layout` builders take over the host view's transform for the duration of the transition, so a static `transform` (or continuous `effect`) placed on the same `AnimatedBox` view was suppressed until the entry finished, then snapped in. `AnimatedBox` now nests the two onto separate views when a reanimated builder is present: the outer (parent-facing) view keeps `flex`/`alignSelf` + the builder, the inner view carries the static transform/effect — so they stack instead of fighting. No-builder elements (transform/effect only) keep the single-view fast path.

---

## [1.41.0] - 2026-06-09

### Added

- **`autoFocus` prop on `Input` element** — when `true`, the `TextInput` focuses on mount and the keyboard opens automatically. Optional, defaults to `false`.

---

## [1.40.0] - 2026-06-09

### Changed
- **Version sync only** — no UI changes. Bumped in lockstep with `@rocapine/react-native-onboarding` 1.40.0 (headless background asset preloader that warms remote image/video/Lottie/Rive/SVG assets from the payload after fetch). UI renderers are unchanged; preloaded assets are served from cache when each screen mounts.

---

## [1.39.0] - 2026-06-08

### Added
- **`AnimatedText` UIElement** — a number that count-animates `from`→`to` and renders as formatted text (`decimals`, `thousandsSeparator`, `easing`, `loop`). The animation runs entirely on the UI thread and writes straight into a native `TextInput` via `useAnimatedProps({ text })` (the react-native-redash `ReText` pattern), so it produces **zero React re-renders per frame and never writes a composable variable**. It is the performant replacement for driving a count-up through an `autoplay` `ProgressIndicator` bound to a variable (which re-renders the whole ComposableScreen tree on every step). Renders the number only — compose static labels as sibling `Text`.

### Changed
- **`ProgressIndicator` `showLabel` no longer re-renders** — the label was React state (`useState` + `runOnJS(setDisplayValue)` per step hop), so a `showLabel` indicator re-rendered itself on every step and churned the reanimated mapper scheduler (visibly destabilizing other on-screen animations). The label is now a native `TextInput` driven from a worklet (same technique as `AnimatedText`), so `showLabel` adds **zero re-renders**. The `setVariable` write for a bound `variableName` is unchanged (still the documented per-step write — keep `step` coarse for large ranges, or use `AnimatedText` for pure display).

---

## [1.38.2] - 2026-06-08

### Fixed
- **Entry transitions restarting on re-render** — `AnimatedBox` rebuilt its `entering`/`exiting`/`layout` reanimated builders inline on every render, handing `Animated.View` a fresh `entering` instance each time and re-firing the entry transition. With an autoplay `ProgressIndicator` on screen (writes its bound variable each step → re-renders the whole ComposableScreen tree), every sibling's entry animation visibly reloaded. The builders are now memoized on their (stable, from the memoized parsed step) spec objects.

---

## [1.38.1] - 2026-06-08

### Fixed
- **Loader `CircularProgress` per-frame re-render** — the percentage `useAnimatedReaction` rounded inside its JS callback, firing `setPercentage` every frame (~60×/s) and re-rendering the component continuously; it also had no deps array, so Reanimated rebuilt the mapper on every render (resetting `prev`). Now rounds inside the reader with a `prev` guard and a `[]` deps array, so the JS callback fires only when the displayed integer changes.
- **Loader `StepProgress` listener thrash** — the `progress.addListener` effect was keyed on `barStarted`/`barComplete`, the very states its callback flips, so each `setState` tore the listener down and re-attached it mid-animation. The one-time start/complete transitions now live in refs and the effect deps are `[progress]` (attaches once).

### Changed
- **ComposableScreen flattens variables once per render** — `renderElement` rebuilt `flatVars` via `Object.fromEntries` for every element on every tree re-render; an autoplay `ProgressIndicator` writing a variable each step re-renders the whole tree, making this pure churn. The flatten is now memoized once in `Renderer` as `ctx.flatVariables` (added to `RenderContext`) and reused by `renderElement`, `RichTextElement`, and `ButtonElement`.

---

## [1.38.0] - 2026-06-08

### Added
- **`ProgressIndicator` arbitrary value range** — the renderer decouples the fill fraction (always 0–1, derived as `(value − minValue) / (maxValue − minValue)`) from the displayed value (in `[minValue, maxValue]`). `autoplay` animates to `maxValue`; the label and the `autoplay`-written variable now carry the raw value snapped to `step`, with `labelSuffix` (default `"%"`) appended. Lets a `ProgressIndicator` drive an animated count-up to N (read via `{{var}}` in a `Text`). The `useAnimatedReaction` worklet keys on the **step-snapped** value (not the rounded percent) and re-keys on `minValue`/`maxValue`/`step`, so the JS callback fires `(maxValue − minValue) / step` times per sweep — coarse `step` avoids a per-step re-render storm on large ranges.

### Changed
- **`ProgressIndicator` label is no longer percent-only** — both label render sites show `{value}{labelSuffix}` instead of a hardcoded `{percent}%`; the internal `clamp` is now range-aware (`clamp(n, min, max)`). With default props (`minValue:0`, `maxValue:100`, `step:1`, `labelSuffix:"%"`) the rendered output is unchanged.

---

## [1.37.0] - 2026-06-08

### Added
- **Generic `onPress` on non-pressable elements** — `renderElement` now wraps any element declaring `onPress: ButtonAction[]` in a single central `Pressable` (mirroring the existing `AnimatedBox` wrapper), dispatching the same action list as `Button` via a new shared `runActions` helper. Makes static elements (Text, Icon, Image, Lottie, Rive, Video, ProgressIndicator, RichText, Stacks, ZStack, SafeAreaView, ScrollView, KeyboardAvoidingView, Carousel) tappable. Skipped for elements that own their own tap/focus/scroll gesture (`Button`, `RadioGroup`, `CheckboxGroup`, `DatePicker`, `Input`, `WheelPicker`). The `Pressable` is layout-transparent — it forwards the element's `flex` / `flexGrow` / `flexShrink` (incl. the `parentType === "XStack"` shrink default) / `alignSelf`, so a tappable element still splits/flows in its parent's flex context exactly as it would un-wrapped (e.g. flex:1 cards in a row grid).
- **`arrayOp` multi-select support in `runActions`** — a `setVariable` action with `arrayOp: "append" | "remove" | "toggle"` reads the target variable's JSON-encoded `string[]` (the `CheckboxGroup` encoding), applies the set operation to `value`, and re-stores `JSON.stringify(values)` + comma-joined member labels. `append` dedups, `toggle` flips, `remove` drops; the label list stays aligned to the value list. Makes a tappable card behave like a checkbox.

### Changed
- **Extracted `runActions` from `ButtonElement`** — the press-action dispatch loop (continue / setVariable / custom) moved into `elements/runActions.ts` and is now shared by `Button` and the generic `onPress`. `Button`'s behavior (haptic, `disabledWhen`, `pressedStyle`) is unchanged. `ButtonAction` types/schemas moved to `elements/actions.ts` (re-exported from `ButtonElement` for back-compat).

---

## [1.36.2] - 2026-06-08

### Fixed
- **Theme font now applies to all ComposableScreen text elements** — `RadioGroup`/`CheckboxGroup` item labels, `WheelPicker` items, and the Android `DatePicker` trigger label previously rendered in the system font when their `fontFamily`/`itemFontFamily` prop was omitted, ignoring `theme.typography.defaultFontFamily`. They now resolve through `resolveInheritedFontFamily` + the font registry (matching `Button`/`Text`/`Input`), so omitted font falls back to the theme default and weighted variants are matched correctly (synthetic bold suppressed via `resolvedToVariant`).

---

## [1.36.1] - 2026-06-04

### Fixed
- **`ProgressiveBlurImage` element on React Native 0.85** — replaced removed `StyleSheet.absoluteFillObject` with `StyleSheet.absoluteFill` (RN 0.85 dropped the former; the latter is now the equivalent frozen style object). Fixes the build under Expo SDK 56.

### Changed
- **Expo SDK 56 / React Native 0.85 alignment** — bumped build-time dev dependencies (`react` 19.2.3, `react-native` 0.85.3, `expo-router` ~56.2.8, `expo-store-review` ~56.0.3, `react-native-gesture-handler` ~2.31.1, `react-native-reanimated` 4.3.1, `react-native-safe-area-context` ~5.7.0, `react-native-svg` 15.15.4, `@react-native-community/datetimepicker` ^9.1.0). `react-native-svg` 15.15.4 fixes a native build break against RN 0.85's `ImageResponseObserver` signature. No runtime/API changes (peer deps stay `*`).

---

## [1.36.0] - 2026-06-04

### Added
- **Uniform image blur** — the `Image` ComposableScreen renderer now forwards a `blurRadius` prop to both `expo-image` and RN `Image` (native blur, no extra dep). `0`/omitted = sharp; ignored for SVGs.
- **`ProgressiveBlurImage` element renderer** — renders a full-bleed sharp image with a gradient-masked **blurred copy** of the same image on top (revealed where the `mask` is opaque) plus an optional `tint` gradient, producing a progressive (variable) blur: sharp where the mask is transparent, blurred + tinted where it's opaque. Masking a blurred image copy (rather than a backdrop `BlurView`) is what makes it composite reliably on iOS — a masked `BlurView` has no backdrop to sample and renders transparent. Supports both **linear** and **radial** masks: linear renders via `expo-linear-gradient`, radial via `react-native-svg` (a required dep — radial works even without expo-linear-gradient). The tint overlay + degraded scrim follow the same mask shape. Composes as the bottom layer of a `ZStack` with sharp foreground content above. A native-view probe + error boundary degrade to a sharp image + dark scrim (never throws) when the masked-view native module isn't in the running binary.

### Changed
- **`@react-native-masked-view/masked-view` added as an optional peer dependency** — needed (alongside the existing `expo-linear-gradient` for the mask/tint gradients and `expo-image` for the blurred copy) by `ProgressiveBlurImage`. When absent the element degrades gracefully to a sharp image + a dark gradient scrim derived from the mask (still legible for overlaid text). The `mask` is linear-only; a radial source mask is approximated by a vertical fade.

---

## [1.35.0] - 2026-06-02

### Added
- **Haptic feedback on clickable ComposableScreen elements** — `Button`, `RadioGroup`, and `CheckboxGroup` renderers fire tactile feedback on press / select / toggle when their new `haptic` prop is set (`"light" | "medium" | "heavy" | "soft" | "rigid"`; `"none"` or omitted = silent). Powered by a shared `triggerHaptic` helper (`elements/haptics.ts`) that dynamically requires the new optional `expo-haptics` peer dependency — silently no-ops when the dep isn't installed, mirroring the `expo-store-review` / `expo-linear-gradient` pattern.

### Changed
- **`expo-haptics` added as an optional peer dependency** — install only if you opt into the `haptic` prop.

---

## [1.34.1] - 2026-06-02

### Fixed
- **`ProgressIndicator` resetting after it finishes** — `useAnimatedReaction` was created without a dependency array, so reanimated 4 tore down and rebuilt the mapper on every render. A looping `showLabel` indicator re-renders ~40×/s indefinitely (one `setPercentage` per frame), churning `startMapper`/`stopMapper` on the UI-thread scheduler and destabilizing other running animations on the same screen — the "autoplay once" indicator would occasionally snap back to its initial value after completing. The reaction is now keyed on `[showLabel, writesVariable, variableName]` so the mapper stays stable across renders (this also keeps `prev` alive, restoring the `rounded === prev` over-fire guard).

---

## [1.34.0] - 2026-06-02

### Added
- **WebP / AVIF image support** — the `Image` element now renders via `expo-image` when installed (new **optional** peer dep), falling back to React Native's `Image` when absent (same try/require pattern as `GradientBox` / `expo-linear-gradient`). RN's built-in `Image` is unreliable for WebP on iOS; `expo-image` decodes WebP/AVIF reliably cross-platform. `resizeMode` maps to expo-image `contentFit` (`cover`/`contain` pass through, `stretch`→`fill`, `center`→`none`).
- **SVG image support** — the `Image` element auto-detects URLs whose path ends in `.svg` (query-string / hash tolerant) and renders them with `react-native-svg`'s `SvgUri` (already a dependency). No schema change — existing payloads with `.svg` URLs just work. `resizeMode` maps to SVG `preserveAspectRatio` (`cover`→`xMidYMid slice`, `contain`/`center`→`xMidYMid meet`, `stretch`→`none`).
- **`ScrollView` element `alignItems` / `justifyContent`** — renders the new optional `ScrollView` props (see headless `1.34.0`) on the scroll content container for cross-axis alignment + distribution along the scroll axis.

### Fixed
- **Horizontal `ScrollView` no longer "stuck" / unscrollable** — children of a horizontal `ScrollView` were rendered with `parentType` `"XStack"`, which applied a `flexShrink: 1` default, so fixed-width cards shrank to fit the viewport instead of overflowing (the row couldn't scroll). Horizontal scroll content now renders with a dedicated `"XScroll"` `parentType` (row layout, **no** `flexShrink` default) and drops `flexGrow: 1` from its content container, so children keep their intrinsic width and the row scrolls. (Vertical `ScrollView` keeps `flexGrow: 1` so a short payload still fills the viewport.)
- **`RichText` `textAlign` now aligns the wrapping row** — `textAlign` was published to child `Text` elements via `RichTextStyleContext` but had no visible effect on the row itself (each word is a shrink-wrapped flex item, so `textAlign` is a no-op there); the row's horizontal distribution is governed by `justifyContent`, which defaulted to `"center"`. `textAlign` now maps onto the row's `justifyContent` when `justifyContent` isn't set explicitly (`left`→`flex-start`, `center`→`center`, `right`→`flex-end`).

---

## [1.33.0] - 2026-06-01

### Added
- **`RichText` container renderer** — renders the new `RichText` UIElement as a wrapping flex row (`<View>` / `GradientBox`, `flexDirection:"row"`, `flexWrap` default `"wrap"`). Children (`Text` elements) render through `renderElement` as real flex children, so each honors its own box props (`padding`, `borderRadius`, `border`, `backgroundColor`, `margin`, `transform`) — enabling padded/rounded/rotated chip segments — plus `renderWhen` / `expression`. Supports `gap`, `alignItems` (incl. `"baseline"`), and `justifyContent`. Unlike inline `TextSpan`s, `RichText` children **may** use `animation` / `transform` (the `AnimatedBox` `View` wrapper is valid inside the row). The container's text-style props (`fontSize`, `color`, `textAlign`, …) are published via a new `RichTextStyleContext` and merged by `TextElementComponent` as inherited defaults (child props win) — so a title's base typography is declared once on the container. Plain-text children are expanded into one inline `Text` per word (spaces preserved) so the row wraps word-by-word; children with box styling or motion stay atomic chips. (Because spaces become real flex items, avoid `gap` when mixing words + chips — use chip `marginHorizontal`.)

---

## [1.32.0] - 2026-06-01

### Added
- **`AnimatedBox` wrapper + `buildAnimation` helper** — renders the new `transform` / `animation` surface (see headless `1.32.0`) for every ComposableScreen element. `renderElement` wraps the dispatched node in a single `Animated.View` (`AnimatedBox`) only when `animation` or `transform` is present (zero extra view otherwise), forwarding `flex`/`alignSelf` so the wrapper stays layout-transparent. `entering`/`exiting`/`layout` resolve to reanimated builders by name (`Reanimated[preset]`) with `.duration().delay().springify().easing()` modifiers; unknown presets degrade to no-op. Continuous `effect` (`pulse`/`fade`/`rotate`/`shimmer`/`bounce`) runs imperatively via `withRepeat`. No new peer deps — uses the existing `react-native-reanimated` stack.
- Shared `EASING_MAP` extracted to `buildAnimation.ts`; `ProgressIndicatorElement` now imports it (removes the duplicated easing table).
- New `composable-screen-animations` example screen (entering presets staggered by `delay`, spring vs easing, looping effects, static transforms, exiting + layout toggle, Replay button). `composable-screen.tsx` + `onboarding-example.ts` demos: hero image fades in (`FadeInDown`), star icon zooms in with a static tilt and a continuous `pulse`.
- **`RichTextSpan` extended** — applies the new `TextSpan` fields (`backgroundColor`, `opacity`, `textTransform`, `textDecorationColor`, `textDecorationStyle`, `lineHeight`) to the nested inline `<Text>`.

---

## [1.31.0] - 2026-06-01

### Added
- **Inline rich-text rendering in `TextElement`** — when `content` is a span array, the renderer maps each span to a nested `<Text>` (new internal `RichTextSpan` component) so fragments with different weight/style/color/decoration wrap together on one baseline. Each span resolves its own font via `useResolvedFontStyle` against the parent `Text`'s inherited family, so a span setting only `fontWeight` still picks the correct weighted font variant. Supports per-span `fontWeight`, `fontStyle`, `fontFamily`, `fontSize`, `letterSpacing`, `color`, `textDecorationLine`.

### Changed
- **`TextElementPropsSchema.content`** mirror widened to `string | TextSpan[]`; `TextSpan` / `TextSpanSchema` added to the UI element. Plain string `content` renders identically to before. Expression mode interpolates `{{variable}}` inside each span's `text`.

---

## [1.30.0] - 2026-05-29

### Added
- **`ProgressIndicatorElement` renderer** — renders the `ProgressIndicator` UIElement in both variants. Linear uses an animated track-fill `View`; circular uses an animated `react-native-svg` ring (both driven by `react-native-reanimated` — no new peer deps; same stack as `CircularProgress`). `easing` names map to CSS cubic-bezier curves (`linear`, `ease-in` `(0.42,0,1,1)`, `ease-out` `(0,0,0.58,1)`, `ease-in-out` `(0.42,0,0.58,1)`). `autoplay` animates `initialValue → 100` (optionally `loop`ing, optionally after a `delay` ms via `withDelay`) and writes the rounded value to `variableName` on each integer-percent change (reaction keyed on the rounded value, not per-frame, to avoid a context re-render storm); without `autoplay` the indicator animates toward the bound variable / static `value`. Optional `showLabel` renders the live percentage. `composable-screen.tsx` + `onboarding-example.ts` demos exercise a linear autoplay-loop and a circular autoplay-once indicator.

---

## [1.29.0] - 2026-05-29

### Added
- **`DatePickerElement`: `"now"` sentinel support** — renderer mirrors the headless schema and resolves `defaultValue` / `minimumDate` / `maximumDate` via a `resolveDate` helper that maps the literal `"now"` to `new Date()` at render time (ISO strings still parse as before). Initial value, `minimumDate`, and `maximumDate` passed to the native picker all honor `"now"`. `composable-screen.tsx` + `onboarding-example.ts` demos now use `maximumDate: "now"`.

---

## [1.28.0] - 2026-05-29

### Added
- **`RadioGroupElement` / `CheckboxGroupElement`: `showTick` support** — both renderers mirror the headless `showTick` field and gate the indicator on `showTick !== false`. With `showTick: false` the radio circle / checkbox `✓` box is not rendered, leaving label + selected background/border to convey state; default (`true` / omitted) is unchanged. `composable-screen.tsx` + `onboarding-example.ts` demos exercise both states (radio shows the tick, checkbox hides it).

---

## [1.27.0] - 2026-05-29

### Added
- **`WheelPicker` element renderer** — renders the new `WheelPicker` UIElement using the optional `@react-native-picker/picker` peer dep (native iOS wheel / Android dropdown). Seeds + writes its bound variable like `RadioGroup` (full `{value, label}` entry), resolves `items` / `range` via the shared headless `resolveWheelPickerItems` helper, and contributes to `collectElementDefaults` so `defaultValue` is visible to `renderWhen` / `{{var}}` on first render. Falls back to a clear placeholder when the peer dep is absent.

---

## [1.26.0] - 2026-05-28

### Added
- **`IconElement` filled / tinted rendering** — `IconElement.tsx` now mirrors headless `fill` + `fillOpacity` schema fields and passes them through to the underlying `lucide-react-native` SVG (extends `react-native-svg`'s `SvgProps`). Authors can render filled lucide icons or tinted overlays directly from CMS payload, e.g. `{ "fill": "#007AFF", "fillOpacity": 0.25 }`. Default behaviour unchanged — omit `fill` and icons render outlined as before.

---

## [1.25.1] - 2026-05-28

### Added

- **`aspectRatio` on every UIElement (via `BaseBoxProps`)** — wired into
  the Rive renderer's wrapper; other element renderers can opt-in by
  reading `p.aspectRatio`.

### Changed

- **ComposableScreen page no longer wraps content in a `ScrollView`** —
  the wrapper container's `flexGrow: 1` left inner `flex: 1` children
  unbounded vertically, so a `Carousel` (or any `flex: 1` element) grew
  with its intrinsic content and pushed siblings off-screen. Payloads
  needing scroll should use the `ScrollView` UIElement (added in 1.25.0).
  `KeyboardAvoidingView` still wraps the page root.

  **Migration:** if your existing payload relied on the implicit page
  scroll (content taller than the viewport with no `ScrollView`
  UIElement), wrap your top-level container in a `ScrollView` element to
  restore the previous behavior. Layouts where the root container is
  `flex: 1` (the common case) are unaffected — and now render
  correctly when the inner tree uses `flex` to share space.
- **Rive default size** — wrapper height defaults to undefined (was
  `200`); when neither `height` / `flex` / `aspectRatio` / `min-height` /
  `max-height` is set, falls back to `aspectRatio: 1` so the artboard
  doesn't fill the screen via its native intrinsic.

### Fixed

- **`Button` honors explicit `padding: 0`** — sub-axis defaults
  (`paddingHorizontal: 24`, `paddingVertical: 14`) used to apply even
  when `padding` was set to 0, because RN treats the shorthand and
  axis props independently. Axis defaults now apply only when `padding`
  itself is unset.
- **`Button` honors `textAlign`** — Pressable's `alignItems: "center"`
  constrained the label `Text` to its intrinsic width, neutralizing
  `textAlign`. Removed the constraint so the label stretches and
  `left | center | right` applies (default still centered).
- **`Button` shadow visible from `shadowColor` alone** — iOS defaults
  `shadowOpacity` to 0; the renderer now fills in `shadowOpacity: 1`
  and `shadowRadius: 4` when only `shadowColor` is set.
- **`Image` shadow renders** — iOS clipped image shadows because the
  `Image` host had `overflow: hidden`. When `shadowColor` / `elevation`
  is set, the renderer now wraps the image in a shadow-carrying `View`
  (or `GradientBox`) and lets the inner `Image` clip its own rounded
  corners.

---

## [1.25.0] - 2026-05-27

### Added

- **`ScrollView` element renderer** — renders a React Native `ScrollView`.
  Applies `BaseBoxProps` to the outer container (gradient-aware), maps
  `bounces` / indicators / `contentInset` / `keyboardShouldPersistTaps`, and
  exposes a `contentContainerPadding` shortcut on `contentContainerStyle`
  (which also keeps `flexGrow: 1`). `horizontal` renders children in row order.
- **`KeyboardAvoidingView` element renderer** — renders a React Native
  `KeyboardAvoidingView` with `behavior` defaulting to iOS `padding` /
  Android `height`, plus `keyboardVerticalOffset` and `enabled`.

### Changed

- **ComposableScreen page wraps content in `KeyboardAvoidingView`** — the page
  Renderer now nests its scroll view inside a `KeyboardAvoidingView`
  (`flex: 1`, iOS `padding` / Android `height`), so text inputs avoid the
  keyboard. A `KeyboardAvoidingView` placed *inside* the page scroll view is
  inert by design (it cannot measure its frame); keyboard avoidance is handled
  at the page level.

---

## [1.24.0] - 2026-05-27

### Added

- **Button per-state styling + shadow** — `ButtonElement` renderer now merges
  `pressedStyle` (while held) and `disabledStyle` (while `disabledWhen` is
  truthy) on top of base props, and applies `BaseBoxProps` shadow fields
  (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`)
  to the outermost wrapper. Opacity transitions between rest/pressed/disabled
  animate over `transitionDurationMs` (default `150`, native driver); color and
  shadow changes switch instantly.

### Changed

- **`ButtonElement` uses `Pressable` + `Animated.View`** instead of
  `TouchableOpacity`, enabling explicit press-state tracking and the animated
  state transitions. Press feedback defaults to `opacity 0.8` when no
  `pressedStyle.opacity` is set, preserving prior tap feel.
- **`disabledBackgroundColor` / `disabledColor` deprecated** in favor of
  `disabledStyle`; kept as fallback when `disabledStyle` is omitted.

---

## [1.23.0] - 2026-05-26

### Added

- **`renderWhen` runtime gating in ComposableScreen** — `renderElement`
  evaluates the new optional `renderWhen` field on every UIElement against
  flattened `ctx.variables` and returns `null` (skipping the element and
  its subtree) when the condition is false. Single gating point covers all
  15 element types; container subtrees are skipped naturally because the
  bail-out runs before `renderChildren` is invoked.

### Changed

- **Element defaults overlaid into `ctx.variables`** — `Renderer.tsx` now
  computes element-declared defaults (`Carousel.defaultIndex`,
  `RadioGroup.defaultValue`, `CheckboxGroup.defaultValues`,
  `Input.defaultValue`, `DatePicker.defaultValue`) via a tree walk and
  overlays them onto `RenderContext.variables` synchronously on first
  render. `composableVariables` keeps precedence so user-driven updates
  aren't clobbered. Makes `renderWhen` and `{{var}}` interpolation see
  defaults from the very first frame, before per-element seeding effects
  persist them into the variable store.
- **`CarouselElement` persists default index** — when `variableName` is set
  and the variable has no value yet, the carousel writes its clamped
  `defaultIndex` into `composableVariables` on mount, matching the seeding
  pattern used by RadioGroup / Input / DatePicker.

### Internal

- New `elements/collectDefaults.ts` module — pure recursive walk over the
  UIElement tree returning `Record<variableName, ComposableVariableEntry>`
  for defaulted variables. Consumed by `Renderer.tsx`.

---

## [1.22.0] - 2026-05-11

### Added

- **Expression mode on `setVariable` button action** — new optional
  `valueMode?: "literal" | "expression"` and `kind?: "int" | "float" | "string"`
  fields on `SetVariableButtonAction`. In `"expression"` mode `value` is
  evaluated as an arithmetic expression supporting `{{var}}` references,
  numeric literals, `+ - * /`, and parens. Variable values are coerced
  according to their `kind` tag (string / int / float) or inferred from
  string content when no tag is present. Numeric `+` on any string operand
  becomes concat. Missing variables default to numeric 0 in arithmetic
  context (so `{{counter}} + 1` works on first click). On any parse failure
  the action falls back to plain `{{var}}` interpolation. Result kind is
  written back to the variable entry so subsequent expressions can
  re-evaluate without re-tagging.

### Internal

- New `elements/expression.ts` module — tokenizer + recursive-descent parser
  for the expression-mode subset. Pure function, no dependencies, deterministic.

---

## [1.21.0] - 2026-05-11

### Added

- **Variable-bound `Carousel` index** — Carousel renderer mirrors the new
  `defaultIndex` and `variableName` schema fields. Initial page resolves from
  the variable value (when `variableName` set and parsable as int) then falls
  back to `defaultIndex ?? 0`; index is clamped to `[0, children.length - 1]`
  and frozen at mount to avoid carousel remounts. A `useEffect` watching the
  variable value calls `ref.scrollTo()` on external changes (e.g. `setVariable`
  button actions); `onSnapToItem` writes the current index back as a string
  when `variableName` is set. A `lastSyncedIndex` ref prevents
  external↔swipe feedback loops.

---

## [1.20.0] - 2026-05-11

### Added

- **Disabled-state support on ComposableScreen `Button` renderer** — the
  renderer now reads `disabledWhen`, `disabledBackgroundColor`, and
  `disabledColor` from `ButtonElementProps`. When the condition evaluates
  truthy against `ctx.variables` (flattened to primitive values), the
  `TouchableOpacity` is disabled and the button renders with the disable
  color tokens (`theme.colors.disable`, `theme.colors.text.disable`) or
  the per-button overrides. Filled buttons with a `backgroundGradient`
  drop the gradient in the disabled state for a clearer affordance;
  outlined buttons swap the border to the disable color.

---

## [1.19.0] - 2026-05-07

### Added

- **`typography.defaultFontFamily` theme token** — new optional field on
  `TypographyTokens`. Defaults to `"Inter"`. Override via
  `customTheme={{ typography: { defaultFontFamily: "Lobster" } }}` to brand
  every ComposableScreen text element with one font without patching each
  `textStyles.*.fontFamily` entry.
- **Font inheritance on `Text`/`Button`/`Input` ComposableScreen
  renderers** — when an element omits `fontFamily` or sets it to the
  literal `"inherit"`, the renderer resolves the family against
  `theme.typography.defaultFontFamily` before passing it to
  `useResolvedFontStyle`. Resolution helper exported as
  `resolveInheritedFontFamily` from the ComposableScreen `shared` module.
- New `resolveInheritedFontFamily(elementFontFamily, themeDefault)` util at
  `UI/Pages/ComposableScreen/elements/shared.ts`.

### Changed

- `ButtonElement`, `InputElement`, `TextElement` typings: `fontFamily?:
  string | "inherit"` (was `string`).

---

## [1.18.0] - 2026-05-06

### Added

- **`fontStyle` rendering** on `TextElement`, `ButtonElement`,
  `InputElement` (top-level), and `RadioGroupElement` /
  `CheckboxGroupElement` (`itemFontStyle`). Renderers pass the value through
  to the underlying `<Text>` / `<TextInput>` style, alongside `fontFamily` and
  `fontWeight`.
- **`setVariable` `Button` action** — `ButtonElement` handles a new action
  variant `{ type: "setVariable", name, value, label? }`. The handler writes
  to the ComposableScreen variable map (and syncs the headless variable map)
  before any subsequent action in the chain runs, so a following
  `"continue"` sees the updated value when `resolveNextStepNumber` evaluates
  branch conditions.

### Changed

- **`Button`/`Text`/`Input` font weight resolution** — switched from
  `useResolvedFontFamily` to `useResolvedFontStyle` from
  `@rocapine/react-native-onboarding`. When the registry matches a concrete
  weighted variant (e.g. `Inter-700`), `fontWeight` is suppressed on the
  rendered `<Text>` to avoid synthetic emboldening on top of an
  already-weighted font file.

### Fixed

- **`CarouselElement` sizing** — wrap the carousel in an inner
  `View flex:1` with `onLayout` and pass measured `width`/`height` to
  `react-native-reanimated-carousel` instead of `Dimensions.get("window")`.
  Render is gated until first measurement.
- **`OnboardingDataGate` error handling** — `useQuery` errors are now thrown
  so a host `ErrorBoundary` catches them, instead of silently rendering the
  `fontsFallback` forever.
- **`FontLoaderGate`** — resets registry to a loading sentinel before async
  registration and falls back to an empty registry on rejection so a fetch
  failure doesn't strand the gate.

---

## [1.17.1] - 2026-05-04

### Fixed

- **Runtime font registration** via `OnboardingProvider` — fonts declared on
  the onboarding payload now load correctly when the backend returns the
  variant-array shape (`{ family: [{ weight, style, url }, ...] }`). Previous
  versions silently failed with `loadSingleFontAsync expected resource of
  type Asset` and bogus `weight 8 from [object Object]` warnings, leaving
  `fontFamily` strings unmapped to weighted variants. No UI-package API
  change; fix lives in the headless SDK consumed by `FontLoaderGate`.

---

## [1.17.0] - 2026-04-30

### Changed

- **ComposableScreen typography elements use the runtime font registry** —
  `TextElement`, `ButtonElement`, and `InputElement` now call
  `useResolvedFontFamily(fontFamily, fontWeight)` from
  `@rocapine/react-native-onboarding` to resolve a `family + weight` request
  to the runtime-registered font variant. CMS authors continue to set
  `fontFamily` to the family name declared in the `Onboarding.fonts` manifest;
  the SDK picks the right registered variant (e.g. `Inter` + `500` →
  `Inter-500`) and falls back to the closest registered weight when an exact
  match is unavailable.

> Element Zod schemas are unchanged. No CMS migration required for existing
> payloads — they keep working with system fonts.

### Bumped

- Peer dependency on `@rocapine/react-native-onboarding` is now `^1.17.0`.

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
