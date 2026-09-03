# Changelog

All notable changes to `@rocapine/react-native-onboarding-ui` are documented
here.

---

## [Unreleased]

### Fixed

- **The ComposableScreen renderer now survives an element type this build does
  not know, and never leaves the user with nothing to press.** It parsed the step
  with a throwing `ComposableScreenStepTypeSchema.parse` inside
  `withErrorBoundary`, so a single unknown element type took the whole screen —
  and the fallback has no interactive control. Unknown element types are now
  omitted before that parse (the strip itself is in the headless package) and
  `console.warn`ed. Not dev-gated: a published screen running ahead of the
  installed SDK is precisely what a host needs to see in production logs.

  **Keyed to this package's own element union, not the headless one.**
  `getRenderableElementTypes()` derives from the `UIElementSchema` mirror in
  `UI/Runtime/types.ts` — the schema that actually parses the payload and backs
  `renderElement`'s dispatch. The two packages are joined by a peer-dependency
  range, so an installed app can resolve them at different versions, and keying
  the strip on the other package's list is wrong in both directions: strip an
  element this build can draw (warning that a known type is unknown), or keep one
  it cannot and throw the whole screen anyway, as before the fix.

  When a strip leaves nothing that can complete the step, the renderer passes
  `OnboardingTemplate` its own themed `button` and logs a `console.error` naming
  the step. The label is a hardcoded `Continue`, because the element carrying the
  authored copy is exactly what was stripped, and an untranslated word beats a
  screen the user cannot leave. A visible CTA rather than an automatic
  `onContinue()`: what survived the strip is still authored content worth
  showing, and auto-advancing would rip through every consecutive screen built on
  the same new element without the user seeing any of them. It is the answer both
  existing boundaries already give — an unknown *step* type renders a Continue
  button, and a paywall whose elements fail to parse calls `onContinue()` so the
  user is not trapped.

  Paywall parse boundaries are deliberately unchanged and stay strict: a paywall
  that cannot parse never opens and resolves `{status:"error"}`, which beats a
  full-screen modal missing its purchase or dismiss control.

---

## [1.74.1] - 2026-09-02

Version bump only — this release is entirely in the headless package: the
onboarding's audience params are now pinned when it is served, so a user
property written mid-onboarding no longer blanks and refetches the app, and
`useOnboardingStep` / `useOnboardingStart` share the gate's query. Nothing in
this package changed.

---

## [1.74.0] - 2026-08-27

Version bump only — this release is entirely in the headless package (the
`userProperties` store and `register(moment, feature)`). Nothing in this package
changed.

Worth knowing anyway, because it changes what a host must wire: audience
targeting now reads a persisted user-property store rather than only the
`customAudienceParams` prop, so `OnboardingProvider` holds its query for one
AsyncStorage read on mount. Pass `fontsFallback` and that frame is already
covered. See the headless CHANGELOG.

---

## [1.73.0] - 2026-08-27

### Added

- **`Paywall` step renderer** (`UI/Pages/Paywall/`) — renders a paywall **in
  flow position**, wrapped in `OnboardingTemplate` like any neighbouring step,
  so the progress header applies and the onboarding advances past it. The third
  consumer of `ScreenRenderer`, after `PaywallHost` and the ComposableScreen
  adapter; it is the sibling of that adapter and shares its shape.

  **HARD GATE: only a purchase advances.** This needs no purchase tracking,
  because an authored paywall already distinguishes the outcomes in its action
  list — `{type:"purchase", onSuccess:[{type:"continue"}]}` calls `complete()`
  with no outcome (advance), `{type:"dismiss"}` calls it with
  `{status:"dismissed"}` (stay). A custom screen is handed the same callback, so
  the gate applies to it identically.

  `"pending"` does **not** advance: a Stripe Payment Link resolves pending,
  meaning unconfirmed, and advancing would grant access for a payment that may
  never complete. A Stripe paywall on such a step needs an `onPending` branch.

  **Three structural cases SKIP the step with a named diagnosis rather than
  trap the user** — a paywall that cannot appear must not brick a paid funnel:
  no ancestor `PaywallProvider`, a moment absent from a settled catalog (a
  mis-typed key, an unpublished paywall, or a waterfall that matched nothing),
  and a paywall that cannot render (elements that fail validation, or an
  unregistered custom screen). Each log names what was wrong *and* what was
  available.

  A `"revalidating"` catalog that lacks the moment **waits** rather than
  skipping — it may be about to deliver it, and skipping would lose a sale to a
  race. Conversely a paywall already in hand renders during a revalidation
  instead of flashing a spinner.

- **`resolvePaywallStepDecision` / `shouldAdvanceOnComplete`** — the pure halves,
  exported and unit-tested. Extracted for the same reason
  `resolvePaywallModalDecision` was: this package has no render harness, so the
  decision is where testable behaviour has to live.

### Changed

- **Register `customScreens` on `PaywallProvider`, not `PaywallHost`.** The
  host's prop still works and wins where passed — no existing integration
  breaks — but it is invisible to a `Paywall` onboarding step, which renders
  custom screens itself and never goes through `PaywallHost`. `PaywallHost` now
  falls back to the provider's registry when its own prop is absent; the two are
  deliberately **not merged**, so "which map is this id missing from" stays
  answerable.

- **`CustomPaywallScreenProps` / `CustomPaywallScreens` moved to the headless
  package.** `UI/Paywall/CustomPaywallScreen.ts` is now a re-export, so the
  deep-import path 1.72.0 introduced resolves unchanged.

- **`UI/types.ts`'s `OnboardingStepType` union gains `PaywallStepType`.** Worth
  noting for anyone switching exhaustively over it.

---

## [1.72.0] - 2026-08-27

### Added

- **`PaywallHost` renders host-registered custom screens.** New `customScreens`
  prop — a map from the studio's `customScreenId` to a component — so a paywall
  the author set to Render mode "Custom screen" draws your own screen instead of
  an element tree:

  ```tsx
  const SCREENS = { "paywall-native-v2": NativePaywall }; // module scope: stable
  <PaywallHost customScreens={SCREENS} />
  ```

  `PaywallHost`'s only prop, and its first. Registered here rather than on
  `PaywallProvider` (where `customActions` lives) because the provider is the
  headless half and has no business holding a map of React components.

- **`CustomPaywallScreenProps` / `CustomPaywallScreens`** — the contract a
  registered screen implements: `payload` (the product map, never `undefined` —
  an absent `customPayload` on the wire arrives as `{}`), `complete`, and
  `paywall` (`id` / `name` / `moment` / `customScreenId`, enough to report a
  conversion without also handing over an `elements` tree it has no use for).
  No product runtime, deliberately: see the headless changelog.

  `complete` MUST be called on every exit path, including your screen's own
  close button — until it is, the paywall stays active and every later
  `present()` resolves `"already-presenting"`. The acknowledgement timeout
  covers a presentation that never *appeared*, not one never *closed*.

### Changed

- **A custom screen renders inside the SAME `Modal` as an element tree**, so it
  inherits the `onShow` acknowledgement (the iOS refused-presentation
  recovery), Android `onRequestClose`, and the nested `SafeAreaProvider` without
  doing anything. That is the whole reason this lives in the SDK rather than
  being left to each host to rebuild. It is also wrapped in the same error
  boundary, so a crash in the host's own screen resolves `"render-error"`
  instead of trapping the user behind an escape-less full-screen Modal.

- **`resolvePaywallModalDecision` does not call the element parser in custom
  mode** — skipped, not merely ignored. Flipping a paywall to custom does not
  destroy its element tree (so flipping back restores it), and that leftover
  tree must not be parsed or rendered on the way past. Two new decisions,
  `"show-custom"` and `"unknown-custom-screen"`.

- **No theme background is drawn behind a custom screen.** The registered
  component owns the whole surface; wrapping it would mean a host fighting a
  colour it never asked for.

---

## [1.71.0] - 2026-08-26

### Added

- **`onPending` on the `purchase` ButtonAction.** A `"pending"` purchase result
  now dispatches its own follow-up actions instead of only logging a warning.
  This is not a rare branch: a **Stripe Payment Link purchase always resolves
  `"pending"`**, because `purchase()` opens the link and the browser takes over
  — so before this, a Stripe buy button could not dismiss the paywall or
  navigate, and the user returned from Safari to an untouched screen.

  Deliberately its own hook rather than falling through to `onSuccess`: pending
  means **unconfirmed**, and routing it to success would let a paywall grant
  access for a purchase that may never complete. Never grant access from
  `onPending` — read entitlement state.

  Optional and additive; a purchase action with no `onPending` still warns, as
  before.

---

## [1.70.0] - 2026-08-26

### Fixed

- `PaywallHost`'s parse-error log read `activePaywall.placement`, which the
  rename removed from `Paywall` — so `build:ui` failed while
  `packages/onboarding`'s own type-check passed. The two are separate
  workspaces; only the monorepo-root scripts see across them.

### Note

- The `placement` argument on `presentPaywall(placement)` and on the
  `presentPaywall` ButtonAction is **unchanged**. That is element-contract
  surface, not the `Paywall` wire type, and renaming it would touch all five
  element mirrors.

---

## [1.69.0] - 2026-08-21

### Notes

- No UI changes. Version moves in lockstep with `@rocapine/react-native-onboarding`, which adds `catalogStatus` / `productsStatus` to `usePaywall()` so a host can tell a settled catalog from one that is still being revalidated behind a cache hit. See that package's changelog.

---

## [1.68.2] - 2026-08-21

### Fixed

- **A `Carousel`'s pagination dots announced "Slide 1 of 6 - undefined" to screen readers**, once per dot. The library builds each dot's accessibility label as `Slide ${i+1} of ${n} - ${carouselName}` and interpolates it **unguarded** even though `carouselName` is optional (`Pagination/Custom/index.tsx:84`), so omitting the prop puts the literal string "undefined" into speech. `CarouselElement` now passes the element's authored `name` — already the human label for the element everywhere else, and it distinguishes two carousels on one screen — falling back to `"Carousel"` when unnamed, because passing an absent `name` through would reproduce the same bug. Found on device via an accessibility inspector.

### Notes

- **Testing 1.68.1's Carousel fix with Metro already running will show the OLD crash.** Metro caches module resolution, so after reinstalling `react-native-reanimated-carousel` the app keeps red-boxing until the bundler is restarted — which reads as "the fix didn't land". Restart Metro after the reinstall. (Recorded here because it cost a real testing cycle.)
- **1.68.1's narrowed peer range does downgrade an existing install**, not just a fresh one: an app that had transitively resolved 5.1.1 dropped to 4.0.3 on reinstall, verified with `npm ls`. Caveat on generalising — that app never listed the package in its own `package.json`, so npm had no direct dependency entry to honour. A host that pinned 5.x explicitly still has to change its own manifest.
- `dotsMarginTop` is the gap ABOVE the dots container; the space between the dots and whatever follows is `dotsMarginBottom`, which **defaults to 0**. Both are applied to the pagination container itself, not to the slides.

---

## [1.68.1] - 2026-08-21

### Fixed

- **`Carousel` could not render at all in a fresh install** — red box on device, paywall dead. The peer range for `react-native-reanimated-carousel` was `"*"` and not optional, so npm resolved the newest major and every fresh install got **v5**. v4 exports Carousel as a DEFAULT (`export default Carousel`); v5 removed that and exports named (`export { Carousel }`), so the default import in `CarouselElement.tsx` bound `undefined` and React threw *"Element type is invalid … got: undefined. Check the render method of `Carousel`."* `Pagination` is named in both majors and resolved fine, which is exactly what made the failure look like an element bug rather than a dependency one. This repo never saw it because its devDependency pins `^4.0.3`. Found on a real device; nothing offline could have caught it, because a payload cannot express a runtime peer requirement and the tree was schema-valid throughout.
- **The peer range is now `^4.0.0`**, matching the major the code is written against and tested on. That is the whole fix: fresh installs resolve v4 again and the existing default import is correct.

### Notes

- **How it failed is worse than that it failed.** The render error is caught by `PaywallContent`'s error boundary, which resolves `complete({status:"error"})` — so on a home placement it is a silently missed impression, and a host that falls through to another paywall engine on `"error"` sees conversion quietly route away with no red box in production. A dead element and an invisible one are not the same severity.
- **v5 is a migration, not an import fix, and the range must not be widened without it.** v5 also drops `autoPlay`, `autoPlayInterval`, `snapEnabled`, `pagingEnabled`, `mode` and `modeConfig` — all used by this element and all authored in payloads — and narrows `onProgressChange` from `(offsetProgress, absoluteProgress)` to `(progress)` while the element reads the second argument. It additionally requires `react-native` >= 0.80, `react-native-reanimated` >= 4.1 and `react-native-worklets`. Reasoning recorded at the import so a future "modernize the import" change cannot land alone.
- **Same class elsewhere, not fixed here.** An audit of both packages found many peers still on `"*"`: required ones include `react-native-safe-area-context`, `react`, `react-native` and `@types/react`; optional ones include `expo-image`, `expo-video`, `expo-haptics`, `lottie-react-native`, `rive-react-native`, `@react-native-picker/picker`, `@react-native-community/slider` and `datetimepicker`. Each needs its own judgement about which majors the code supports, so they are not swept into a bug fix. Separately, **`react-native-reanimated` is used but declared as a peer nowhere**, so a host missing it gets a runtime failure with no npm warning.

---

## [1.68.0] - 2026-08-21

### Fixed

- **Corrected the comment defending the display-only interpolation constraint** added in 1.67.1. The behaviour was and is right — `handleSelect`/`handleToggle` store `item.label` raw while only the rendered text is interpolated — but the stated reason was not: it claimed this "keeps `{{plan.label}}` meaningful", and there is no such accessor. The variable bag is flat, so `{{plan.label}}` resolves to `""`. The real reader of a stored label is plain `{{plan}}` through `interpolate`, which prefers a variable's `label` while `interpolateIdentifier` prefers its `value`. That makes the risk **larger** than described: interpolating before the store would make every `{{plan}}` in a `Text` — a plain, common way to echo the chosen plan — render "$39.99" where the author meant "Quarterly". A comment that defends a constraint by naming a mechanism that does not exist invites a future refactor to conclude the constraint is vacuous and remove it, so this is a correctness risk in prose rather than a cosmetic fix. Both element files now state the mechanism with the two functions' outputs side by side.

### Notes

- No behaviour change in this package. Version moves in lockstep with `@rocapine/react-native-onboarding`, which adds `pricePerDay`.

---

## [1.67.1] - 2026-08-21

### Fixed

- **`RadioGroup` and `CheckboxGroup` item text did not interpolate `{{variables}}`.** `{item.label}` and `{item.subLabel}` were rendered raw — `interpolate` appeared nowhere in either file, while `TextElement` has always used it. The practical effect: **a price could not appear on a plan card**, so a multi-plan paywall (the canonical subscription paywall, and the one job these elements exist for) could not show per-plan pricing, strikethrough comparisons, or any product value at all. Authors were pushed into laying prices out in a parallel row that only aligns while every item happens to be the same width. Both elements already subscribe to the variable store via `useVariables()`, so this needed no new plumbing.
- **Interpolation is DISPLAY-only, deliberately.** `handleSelect` / `handleToggle` still pass `item.label` **raw** into `setVariable(name, { value, label })`. Interpolating before the store would put a resolved price into the selected entry's `label`, and `interpolate` favours a variable's `label` over its `value` — so `{{thatVariable}}` would silently start rendering a price elsewhere on the screen. The machine-identifier path (`purchase.product` via `interpolateIdentifier`, which reads `value` first) is unaffected either way, but only because these two stay display-only. `accessibilityLabel` interpolates too — a screen reader must not read a raw template.
- **Mirrored the discriminated-union conversion** in `UI/Runtime/types.ts` — see the headless 1.67.1 entry for what it fixes. The UI copy is the one `PaywallHost` actually parses with, so it carries the crash fix.

---

## [1.67.0] - 2026-08-21

### Fixed

- **A paywall that failed validation reported nothing at all.** `PaywallHost` parses `elements` before opening the Modal (so a malformed payload can never reach the escape-less fullScreen Modal), but the decision kept only `success` and threw the `ZodError` away — so a paywall that could never render resolved a bare `"error"` with **no log at any level**, and the cause was only reachable by fetching the served payload and re-running the schema by hand. It cost two multi-hour investigations to identify a real case by elimination: a `Button` authored with `variant: "plain"`, which is not in `filled|outlined|ghost`. The validation error is now carried on the decision and logged with the failing path AND the value the author actually wrote, e.g. `0.children.0.children.0.props.variant: Invalid option: expected one of "filled"|"outlined"|"ghost" (authored value: "plain")`. Almost always a CMS **data** bug the host cannot fix and the author must, so the message says so.
- **`PaywallHost` now confirms the paywall actually appeared**, via the Modal's `onShow` → `acknowledgePresentation`. Without that signal, a presentation the platform silently refused was indistinguishable from one the user was reading, and the refused case wedged every later `present()` call for the life of the process — see the headless 1.67.0 entry.
- **`parse-error` and `render-error` now reach the caller as reasons.** Both went through the `ScreenHost` narrowing wrapper, which reduces an outcome to `{status}` and dropped the reason; they now resolve the pending `present()` directly.

### Added

- **`describePaywallParseError(error, elements?)`** — renders a Zod failure as one line naming the offending paths and the authored values. Exported and pure because this package has no render harness, and the entire value of the message is that it is precise. It **walks the issue tree**: the element schema is a 26-member union of unions, so the top-level issue is always `invalid_union` / "Invalid input" at the array index, and reporting only that prints `0: Invalid input` — no better than the discarded error it replaces. It also ranks paths the author actually WROTE above missing-prop complaints from non-matching variants, which is what separates "your data is wrong" from "you are not a Text element"; in the real case, depth alone surfaced `props.content/url/intensity: expected string, received undefined` while the true cause sat at the same depth.

---

## [1.66.0] - 2026-08-19

### Fixed

- **`entering.once` defeated the entrance it was meant to protect (1.65.0, device-confirmed).** `decideEnteringPlay` returned a two-valued `{ play: boolean }`, and `OnceAnimatedBox` mapped both `false` cases to "strip `entering`" — which renders an `Animated.View` at full opacity. But "already played" and "not settled yet" are opposites: the first must render VISIBLE, the second must render HIDDEN. So a held element sat fully visible with no entrance, then blinked to opacity 0 and re-faded when the hold released — no entrance to see, plus a flash that did not exist before `once`. Now three states (`hold` / `play` / `done`), with `hidden` distinguishing `hold` from `done` in the OUTPUT rather than only in intent. The hide is applied on the wrapper while no entering builder is attached, and releasing the hold changes the key, so opacity and the builder never coexist and cannot fight.
- **`enteringSettleDelayMs` was unreachable from the documented entry path.** 1.65.0 put it on `ScreenHost`, reasoning that the host is the only party that knows its navigator's transition duration — correct, except `OnboardingPage` *builds* the `ScreenHost` itself, so every consumer entering through it got `undefined` and was pinned to the 350ms default with no override. The escape hatch the 1.65.0 docs point at ("if an entrance still reads early, raise the delay before suspecting the mechanism") could not be taken, which also made the intended diagnosis — telling "the default doesn't match your transition" apart from "the deferral is broken" — impossible. Now threaded `OnboardingPage` → `ComposableScreenRenderer` → `ScreenHost`, following `keyboardVerticalOffset`'s existing path exactly.

### Added

- **A compile-time reachability gate on `OnboardingPage`**, so this class of defect cannot ship again. Every `ScreenHost` field not explicitly declared internally-provided must be settable from `OnboardingPageProps`, asserted in the type system with no runtime cost. Adding a new host field now fails the build until it is either threaded through `OnboardingPage` or deliberately marked as SDK-owned. Verified against both regressions: removing `enteringSettleDelayMs` from the props (the 1.65.0 bug) and adding an unthreaded host field each produce `Type 'false' does not satisfy the constraint 'true'`. `OnboardingPageProps` is now exported, which consumers wrapping the component wanted anyway.

### Notes

- The gate exists because nothing else could catch this: the tests exercise `ScreenRenderer` with a hand-built host — the one caller for whom every field is trivially reachable — so the consumer path (`OnboardingPage` → `ComposableScreenRenderer` → host) was never the thing under test. Thanks to the consuming session for proposing the check.
- A host that renders `ScreenRenderer` directly with its own `ScreenHost` was never affected; this only fixes the `OnboardingPage` path, which is the one nearly everyone uses.
- `PaywallHost` still hardcodes no delay, so a paywall's `entering.once` uses the default. Left alone deliberately: a modal presentation is a different transition from a stack push, and no one has asked for it — worth revisiting if a paywall ever needs a deferred entrance.

---

## [1.65.0] - 2026-08-19

### Added

- **`OnceAnimatedBox` and a screen-scoped entering latch** back `animation.entering.once`. The latch is a plain mutable `Set` behind a stable object, and the decision is derived from a value sampled **once per mount** — both deliberate: `markPlayed` runs while the animation is in flight, so a reactive latch (or a live re-read on any unrelated re-render) would flip the decision to "already played", change the wrapper key, remount the element and cut the running animation off at the knees.
- **The settled signal is a duration, injectable by the host** via the new optional `ScreenHost.enteringSettleDelayMs` (default `DEFAULT_ENTERING_SETTLE_MS`, 350ms). **Treat the default as a starting point, not a measurement** — one app using a react-native-screens push shell measured ~520ms for a safe reveal, so if an entrance still reads early, raise the delay before suspecting the mechanism. It is not a framework signal because `InteractionManager.runAfterInteractions` fails in two **opposite** ways depending on version, so checking whether it works in yours is not a route back to it: it is **stubbed in RN 0.85+** (a bare `setImmediate` — fires on the next tick and defers nothing), and on earlier versions where it is implemented, its queue reportedly does not drain while `react-native-screens` push transitions are active (fires late or never — and react-native-screens is the default for a native stack). Separately, RN's `Image` has never registered an interaction handle in any version, so it would not have covered decode either way. The host is the only party that knows its own navigator's transition duration, which is why the knob lives on `ScreenHost`.
- Kept in its own `EnteringLatchContext` rather than folded into `AnimatedVariablesContext`. That registry has the right lifetime and stability, but its contract is "SharedValues a producer animates on the UI thread"; overloading it with an unrelated latch would make its name a lie.

### Notes

- Scoped per screen, so "once" means once on that screen and each screen defers its own arrival.
- With no provider above it (a renderer used outside `ScreenRenderer`) the context fails **open**: `settled: true`, so `once` degrades to "play on first mount, never again" rather than going silent.

---

## [1.64.0] - 2026-08-19

### Added

- **`ProgressBar` honours `backButtonStrokeWidth` and `paddingTop`.** The chevron's stroke weight was hardcoded at `2`; the header's top padding was the bare safe-area inset. Both are now configurable from `configuration.progressHeader`, with `paddingTop` **added to** the inset rather than replacing it so a payload cannot push the header under the notch.

### Notes

- Defaults reproduce the previous rendering exactly.
- The reserved right spacer column still cannot be removed — see the headless `1.64.0` notes. A fork whose track reaches the right padding edge will see it pull inward, and `trackFlex` cannot shrink the column to zero.

---

## [1.63.0] - 2026-08-19

### Added

- **`Repeat` renderer — layout-transparent materialization.** Returns a fragment rather than a view of its own, so the rows become direct children of the enclosing stack and that stack's `gap`/direction/alignment apply per row exactly as if the rows had been hand-written. Its props deliberately do **not** extend `BaseBoxProps`: with no view to style, box props would silently do nothing. Row scope is published on **two** paths, because the runtime reads variables two ways and a row needs both — `VariablesContext` for render-time reads (`{{item.x}}`, `renderWhen`) and a derived `RenderContext` with a wrapped `getVariables` for press-time reads, since `runActions` reads the live store ref rather than context. Without the second half a repeated card could be drawn but not answered (a `setVariable` expression on `{{item.id}}` would resolve empty). Ids are suffixed per row so N materializations never collide.
- **`ReplayingAnimatedBox`** backs `animation.replayWhen`, deriving the wrapper's React key from the watched variable so `entering` re-fires on a write. Split from `AnimatedBox` rather than calling `useVariables()` inside it: a context subscription bypasses `React.memo`, so subscribing in the shared component would re-render every animated element on every variable write.
- **`ProgressBar` honours `configuration.progressHeader`** — colours, `height`, `borderRadius`, `paddingHorizontal`/`paddingBottom`, `gap`, `trackFlex`, back-button colour/size/visibility. It reads the config itself via `useProgressHeaderConfig()` rather than taking props, because the header is host-rendered and prop-threading would need every host to change code. Resolution is **explicit prop → configuration → theme → default**; the config outranks the theme because a theme-only knob could not reach the screen at all (nothing in the SDK reads `configuration.theme`). It also styles the **back button's container** (fill, border colour/width, square size, radius), not just the chevron — an explicit `backButtonContainerSize` centres the glyph and drops the default padding so the chip measures exactly as authored. Every default reproduces the previous rendering; `borderRadius` now derives from the height instead of a fixed `10`, which is visually identical at the default and keeps a taller configured bar a pill.
- **`inset` applied on `ZStack` children**, dropping the opposite side's `0` and the shared anchor per positioned axis so the child ends up content-sized and corner-pinned.
- **`Image` plain/expression component split**, mirroring `Text`, so the static case (nearly every image) keeps memo-skipping on variable writes.
- **`Carousel` publishes its normalized swipe position** into the screen-scoped animated-variable registry, consumed on the UI thread by `GatedElement`. `progress` itself stays raw, because `Pagination` and the `scrollTo({ count: index - progress.value })` arithmetic depend on the library's unwrapped scale.

### Changed

- **`RenderContext.renderChildren` accepts an optional third `ctxOverride`.** `Repeat` uses it to render each row against a derived context; every other caller is unaffected.
- **Peer dependency on `@rocapine/react-native-onboarding` tightened to `^1.63.0`** (was `^1.23.0`). `ProgressBar` now imports `useProgressHeaderConfig`, which does not exist in earlier headless versions, so the old range permitted a combination that crashes at runtime. The two packages have always shared a version by policy; the range now says so.

### Fixed

- **`ErrorBoundary`'s `onError` note corrected.** It justified withholding an escape callback from the onboarding host with "a back button already exists OUTSIDE that boundary" — which is conditional on the step opting into the progress header. `ProgressBar`'s whole subtree, back chevron included, sits behind `isProgressBarVisible` (`activeStep.displayProgressHeader`), so on a header-off step a caught error leaves no exit in either direction. Comment-only; giving the host an escape is a product decision.

---

## [1.62.0] - 2026-08-17

### Added

- **`PaywallHost` — renders the active paywall in a fullScreen Modal.** Mount once as a sibling of the app, alongside `PaywallProvider`. It reads `usePaywallHost()` for which paywall (if any) is active and renders it using the same `ScreenRenderer` engine as a `ComposableScreen` onboarding step — a paywall is authored with the exact same elements and `Button.actions`. Android hardware back resolves exactly like the in-content `dismiss` action, so a user is never trapped inside a paywall; its own nested `SafeAreaProvider` means an authored `SafeAreaView` measures real insets even though a `Modal` presents into a separate native view hierarchy from the app root.
- **`dismiss` and `presentPaywall` press-action dispatch in `runActions`.** `presentPaywall` is wired into the onboarding adapter's own `ScreenHost` too (`Pages/ComposableScreen/Renderer.tsx`), so a `presentPaywall` action fired from an ordinary onboarding step reaches a real paywall host when one is mounted.
- **`ScreenElementsSchema`** is now exported from the package root (alongside the existing `UIElement` / `UIElementSchema`) — the schema `PaywallHost` parses a paywall's `elements` with.

### Fixed

- **`ErrorBoundary`'s Zod-error formatting works again.** It read `error.errors`, a property that doesn't exist on Zod 4's `ZodError` (renamed to `.issues`) — every schema validation failure in a `ComposableScreen` step or a paywall showed the generic "An error occurred while formatting the Zod error" fallback instead of the actual path/message detail. Fixed; the two `@ts-ignore` suppressions that hid the original type error are also removed.

---

## [1.61.0] - 2026-08-13

### Added

- **`ScreenHost.products` — the renderer can now surface live store prices.** `ScreenHost` and `RenderContext` gain an optional `products?: ProductRuntime`. `ScreenRenderer` overlays the resolved products into the variable bag (via `withProductVariables`), so any existing element interpolates them: `{{product.yearly.pricePerWeek}}`, `renderWhen` on `products.loaded`, and so on. No new element type was needed.
- **`purchase` and `restore` dispatch in `runActions`.** Both read `ctx.products`. Follow-up arrays (`onSuccess` / `onCancel` / `onNothingToRestore` / `onError`) are full `ButtonAction[]` run through a nested dispatch, so a `"continue"` inside `onSuccess` still works and stays terminal for that nested run.
- **`withProductVariables`** (`Runtime/variables.ts`) — pure overlay in which product values **win** over author variables. Prices are facts read from the store; a displayed price must match what the store charges.

### Changed

- **Product actions never fail silently.** `purchase` and `restore` warn rather than no-op when there is no product runtime, when the named product slot is unresolved, when the result is `pending` (Ask-to-Buy / deferred transactions), and when the result is an error with no `onError` arm declared. A silent no-op is indistinguishable from a working buy button.

### Notes

- `ProductRuntime` sits in `RenderContext`'s dependency array, so it **must** be referentially stable across variable writes — `useProducts` guarantees this. An unstable one re-renders every memoized element on every write, and no type error or test in this repo catches it. The contract is documented on `ScreenHost.products` and at the `ctx` memo in `ScreenRenderer.tsx`.
- Onboarding behaviour is unchanged for hosts without billing; see the headless `1.61.0` notes.

---

## [1.60.0] - 2026-08-13

### Added

- **`ScreenRenderer` + `ScreenHost` — the rendering engine is now screen-agnostic.** `ScreenRenderer({ elements, host })` renders a `UIElement` tree against an injected `ScreenHost` (`variables`, `setVariable`, `complete`, `customActions`, `keyboardVerticalOffset`) and knows nothing about onboarding. `ComposableScreenRenderer` is now a thin onboarding adapter that builds a host from the onboarding contexts and supplies `OnboardingTemplate`; a paywall renderer becomes a sibling adapter over the same engine. New exports from the package root: `ScreenRenderer`, `noopScreenHost`, and the types `ScreenHost` / `ScreenRendererProps`.

### Changed

- **Element runtime moved to `UI/Runtime/`.** `UI/Pages/ComposableScreen/elements/*` is now `UI/Runtime/elements/*`, and the `UIElement` union mirror is `UI/Runtime/types.ts`. `UI/Pages/ComposableScreen/types.ts` keeps the onboarding **step** schema and re-exports the runtime types, so existing deep imports still resolve. `UI/Runtime/` no longer imports from `Pages/`, `Templates/`, or the onboarding provider — that decoupling is what lets a second host reuse the engine.
- **No behaviour change for onboarding.** The element memoization architecture is preserved exactly: `RenderContext` stays referentially stable across variable writes (its dependency set is unchanged), and volatile variable maps still travel through `VariablesContext`. Rendered tree, keyboard-avoidance offset, and the root-background handling are identical.

### Notes

- `ScreenRenderer`'s `elements` prop **must be referentially stable** across renders — it drives every element's memoization. The onboarding adapter satisfies this via its `[step]`-memoized parse; a custom host that re-parses or re-maps elements each render would silently lose element memoization with no type error.

---

## [1.59.2] - 2026-07-24

### Added

- **`TypewriterText` accepts `preset: "none"` to disable the per-character animation.** Previously the preset was always an entering builder and omitting it fell back to the `"FadeInDown"` default, so there was no way to turn the animation off. With `"none"`, hold-layout mode renders the full text immediately; `cursor` mode still types progressively (the typing clock is separate from the entering builder), just without a fade on each character.

---

## [1.59.1] - 2026-07-23

### Changed

- **Version sync with headless `1.59.1`** — no UI-package code changes. The headless release fixes the start-node lookup so `useOnboardingStart()` reads `configuration.startStepId` instead of `metadata.startStepId` (`@rocapine/react-native-onboarding` 1.59.1).

---

## [1.59.0] - 2026-07-17

### Changed

- **Version sync with headless `1.59.0`** — no UI-package code changes. The release adds an explicit start node, end-via-branching (the `ONBOARDING_END_STEP_ID` sentinel), and an `onComplete` completion callback in the headless SDK (`@rocapine/react-native-onboarding` 1.59.0). Renderers are unaffected: the CTA still calls the host `onContinue`; the host decides between advancing and calling `completeOnboarding()`.

---

## [1.58.0] - 2026-07-16

### Added

- **`runActions` passes a `setVariable` setter to `custom` action handlers.** The dispatcher now calls host handlers with `{ variables, setVariable }`; `setVariable` is the render context's setter (`setVariableAndSync`), so a handler write propagates to both the UI variable store and the headless branching store. Pairs with the headless `CustomActionHandler` type change (onboarding 1.58.0).

---

## [1.57.4] - 2026-07-09

### Fixed

- **Onboarding images no longer flash / re-decode every time they're shown.** `Image` and `ProgressiveBlurImage` rendered through expo-image with no `cachePolicy`, so it used the default `"disk"` — memory-less, meaning every time an image view mounted (each step navigation) it re-read and re-decoded from disk, producing a blank-then-pop flash. Both render sites now use `cachePolicy="memory-disk"`, keeping the decoded bitmap in memory (with disk fallback) for instant re-display. Pairs with the headless `preloadAssets` change so prefetched images are warmed into memory, not just disk.

---

## [1.57.3] - 2026-07-09

### Fixed

- **Bordered, rounded `Image` elements now fill their frame with no white corner gap (ROC-2984 finding #1).** When an `Image` has a shadow and/or `backgroundGradient`, it renders through a wrapper `View` that paints the border while the raster image fills the content box inside it. The inner image was clipped to the *outer* `borderRadius`, over-rounding its corners relative to the border's concentric inner edge (radius = outer − `borderWidth`) and leaving a white gap at the corners — most visible on the `week-good` / `week-bad` option photos (`borderRadius: 24`, `borderWidth: 2`). The inner image is now clipped to the concentric inner radius (`max(0, borderRadius − borderWidth)`) so its corners sit flush inside the frame. Images with no `borderRadius` are unchanged, and the shadow-bearing wrapper is left un-clipped (adding `overflow:hidden` there would clip the iOS shadow — the reason the wrapper/inner split exists).

---

## [1.57.2] - 2026-07-09

### Fixed

- **ComposableScreen no longer flashes a grey band between the content and the keyboard (ROC-2984 finding #2).** The root `KeyboardAvoidingView` had no background, so the keyboard-height padding it inserts on keyboard open (`behavior:"padding"` on iOS) exposed the grey `OnboardingTemplate` container (theme `neutral.lowest`) behind it. The renderer now paints that padding region with the step's own outermost element background (`elements[0].props.backgroundColor`) — but only when that first element is a full-bleed, unconditional root (`flex` or `height:"100%"`, no `renderWhen`), so a content-sized, gated, or decorative first element can't overpaint the themeable page. Purely additive — a true no-op otherwise (the themeable page background still shows through), with no change to keyboard-avoidance behavior or the public API. Known gap: a root whose background is a `backgroundGradient` (no solid `backgroundColor`) is not yet covered — the band can still appear there.

---

## [1.57.1] - 2026-07-09

### Fixed

- **Threshold-based loaders animate smoothly again (`renderWhen` reacts to a sweeping `ProgressIndicator`).** A stepped loader — one `ProgressIndicator` (`autoplay`) driving sibling checkmarks via `renderWhen` thresholds (e.g. `loaderProgress gte 33`) — previously stayed on the first step for the whole sweep and then flipped every step to done at once. That was because the boundary-only variable write (the [1.57.0] re-render fix) means the store variable only changes at `0`/`max`, so the intermediate thresholds never fired. The autoplay `ProgressIndicator` now also publishes its live sweep as a screen-scoped animated value, and a `renderWhen` that depends solely on that variable is evaluated from the live value **on the UI thread**, flipping only its own node as each threshold is crossed. The store write stays boundary-only, so the re-render fix is fully preserved.

### Added (internal)

- `AnimatedVariablesContext` — a stable, screen-scoped registry of animated variables (reanimated `SharedValue`s published by autoplay `ProgressIndicator`s). Separates ephemeral screen-animation state from durable "concept" variables in the store. Internal to `ComposableScreen`; no schema or public API change. Conditions that mix variables, nest groups, or use non-numeric operators are unaffected and still evaluate against the store.

---

## [1.57.0] - 2026-07-01

### Changed

- **ComposableScreen no longer re-renders the whole element tree on every variable write.** The `RenderContext` is split into a stable slice (theme, setVariable, onContinue, customActions, renderChildren) passed by identity-compared props and a volatile `VariablesContext` consumed via `useVariables()`. Element components are memoized and dispatch flows through a memoized `ElementHost` (non-gated) / `GatedElement` (`renderWhen`), so a write (Input keystroke, Carousel page change, `ProgressIndicator` autoplay tick) now re-renders only the components that actually read that variable. Purely internal — no schema or API change.

### Fixed

- **In-flight animations no longer reset when an unrelated variable changes.** The prior full-tree re-render churned the `react-native-reanimated` mapper graph, visibly resetting running animations on sibling elements mid-sweep; memoization isolates each write to its consumers.

---

## [1.56.0] - 2026-06-30

### Added

- **`TypewriterText` renderer** — reveals text character-by-character with a staggered `react-native-reanimated` entering animation. Each character is a real `Animated.Text` flex item (not an inline span, so transform-based presets like `FadeInDown` work); in the default hold-layout mode characters are grouped by word (no mid-word breaks) and hold their layout from frame 0 (no reflow), revealed via per-char entering delay. `cursor` mode switches to a true progressive typewriter — characters mount one per `stagger` so the line grows left-to-right and a blinking caret follows the last typed character. `loop` replays the reveal by re-keying the characters each cycle. Font resolution via `useResolvedFontStyle` (called once); `textAlign` maps to row justification.

---

## [1.55.1] - 2026-06-26

### Added

- **`ZStack` `justifyContent` / `alignItems`** — anchor each content-sized layer within the full-bleed stack. A layer that fills (`flex`/`height`) ignores them; the per-child wrapper stays `box-none`, so a content-height bottom CTA can float over a scrollable layer (`justifyContent: "flex-end"`) while the scroll behind it keeps receiving touches. Defaults (`flex-start` / `stretch`) preserve prior behavior.

---

## [1.55.0] - 2026-06-25

### Added

- **Radial `backgroundGradient`** — `GradientBox` now renders a `{ type: "radial", center?, radius?, stops }` gradient via `react-native-svg` (a bundled dep, always available — unlike linear, which needs the optional `expo-linear-gradient`). `center` defaults to `{ 0.5, 0.5 }` and `radius` to `0.75` (both 0–1 box fractions, `objectBoundingBox` units → ellipse on a non-square box). Stops without an explicit `position` are distributed evenly. The radial branch sizes to its content identically to the linear / plain-View paths.

---

## [1.54.0] - 2026-06-23

### Changed

- **Version parity bump.** No UI changes; released in lockstep with `@rocapine/react-native-onboarding` 1.54.0 (headless `cacheKey` option + `clearCache()`).

---

## [1.53.0] - 2026-06-22

### Added

- **Configurable `DatePicker` label format** — the `DatePicker` renderer now honors the new `format` prop (`Intl.DateTimeFormatOptions` subset), passing it to the `toLocale*String` call matching `mode` so the Android trigger text and the stored variable `label` reflect the author's chosen format (12h/24h, day/month/year style, etc.). Falls back to the existing medium-style defaults when `format` is omitted.

### Fixed

- **`DatePicker` label now respects `locale`** — the label formatter previously ignored the `locale` prop (always used the device default); it is now threaded into `formatDate`, so the displayed/stored label localizes alongside the native picker.

---

## [1.52.0] - 2026-06-22

### Added

- **`useProgressHeaderInset` hook.** Returns the ProgressBar overlap a screen must add below its own top safe-area inset (`headerHeight - insets.top`, clamped to 0; naturally 0 when the bar is hidden). Built on the new headless `useOnboardingHeaderHeight`.

### Changed

- **`ProgressBar` self-measures and publishes its height.** It now reports its real footprint via `onLayout` into the headless context (and resets to 0 when hidden), so step content can lay out below it without a hardcoded guess. Host apps need no change — they already render `<ProgressBar/>`.
- **`OnboardingTemplate` uses the measured header inset.** The hardcoded `paddingTop: 40` (when `displayProgressHeader`) is replaced by the real measured overlap, fixing over/under-padding on devices whose status-bar inset differs from the old guess.
- **ComposableScreen `KeyboardAvoidingView` offset.** `keyboardVerticalOffset` now defaults to the measured `headerHeight` instead of `0`.

### Fixed

- **`SafeAreaView` element now accounts for the ProgressBar.** A ComposableScreen `SafeAreaView` previously applied only the device top inset, so the bar (which sits above it) overlapped content. It now adds the bar overlap to its top padding — subtracting the device inset when it applies the `top` edge itself (no double-count), or adding the full footprint when it doesn't. Only the screen's top-most `SafeAreaView` should carry this (a nested top-edge one would double-offset).

---

## [1.51.2] - 2026-06-22

### Fixed

- **ComposableScreen `RadioGroup` / `CheckboxGroup` — container honors `flex` / `flexGrow` / `flexShrink`.** The group container style threaded only `width`/`height`, so `flex:1` on a group was a no-op — groups sized to content and image-grid columns rendered unequal. The container now applies `flex`/`flexGrow`/`flexShrink` from `BaseBoxProps`, so a `flex:1` group fills its parent and image grids get fluid, equal-width columns without fixed-percentage widths.

---

## [1.51.1] - 2026-06-22

### Fixed

- **ComposableScreen `RadioGroup` / `CheckboxGroup` — centered label/subLabel.** With `itemAlignItems: "center"` (or `"flex-end"`), the label/sub-label now actually center (or right-align) within the item card. The content wrapper was content-width with no grow, so the item row pinned it left and `itemAlignItems` only centered within that narrow block; it now `flexGrow:1` + `alignSelf:"stretch"` to fill the card. Label/sub-label `<Text>` also gain a matching `textAlign` so multi-line copy aligns instead of reading left. Default (no `itemAlignItems`) still left-aligns.

---

## [1.51.0] - 2026-06-19

### Added

- **ComposableScreen `RadioGroup` / `CheckboxGroup` — per-item image.** Each item can carry an optional `image` (`{ url, width?, height?, aspectRatio?, resizeMode?, borderRadius? }`) rendered above the label/sub-label as a column (image → label → subLabel). SVG URLs render via `react-native-svg`; rasters via `expo-image` (when installed) or RN `Image`. Image rendering helpers were extracted into a shared `imageSource` module reused by `ImageElement` and both groups.
- **ComposableScreen `RadioGroup` / `CheckboxGroup` — `itemAlignItems` + `itemGap`.** `itemAlignItems` (`"flex-start" | "center" | "flex-end" | "stretch"`, default `"center"`) sets the cross-axis alignment of each item's contents — including letting the tick top-align with multi-line / image content. `itemGap` (default `12`) sets the spacing between an item's inner pieces (tick ↔ content, image ↔ text), replacing the previously hardcoded `12px`. When both are unset, existing layouts render unchanged.

---

## [1.50.1] - 2026-06-19

### Fixed

- **ComposableScreen `RadioGroup` / `CheckboxGroup` — tick not pinned to edge with `tickPosition: "end"`.** The item row had no `justifyContent`, so the label and tick clumped together on the left instead of the tick sitting at the right edge of the full-width card. Items now apply `justifyContent: "space-between"` when `tickPosition === "end"`, distributing the label to the left and the tick to the right edge. `tickPosition: "start"` (default) is unchanged.

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
