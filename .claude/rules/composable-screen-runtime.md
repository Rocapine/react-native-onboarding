---
paths:
  - "packages/onboarding-ui/src/UI/Pages/ComposableScreen/**"
  - "packages/onboarding-ui/src/UI/Runtime/**"
---

# ComposableScreen UIElement Runtime

## Container style (BaseBoxProps)

Every UIElement renderer that wraps content builds `containerStyle` from `BaseBoxProps`: `alignSelf`, `flex`, `flexShrink/Grow`, `width` (via `dim()`), `height` (via `dim()`), `min/maxWidth/Height`, `margin*`, `padding*`, `borderRadius/Width/Color`, `backgroundColor` (only when no `backgroundGradient`), `opacity`, `overflow`. Apply to outermost wrapper (`GradientBox` or `View`). Missing fields = user can't control that aspect from CMS payload.

## `parentType` flexShrink + `XScroll`

`parentType` controls the `flexShrink: 1` default applied to children of a row (`XStack`) in `StackElement`/`TextElement`/`RichTextElement` — and, when `renderElement` wraps the element (`onPress`/motion), on the **wrapper** instead, because that is the box the row lays out (`wrapperLayout.parentFacingLayout`; the element inside then carries the nested fill contract). Horizontal `ScrollView` passes `"XScroll"` instead (row layout, **no** flexShrink default) + drops `flexGrow:1` from its content container, so scroll children keep intrinsic width and overflow — else fixed-width cards shrink to the viewport and the row can't scroll.

The union `XStack|YStack|ZStack|RichText|XScroll` is declared **once**, as `ParentType` in `elements/shared.ts`, and every other site imports it — so adding a container type is a one-line change plus its dispatch case. Keep it that way; `grep -rn '"XStack" | "YStack"' packages/onboarding-ui/src` should return exactly one hit, and a second means someone re-copied it. (Earlier versions of this rule claimed 6 spots and the container rule below claimed 5; the real number was 7, which is what prompted collapsing them.)

## ImageElement: webp + svg

`ImageElement` renders `.svg` URLs (path-extension auto-detect, query/hash tolerant) via `react-native-svg` `SvgUri`, and rasters via `expo-image` (optional peer dep) when installed — falls back to RN `Image`. `resizeMode` maps to `contentFit` (expo-image) / `preserveAspectRatio` (svg). No schema change for either.

## Motion: animation / transform (BaseBoxProps)

`animation` (`entering`/`exiting`/`layout`/`effect`) + `transform` live on `BaseBoxProps`, so every element inherits them. A single `AnimatedBox` wrapper injected in `renderElement` (only when `animation`/`transform` present) applies them for all 15 types — **don't** convert individual element roots to `Animated.View`. It takes the element's parent-facing layout as one `outerLayout` prop built by `wrapperLayout.parentFacingLayout`, and its inner (static-transform) view fills with `flexGrow`, never `flex` — see "A wrapper box takes the parent-facing layout" below before touching either.

`buildAnimation.ts` resolves reanimated builders **by name** (`Reanimated[preset]`) — the schema `preset` string IS the exact reanimated builder name; unknown preset → no-op (forward-compat). Shared `EASING_MAP` lives here (imported by `ProgressIndicatorElement`) — don't re-declare it.

## `useAnimatedReaction` needs an explicit deps array

Reanimated 4 rebuilds the mapper on **every render** when `useAnimatedReaction` is called with no 3rd-arg deps. An element that re-renders continuously (e.g. `ProgressIndicator` with `showLabel`+`loop` firing `setPercentage` per frame) then start/stops its mapper ~40×/s forever — churn on the UI-thread mapper scheduler that destabilizes *other* running animations on the screen (they visibly reset mid/after a sweep). Always pass an explicit deps array of the JS values the reaction branches on. Recreating also resets the `prev` arg to `undefined`, defeating any `rounded === prev` over-fire guard.

A worklet (the `useAnimatedReaction` reader/result fn, `useAnimatedProps`, `useAnimatedStyle`) **can't call a JS closure** — e.g. a `snap(v)` helper or `clamp`. Inline the math inside the worklet and capture only **primitives** (`minValue`/`step`/etc.), then list those primitives in the deps array so the worklet re-keys when they change. Precedent: `ProgressIndicatorElement.tsx` inlines its step-snap + clamp inside the reaction worklet rather than calling the component's `snap()`.

## Animated number/text without re-renders (ReText)

Animate a displayed number/text on the UI thread with **zero React re-renders**: render `Animated.createAnimatedComponent(TextInput)` and drive its native `text` via `useAnimatedProps` (RN `<Text>` can't — content is a child, not an animatable prop). The worklet **must return `defaultValue` alongside `text`** — once the value stops changing the worklet goes quiet, and a parent re-render reverts the uncontrolled TextInput to a stale mount-time `defaultValue` (number reaches max → snaps to `from`). Neutralize TextInput chrome: `editable={false}`, `pointerEvents="none"`, `caretHidden`, `underlineColorAndroid="transparent"`, `padding:0`, `includeFontPadding:false`. Format inside the worklet (no `toLocaleString`; inline grouping, capture only primitives). Precedent: `AnimatedTextElement.tsx`, `ProgressIndicatorElement.tsx` `showLabel`. `AnimatedText` = pure display (no var write); a `ProgressIndicator` bound to `variableName` still writes per step on purpose. **Don't render an animated number through React state** (`useState` + `runOnJS(setX)` per step) — that re-render is what churns the mapper scheduler (see the section above).

## TextSpan is not a UIElement

Rich-text `TextSpan` (Text element's `content[]`) renders as inline nested `<Text>` (`RichTextSpan`), bypassing `renderElement` — so **no `animation`/`transform`/`effect` on spans** (and RN ignores `transform` on inline nested Text regardless). Animated/rotating text = a standalone `Text` element. Spans take only inline text-style props (font*, color, backgroundColor, opacity, textTransform, textDecoration*, letterSpacing, lineHeight).

The **element-level** alternative is the `RichText` container (`RichTextElement.tsx`): a **wrapping flex row `<View>`** (`flexDirection:"row"`, `flexWrap` default `"wrap"`) whose `children` (Text-only) render via `renderElement`. Because each child `Text` is a real flex child of a `<View>` — **not** a nested `<Text>` — it honors its own box props (`padding`, `borderRadius`, `borderWidth`, `backgroundColor`, `margin`, `transform`), so words + padded/rounded/rotated chips wrap and align together (mirrors the Tamagui `XStack flexWrap="wrap"` of `<Text>`/chip pattern in host apps). Children keep `renderWhen` / `expression`, and — unlike inline spans — **may** use `animation`/`transform` (the `AnimatedBox` `View` wrapper is valid inside the row). Children are Text-only at the schema level (`children: z.array(TextUIElementSchema)`). This is distinct from inline `TextSpan` (one wrapping paragraph, text-style only).

**Inherited text style:** a `<View>` doesn't propagate text style to nested `<Text>`, so RichText's text-style props (`fontSize`/`color`/`textAlign`/etc.) are published via `RichTextStyleContext` (in `shared.ts`); `TextElementComponent` reads it with `useContext` and merges each field as `p.X ?? inherited.X` (child wins). Empty default `{}` → Text outside a RichText is unchanged. So container typography is declared once and children inherit — don't expect View-level text style to cascade on its own.

**`textAlign` also sets row alignment:** since each word becomes its own shrink-wrapped flex item, `textAlign` is a no-op on the row itself — so RichText maps `textAlign` onto the row's `justifyContent` when `justifyContent` is unset (`left→flex-start`, `center→center`, `right→flex-end`).

**Word-splitting (why a multi-word child wraps):** a flex row wraps between *items*, not inside them — so a single multi-word `Text` child would drop to its own line as one block (chip stranded above). RichText fixes this by expanding each **flowing-text** child (`isFlowingText`: plain string content, no box styling / motion) into one inline `<Text>` per `split(/(\s+)/)` token (words **and** spaces preserved), so text wraps word-by-word like `parseTitleWithChips` in host apps. **Chips** (children with `backgroundColor`/`borderRadius`/`border`/`padding`/`margin`/explicit size/`animation`/`transform`) stay atomic — anything that would be wrongly applied per-word forces atomic. Consequences: don't set `gap` when relying on split spacing (it double-spaces — spaces are real items); give chips `marginHorizontal` for breathing room; `renderWhen` is evaluated once per source child before splitting (words then render unconditionally), and `expression` is interpolated before the split.

## Sizing libs needing numeric pixels

`react-native-reanimated-carousel`, `react-native-video`, Lottie/Rive don't accept `"50%"` strings. Pattern:

1. Pass `containerStyle` (with `dim()`) to outermost wrapper
2. Wrap library in inner `View` with `flex: 1` + `onLayout`
3. Render library only after first measurement (`size.width > 0 && size.height > 0`)
4. Pass measured numeric `size.width/height` to library

## Keyboard avoidance is page-level

The ComposableScreen page Renderer wraps its outer `ScrollView` in a `KeyboardAvoidingView` (`flex:1`, iOS `padding`/Android `height`) — that's what makes inputs avoid the keyboard. A `KeyboardAvoidingView` *element* placed inside the payload sits inside that page ScrollView and is **inert** (can't measure its frame). Don't expect the element alone to avoid the keyboard.

## Unknown element types are omitted, not fatal (#209)

`Pages/ComposableScreen/Renderer.tsx` runs `resolveRenderableStep(step, getRenderableElementTypes())` — the headless decision, this package's capability — in front of its `.parse`, so an element type published after the app shipped, missing from the `z.discriminatedUnion("type", …)`, is dropped **with its subtree** and the rest of the screen renders; a `console.warn` names it.

Two rules that are easy to get wrong:

- **The strip is keyed to THIS package's union, never the headless one.** `getRenderableElementTypes()` (`Runtime/renderableElementTypes.ts`) derives from `Runtime/types.ts`'s `UIElementSchema` — the mirror that actually parses the payload and backs `renderElement`'s dispatch. The headless package is a **peer dep by range**, so an installed app can resolve an older headless against a newer UI: keyed the wrong way, an element this build can draw gets stripped (with a warning that lies about why), or one it cannot draw survives and throws the whole screen anyway. `Runtime/__tests__/unknownElementTypes.test.ts` still asserts the headless schema, the UI mirror and `renderElement`'s dispatch are the same set — that is a **release-time** invariant (`check-versions.mjs`), not something the strip depends on, and reading both files off disk cannot see an installed-version skew.
- **A strip must never leave a screen nobody can leave.** A ComposableScreen's CTA is authored *inside* the element tree, so stripping the element that happened to be the root container leaves `elements: []` — which parses cleanly, turning a loud throw into a silent blank screen (and on `displayProgressHeader: false`, no back chevron either). `resolveRenderableStep` returns `needsEscape` when nothing that survived can complete the step (`hasCompletingAction` — a reachable `"continue"` or `{type:"dismiss"}`), and the renderer then passes `OnboardingTemplate`'s own `button` and logs a `console.error`. Only ever after a strip: an authored screen with no CTA is the author's business, not the SDK's.

That test file also pins the list of element-tree parse boundaries: a new one fails it until you decide its degradation contract.

**Don't loosen the schema to achieve this.** A plain `z.union` or a catch-all branch would swallow genuine data errors on known types and reintroduce the three crashes the discriminator fixed (`screens/types.ts` comment + `elementUnionDiscriminator.test.ts`). Strip in front, parse strictly. Paywall boundaries deliberately do NOT strip: refusing to open beats a full-screen Modal missing its purchase or dismiss control.

## Overflow gotcha

Default `overflow: hidden`. Carousel `left-align` carouselType needs `visible` for peek effect. Same for shadows/badges spilling outside bounds. Don't blanket-set `hidden` in refactors.

## Gradient peer dep

`GradientBox` silently falls back to plain `View` if `expo-linear-gradient` not installed. If `backgroundGradient` appears unrendered, check peer dep first.

## Gradient render path must size like the non-gradient path

A `backgroundGradient` forks the renderer into a gradient branch that nests content inside `<GradientBox>` — the outer wrapper carries the box layout (`flex`/`height`/etc.) and an **inner** view fills it. The trap: the inner view used a hardcoded `flex: 1`, but the non-gradient path is content-sized. When the box has no explicit `height`/`flex`, the outer wrapper is content-sized too, so the inner `flex: 1` instead grabs the **parent's** full main-axis — inside a `ZStack`/flex container the element balloons to fill the whole screen (v1.44.7 bug: gradient `Button`/`SafeAreaView`/`KeyboardAvoidingView`/`ScrollView`). Gate any inner fill on an explicit size: `const fillsParent = p.height != null || p.flex != null || p.flexGrow != null;` — then spread **`fillLayout(fillsParent)`** (from `wrapperLayout.ts`), never a literal `flex: fillsParent ? 1 : …`. `flex` implies `flexBasis: 0`, so a nested `flex: 1` measures 0 as soon as the outer box's own main size is auto, which is #231 one level down; `fillLayout` emits `flexGrow: 1` + `flexShrink: 1` instead (fill AND stay clamped). Wired that way in `ScrollViewElement`, `SafeAreaViewElement`, `KeyboardAvoidingViewElement`, `ButtonElement` (both gradient views) and `CarouselElement`'s measuring box; `Runtime/__tests__/wrapperLayout.test.ts` fails a renderer that reintroduces the literal. Two inner `flex: 1`s are deliberately left: `DrawingPadElement`'s `styles.fill` (its container's height is `props.height ?? 200`, always definite) and `ProgressIndicatorElement`'s track (a horizontal fill in a definite-width row, with its own explicit height) — neither can meet an auto-sized outer.

Rule: **the gradient and non-gradient branches must produce identical layout** for the same props — diff them whenever you touch a renderer's gradient fork (`flex`, padding, `alignSelf`, width/height defaults should not differ). A wrapped element makes this sharper, not softer: the demotion hands the renderer `flexGrow` where the author wrote `flex`, so a gradient branch still emitting `flex: 1` diverges from its own non-gradient branch.

## A wrapper box takes the parent-facing layout; the element inside fills it

`renderElement` can emit up to **four** boxes for one authored element: `AnimatedBox`'s outer view, `AnimatedBox`'s inner (static-transform) view, the generic-`onPress` `Pressable`, and the element's own root. Each of them used to copy the element's `flex`, so one authored `flex: 1` became two or three nested ones. In RN `flex: N` expands to `{ flexGrow: N, flexShrink: 1, flexBasis: 0 }`, so a nested copy contributes **zero** main size: a wrapper whose own main size is auto (a card in an `XStack` with `alignItems: "flex-start"`, or anything under a content-sized ancestor) measured **0**, its content painted over whatever followed it, and all the press targets in a row collapsed onto each other (#231, P1 — `flex` + any of `onPress`/`animation`/`transform`, whatever the element contains). Nothing warned: both props are legal.

It does **not** reproduce on react-native-web, and the reason is **intrinsic sizing**, not the automatic minimum size CSS would otherwise supply — RNW's own View reset sets `min-width: 0; min-height: 0`, so that safety net is already switched off there. What differs is how the two engines size a flex container whose main size is `auto`: CSS resolves it from its items' **max-content contributions**, which account for the item's content and not just its flex basis, while Yoga resolves it from the items' **flex base sizes** — and a `flex: N` item's base size is 0. So the web preview an author checks before publishing is exactly the surface that hides it. (An earlier version of this rule blamed `min-height: auto`; that is wrong and would send the next reader looking in the wrong place.)

One owner — `Runtime/elements/wrapperLayout.ts`:

- `parentFacingLayout(p, parentType)` — `flex`/`flexGrow`/`flexShrink`/`alignSelf` (including the `XStack` `flexShrink: 1` default) for the **outermost** box only. That box is the one the parent lays out.
- `nestedFillLayout(p)` / `fillLayout(fills)` — the **fill contract** for every box below it: `flexGrow: 1` to fill an outer box that got a definite main size (only if the element asked for flex sizing at all), plus `flexShrink: 1` so the nested triple matches what `flex: N` means (grow, shrink 1, basis) — that correspondence is *why* the pair behaves like the single authored box. **Never `flex` on a nested box.**

  On that `flexShrink`, so nobody re-derives it: `flexBasis: 0` was clamping as well as collapsing, but the clamp is supplied anyway by the wrapper's definite main size — Yoga resolves a nested `basis: auto` AT_MOST the available space, so the box's hypothetical main size never exceeds the wrapper and there is no negative free space for a shrink to act on. Measured on device with and without it over the guards screen's accessibility tree: **all 24 frames identical**, including a `justifyContent: "center"` box in a 90pt frame (90.0 both ways) and a wrapped `ScrollView` in a 130pt frame (130.0 both ways). Kept for semantic parity; **not** known to change a pixel. If you need to check a claim about box heights here, read the accessibility frames (`idb ui describe-all`) — a clipped box and an overflowing one are indistinguishable in a screenshot, which is how a first attempt at this guard came to assert something it could not observe.
- The nested box's flex props are the contract, **not the author's props**. The authored values are applied exactly once, on the box the parent lays out. That includes per-state overrides: `pressedStyle`/`disabledStyle` are `BaseBoxPropsSchema.extend({…}).partial()` and are spread over the element's props at render time, so `withNestedLayout` demotes them too — otherwise an authored `pressedStyle.flex` restores `flexBasis: 0` for as long as the finger is down.
- `withNestedLayout(element)` — the element as it must render *inside* a wrapper (parent-facing props gone, fill in their place), cached on the element so `React.memo` still skips. All ~25 element renderers keep reading `props.flex` unchanged and none of them has to know it was wrapped.

Adding a wrapper (or a new element renderer that nests a box): take the style from these helpers, never by copying `p.flex` at the call site — three call sites each deciding for themselves is what shipped the bug, and `Runtime/__tests__/wrapperLayout.test.ts` fails a wrapper that builds its own.

**The demotion cannot reach a renderer that computes its own inner `flex`.** The renderers' `fillsParent` predicate stays true through it *by design* (the demotion substitutes `flexGrow` for `flex`, so an explicitly-sized box stays explicitly sized), which means a renderer emitting `flex: fillsParent ? 1 : …` re-emits the zero basis on a nested box and the collapse returns for exactly the elements this fixes. That is why the gradient forks now spread `fillLayout(fillsParent)` — see the rule above. Note `wantsFlexSizing` (the demotion's own predicate) is **not** `fillsParent`: it omits `height`, because an explicitly-sized box needs no fill.

For an author stuck on an older SDK, the workaround is `flexGrow: 1` instead of `flex: 1`.

## Font hook rule (Text-rendering elements)

```ts
const f = useResolvedFontStyle(props.fontFamily, props.fontWeight);
// style: { fontFamily: f.fontFamily, fontWeight: f.resolvedToVariant ? undefined : (props.fontWeight as any) ?? <theme default> }
```

`f.resolvedToVariant === true` → registry matched concrete weighted variant (e.g. `Inter-700`); **suppress `fontWeight`** or iOS/Android applies synthetic emboldening on top of already-weighted font file.

Use legacy `useResolvedFontFamily` only for elements that never set `fontWeight`. It takes **2 args** — `useResolvedFontFamily(family, weight)`; pass `undefined` weight (TS2554 otherwise).

**Applies to every text spot, including item-label maps + native control `itemStyle`.** Radio/Checkbox item labels, WheelPicker `itemStyle`, DatePicker trigger — resolve `resolveInheritedFontFamily(props.fontFamily, theme.typography.defaultFontFamily)` first, never pass `props.fontFamily` raw (omitted → system font, ignoring theme; this was the v1.36.2 bug). Group-level item font = call the hook **once at component top**, not inside the per-item `.map` (rules-of-hooks).

## RenderContext variables → primitive flattening

`RenderContext` carries `getVariables()` — a **ref-backed, referentially stable**
live read of the merged variable map, for press-time action evaluation
(`runActions`). It is NOT reactive: reading it during render will not re-render on
a write.

Reactive reads go through `useVariables()` (`Runtime/elements/VariablesContext.tsx`),
which yields `{ variables, flatVariables }`. `flatVariables` is the entry map
flattened to primitives — that is what `evaluateCondition` / `renderWhen` want.
Skip the flatten and every `eq`/`neq` compares against the `{value,label}` entry
object and silently mis-evaluates.

The split is the whole point of the memoization architecture: `ctx` is stable so
memoized `ElementHost`s skip re-render on a write, while the volatile variable maps
re-render only their actual consumers through context. Adding a volatile field back
onto `RenderContext` reintroduces the full-tree re-render storm, and no type error
will catch it.

The merge and flatten helpers are pure and unit-tested in
`Runtime/variables.ts` (`mergeVariables`, `flattenVariables`).

## ScreenHost: the onboarding ⇄ paywall seam

The rendering engine lives in `packages/onboarding-ui/src/UI/Runtime/` and knows
nothing about onboarding. `ScreenRenderer({ elements, host })` renders a UIElement
tree against an injected `ScreenHost` (`Runtime/ScreenHost.ts`): variable store,
`setVariable`, `complete`, `customActions`, `keyboardVerticalOffset`.

`Pages/ComposableScreen/Renderer.tsx` is the onboarding adapter — it builds a host
from the onboarding contexts and adds `OnboardingTemplate`. A paywall renderer is
the sibling adapter. **Put new engine behaviour in `Runtime/`, not in the adapter**,
or paywalls silently miss it.

Naming: the host exposes `complete` ("finish this screen"); `RenderContext` keeps
`onContinue` ("the continue action fired"). `ScreenRenderer` maps one to the other
in exactly one place. A paywall host interprets `complete` as dismiss.

## Paywalls: PaywallProvider, PaywallHost, present()

`UI/Paywall/PaywallHost.tsx` is the second `ScreenHost` implementation — sibling
to `Pages/ComposableScreen/Renderer.tsx`, sharing the same `ScreenRenderer`
engine (previous section). It reads `usePaywallHost()` from the headless
`PaywallProvider` (`packages/onboarding/src/paywalls/`) and renders whichever
paywall is active in a fullScreen RN `Modal`.

**Provider arrangement — `PaywallProvider` goes ABOVE `OnboardingProvider`, not
beside it, and not inside it:**

```tsx
<PaywallProvider client={client} productProvider={revenueCatProductProvider(Purchases)}>
  <App /> {/* OnboardingProvider mounts somewhere inside here, e.g. in a screen's own layout */}
  <PaywallHost />
</PaywallProvider>
```

The spec's "sibling, not nested inside it" requirement means *not inside
`OnboardingProvider`* — an app-level ancestor satisfies that (context flows
downward to every descendant, including wherever `OnboardingProvider` mounts)
while also working from a screen with no onboarding mounted at all (e.g.
Settings → "Upgrade"). It is also the only arrangement giving **one** shared
product runtime: `useProducts` has no cross-mount sharing mechanism of its own
— it resolves and stores whatever refs its own call site is given. Two true
siblings (`<PaywallProvider>...</PaywallProvider><OnboardingProvider>...
</OnboardingProvider>`, both under some higher common ancestor) would each call
`useProducts` independently and end up with two separate `getProducts()`
round-trips and two independent `purchasing` flags — a purchase started from
one wouldn't be visible to the other. `PaywallProvider` mounted above
`OnboardingProvider` instead publishes one `ProductRuntimeContext` that an
`OnboardingProvider` anywhere inside it picks up rather than creating its own
(`products/ProductRuntimeContext.tsx` — `useProductRuntime()` returns the
ancestor's runtime, or `null` with no ancestor at all).

**`present(placement)` performs no network call.** The whole catalog (every
placement) is fetched once, at `PaywallProvider` mount
(`OnboardingStudioClient.getPaywalls()`, no `placement` filter by default —
see its doc comment), and every placement's `products[]` are collected into
one deduplicated union resolved once via `useProducts`
(`present.ts`'s `collectProductRefs`). `present()` itself only makes a
synchronous decision (`resolvePresentDecision`) and shows the Modal — a store
round-trip at present-time is exactly the "must render instantly on tap"
conversion bug spec §6.1 exists to prevent. A stale/failed catalog fetch
degrades to `present()` resolving `{status:"error"}` for every placement
(`isReady: false`), never a thrown error and never a blocking fetch.

**Two ButtonActions exist only because of paywalls** (`elements/actions.ts` /
headless `common.types.ts`):

- `dismiss` — `{ type: "dismiss" }`. Terminal, like `"continue"`. Resolves the
  current screen with `{status:"dismissed"}`. In a paywall this resolves the
  pending `present()` call; `PaywallProvider.complete()` may still upgrade a
  bare `"dismissed"` to `"purchased"`/`"cancelled"` if a purchase actually
  happened during this presentation (`resolvePresentedOutcome` in
  `present.ts`) — `dismiss` itself doesn't know or care about purchase state,
  which is why the canonical "buy" authoring shape is `{type:"purchase",
  onSuccess:[{type:"dismiss"}]}` rather than a special "close as purchased"
  action.
- `presentPaywall` — `{ type: "presentPaywall", placement: string }`. NOT
  terminal (`runActions.ts` continues the loop after firing it). Works from
  **either** host: `Pages/ComposableScreen/Renderer.tsx` and `PaywallHost.tsx`
  both wire `ScreenHost.presentPaywall` from the same `usePaywall().present`,
  so an onboarding step can open a paywall mid-flow, and a paywall's own
  content can open a *different* paywall (spec §4.5). Warns via
  `console.warn` and no-ops when the host has no `presentPaywall` (e.g. no
  `PaywallProvider` mounted anywhere above) — `usePaywall()` degrades to inert
  defaults with no ancestor provider, so this is a silent no-op, never a
  crash. Firing it while presenting the SAME paywall (a paywall re-opening
  itself, or opening a second one) resolves `{status:"error"}` immediately
  (`resolvePresentDecision` — one active paywall at a time) rather than
  stacking a second Modal.

**The Modal itself** (first `Modal` in the codebase, so every property below
is a decision, not copied precedent — see `PaywallHost.tsx`'s own doc comment
for the full reasoning): `presentationStyle="fullScreen"` + `transparent={false}`
(full interstitial, not a popover); `onRequestClose` wired to the exact same
`complete({status:"dismissed"})` as the in-content `dismiss` action, REQUIRED
on Android or hardware back throws inside the Modal and would otherwise trap
the user with no way out; a nested `SafeAreaProvider` rendered INSIDE the
Modal, because a `Modal` presents into a separate native view hierarchy that
the app's own root `SafeAreaProvider` doesn't reach — omit it and every
authored `SafeAreaView` inside a paywall measures zero insets.

## Multi-select variables are JSON-encoded strings

`CheckboxGroup` stores its value as `JSON.stringify(string[])` to fit the string-based variable system — an empty selection is the literal `"[]"`, not `""`. `evaluateCondition` decodes any value that parses to an array before testing, so `is_empty` / `is_not_empty` / `contains` / `in` see the real collection. Anything else reading these vars (new operators, `{{interpolation}}`) must decode too — a raw `"[]"` is a non-empty 2-char string and reads as "not empty".

## `renderWhen` gating

Every UIElement variant accepts optional `renderWhen?: LeafCondition | ConditionGroup`. Single gating point at top of `elements/renderElement.tsx`: read `flatVariables` via `useVariables()`, call `evaluateCondition`, return `null` if false. Covers all 15 variants — container subtrees skip naturally because the bail-out runs before `renderChildren`.

**Membership gates (`in` / `not_in`, and `contains` against an array variable).** The right-hand side is normalized to a member list before comparing (`evaluateCondition.ts` `toMemberList`, issue #225), because three shapes all mean the same list: an authored array, a `{{ref}}` to a multi-select variable (whose flat value is the JSON string `CheckboxGroupElement` writes), and that ref wrapped in a one-member array — the shape Studio's condition editor emits, since it splits its value field on commas. Members compare stringified (`includesMember`, shared with `contains`) because `buildRowFlat` keeps a `Repeat` row field's authored type, so a numeric row id must match a string member. An empty list and an unresolved ref have no members (`in` false, `not_in` true, no warning) — in **either** shape, because an unresolved ref interpolates to the empty string and `isAbsentMember` drops an empty-string member instead of keeping it, so a bare and an array-wrapped ref cannot disagree on an empty-string variable (`InputElement` writes `""` on clear); a scalar right-hand side is a one-member list and warns. The UI-thread fast path never sees any of this — `animatedGate.ts` `NUMERIC_OPERATORS` excludes `in`/`not_in`, which is what keeps the seeded and animated visibility from disagreeing.

## Element-default overlay (`ScreenRenderer.tsx`)

`ScreenRenderer.tsx` (`Runtime/`) builds `effectiveVariables = mergeVariables(collectElementDefaults(elements), host.variables)` (`mergeVariables` from `Runtime/variables.ts`) so `renderWhen` + `{{var}}` interpolation see element-declared defaults (`Carousel.defaultIndex`, `RadioGroup.defaultValue`, etc.) on first render. The host store always wins over defaults — never invert the merge. Per-element seeding effects still own persistence (full label entries).

## Adding a new defaulted element

When introducing a new element type with a `defaultValue` / `defaultIndex`:

1. Add a case in `elements/collectDefaults.ts` returning `{value, label?}`.
2. If the element clamps/coerces the raw default at runtime (like `CarouselElementComponent.clampIndex`), mirror the same logic in `collectDefaults.ts` — otherwise the overlaid value disagrees with the rendered index.

## Adding a container element (with `children`)

Beyond the schema-mirror checklist in the root CLAUDE.md, a container needs its type added to `ParentType` in `shared.ts` — one place, since every other site imports it — plus a dispatch case in `renderElement.tsx` and `ctx.renderChildren(children, "<Type>")` in the renderer. If tsc cascades with a `renderChildren` mismatch, someone has re-introduced a local copy of the union. Children render via `ctx.renderChildren(children, "<Type>")`.

**Restricting children to one element type** (e.g. `RichText` → Text-only): extract that variant's `z.object` into a named const (`TextUIElementSchema`) in **both** `types.ts` files, reference it in the union slot **and** `children: z.array(...)`; TS type is `children: Array<Extract<UIElement, { type: "X" }>>`. A non-matching child then fails parse with `invalid_union`.

**Text-style inheritance from a `<View>` container** doesn't cascade in RN — publish the container's text props via a React context (`RichTextStyleContext` in `shared.ts`) and merge in `TextElementComponent` as `p.X ?? inherited.X` (child wins).

## iOS shadow needs no overflow clip

A view with `overflow: hidden` (default for `Image`, gradient wrappers, many container styles) clips its own shadow on iOS, so the shadow renders invisible. For elements that want a shadow, build a wrapper View that carries `shadow*` + layout (no overflow clip) and let the inner content carry `borderRadius` + `overflow: hidden` for corner clipping. See `ImageElement.tsx` / `ButtonElement.tsx`. Also: when only `shadowColor` is set, default `shadowOpacity:1`, `shadowRadius:4` — iOS defaults opacity to 0 so a lone `shadowColor` does nothing.

`shadow*` is a `BaseBoxProps` field, but — unlike `animation`/`transform` (wired once in `renderElement`) — it is **not** applied centrally. Each container renderer that builds its own `containerStyle` must `...buildShadowStyle(p)` (from `shared.ts`) explicitly, or shadow props parse fine and silently render nothing. Wired in: `ButtonElement`, `ImageElement`, `StackElement` (XStack/YStack), `ZStackElement`. **Still missing** (add when shadow is needed there): `ScrollViewElement`, `RichTextElement`, `TextElement`, `KeyboardAvoidingViewElement`. When adding a new container/box renderer, spread `buildShadowStyle(p)` alongside the other box props.

## RN treats `padding` and `padding{Horizontal,Vertical}` independently

`style={{ padding: eff.padding, paddingHorizontal: eff.paddingHorizontal ?? 24 }}` will still apply 24 when payload sets `padding: 0`, because the axis prop's `??` fallback ignores the shorthand. Gate axis defaults on `eff.padding != null ? undefined : <default>` so explicit `padding:0` actually wins. Same gotcha for `margin`.

## Don't wrap ComposableScreen payload in a page-level ScrollView

Page Renderer is intentionally a plain `View flex:1` inside `KeyboardAvoidingView` — `contentContainerStyle: { flexGrow: 1 }` leaves inner `flex:1` children unbounded vertically, so a `Carousel`/`flex:1` payload grows with its intrinsic content and pushes siblings off-screen. Payloads needing scroll must use the `ScrollView` UIElement.

## Rive intrinsic = artboard pixel size

`rive-react-native` doesn't expose the artboard ratio to JS, so a Rive view with no `height` / `flex` / `aspectRatio` reports the raw artboard pixels as its intrinsic — fills the screen. `RiveElement` falls back to `aspectRatio: 1` when unsized; authors with a known ratio override via `aspectRatio`.

## UI press-action dispatch (`runActions`)

`elements/runActions.ts` runs a `ButtonAction[]` (continue / setVariable / custom / purchase / restore / dismiss / presentPaywall) — shared by `Button.actions` and the generic `onPress`. It lives in its **own** module, NOT `shared.ts`: `shared.ts` ↔ `expression.ts` already form a cycle (`expression` imports `interpolate` from `shared`) and `runActions` needs both. `ButtonAction` types/schemas are the leaf `elements/actions.ts` (UI mirror of headless `common.types.ts`) so `BaseBoxProps.ts` + `runActions.ts` import them cycle-free. `setVariable` `arrayOp` (`append`/`remove`/`toggle`) operates on the JSON-`string[]` CheckboxGroup encoding — value = `JSON.stringify(values)`, label = comma-joined members.

`dismiss` and `presentPaywall` (paywall phase 5) are both terminal-ish but behave differently: `dismiss` is terminal like `"continue"` (calls `onContinue({status:"dismissed"})` and stops the loop); `presentPaywall` is NOT terminal (it fires `ctx.presentPaywall(placement)` and the loop continues to the next action). Neither throws when unsupported — `presentPaywall` warns and no-ops when `ctx.presentPaywall` is absent (a host that doesn't wire the field, e.g. an app with no `PaywallProvider` mounted). See the "Paywalls" section below for what supplies `presentPaywall` and why it works from both an onboarding step and a paywall's own content.

## Product variables

Resolved store products are projected into the variable bag as FLAT DOTTED KEYS
(`product.<slot>.price`, `product.<slot>.pricePerWeek`, `product.<slot>.savingsPct`,
plus `products.loaded` / `products.purchasing` / `products.error`). `interpolate()`
and `evaluateCondition` both do a flat `variables[key]` lookup, so this needs no
engine change — `{{product.yearly.price}}` and
`renderWhen: { "variable": "products.loaded", "operator": "eq", "value": "true" }`
just work. (Corrected — this previously wrote the shorthand
`{ "products.loaded": { eq: "true" } }`, which does not parse: a leaf
`renderWhen` is always `{ variable, operator, value? }`, never a map keyed by
variable name. See the spec's §4.4/§4.6 correction, same bug.)

Products OVERLAY the merged bag and win over author variables
(`withProductVariables` in `Runtime/variables.ts`): they are facts read from the
store, and a displayed price must match what StoreKit charges.

**Never render a price the CMS supplied.** Prices come only from a
`ProductProvider`. When resolution fails, `products.loaded` is `"false"` — gate
the CTA on it.

`ProductRuntime` sits in `RenderContext`, so it must be referentially stable
across variable writes; `useProducts` memoizes it on its contents. An unstable
one re-renders every memoized element on every write, and nothing type-checks it.

**Two `{{var}}` resolvers exist, with opposite precedence, for two different
purposes** (`elements/shared.ts`): `interpolate()` resolves `label ?? value` —
right for DISPLAY text, since a label is what a human should see.
`interpolateIdentifier()` resolves `value ?? label` — right for resolving an
IDENTIFIER a `{{var}}` reference names, since a `RadioGroup`/`CheckboxGroup`
item's `value` is the machine key (a product slot is constrained by the
studio to `^[a-z][a-z0-9_]{0,63}$`) while its `label` ("Yearly") is display
copy that will essentially never match that shape. `purchase`'s `product`
field (`runActions.ts`) resolves through `interpolateIdentifier` for exactly
this reason: a `RadioGroup` item authored `{value: "yearly", label:
"Yearly"}` (the normal pattern — nicer display text, distinct machine value)
must let `{ type: "purchase", product: "{{plan}}" }` find the `"yearly"`
product regardless of what the label says. This was a real bug until it was
fixed here — `purchase` used to call `interpolate()` (the label-preferring
one) and silently failed to resolve a product whenever the label differed
from the value. `renderWhen` / `nextStep` branch conditions are unaffected by
either resolver: they read `flatVariables` (`variables.ts`'s
`flattenVariables`), which is `value`-only and never touches `label`. Reach
for `interpolateIdentifier`, not `interpolate`, for any future `{{var}}`
resolution that looks a value up rather than showing it.
