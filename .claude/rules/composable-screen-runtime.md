---
paths:
  - "packages/onboarding-ui/src/UI/Pages/ComposableScreen/**"
  - "packages/onboarding-ui/src/UI/Runtime/**"
---

# ComposableScreen UIElement Runtime

## Container style (BaseBoxProps)

Every UIElement renderer that wraps content builds `containerStyle` from `BaseBoxProps`: `alignSelf`, `flex`, `flexShrink/Grow`, `width` (via `dim()`), `height` (via `dim()`), `min/maxWidth/Height`, `margin*`, `padding*`, `borderRadius/Width/Color`, `backgroundColor` (only when no `backgroundGradient`), `opacity`, `overflow`. Apply to outermost wrapper (`GradientBox` or `View`). Missing fields = user can't control that aspect from CMS payload.

## `parentType` flexShrink + `XScroll`

`parentType` controls the `flexShrink: 1` default applied to children of a row (`XStack`) in `StackElement`/`TextElement`/`RichTextElement`. Horizontal `ScrollView` passes `"XScroll"` instead (row layout, **no** flexShrink default) + drops `flexGrow:1` from its content container, so scroll children keep intrinsic width and overflow — else fixed-width cards shrink to the viewport and the row can't scroll. parentType union is now `XStack|YStack|ZStack|RichText|XScroll` (6 spots — see container rule below).

## ImageElement: webp + svg

`ImageElement` renders `.svg` URLs (path-extension auto-detect, query/hash tolerant) via `react-native-svg` `SvgUri`, and rasters via `expo-image` (optional peer dep) when installed — falls back to RN `Image`. `resizeMode` maps to `contentFit` (expo-image) / `preserveAspectRatio` (svg). No schema change for either.

## Motion: animation / transform (BaseBoxProps)

`animation` (`entering`/`exiting`/`layout`/`effect`) + `transform` live on `BaseBoxProps`, so every element inherits them. A single `AnimatedBox` wrapper injected in `renderElement` (only when `animation`/`transform` present) applies them for all 15 types — **don't** convert individual element roots to `Animated.View`. It forwards `flex`/`alignSelf` so the wrapper stays layout-transparent.

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

## Overflow gotcha

Default `overflow: hidden`. Carousel `left-align` carouselType needs `visible` for peek effect. Same for shadows/badges spilling outside bounds. Don't blanket-set `hidden` in refactors.

## Gradient peer dep

`GradientBox` silently falls back to plain `View` if `expo-linear-gradient` not installed. If `backgroundGradient` appears unrendered, check peer dep first.

## Gradient render path must size like the non-gradient path

A `backgroundGradient` forks the renderer into a gradient branch that nests content inside `<GradientBox>` — the outer wrapper carries the box layout (`flex`/`height`/etc.) and an **inner** view fills it. The trap: the inner view used a hardcoded `flex: 1`, but the non-gradient path is content-sized. When the box has no explicit `height`/`flex`, the outer wrapper is content-sized too, so the inner `flex: 1` instead grabs the **parent's** full main-axis — inside a `ZStack`/flex container the element balloons to fill the whole screen (v1.44.7 bug: gradient `Button`/`SafeAreaView`/`KeyboardAvoidingView`/`ScrollView`). Gate any inner fill on an explicit size: `const fillsParent = p.height != null || p.flex != null || p.flexGrow != null;` then `flex: fillsParent ? 1 : p.flex` (or `: undefined`). Rule: **the gradient and non-gradient branches must produce identical layout** for the same props — diff them whenever you touch a renderer's gradient fork (`flex`, padding, `alignSelf`, width/height defaults should not differ).

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

## Multi-select variables are JSON-encoded strings

`CheckboxGroup` stores its value as `JSON.stringify(string[])` to fit the string-based variable system — an empty selection is the literal `"[]"`, not `""`. `evaluateCondition` decodes any value that parses to an array before testing, so `is_empty` / `is_not_empty` / `contains` / `in` see the real collection. Anything else reading these vars (new operators, `{{interpolation}}`) must decode too — a raw `"[]"` is a non-empty 2-char string and reads as "not empty".

## `renderWhen` gating

Every UIElement variant accepts optional `renderWhen?: LeafCondition | ConditionGroup`. Single gating point at top of `elements/renderElement.tsx`: read `flatVariables` via `useVariables()`, call `evaluateCondition`, return `null` if false. Covers all 15 variants — container subtrees skip naturally because the bail-out runs before `renderChildren`.

## Element-default overlay (`ScreenRenderer.tsx`)

`ScreenRenderer.tsx` (`Runtime/`) builds `effectiveVariables = mergeVariables(collectElementDefaults(elements), host.variables)` (`mergeVariables` from `Runtime/variables.ts`) so `renderWhen` + `{{var}}` interpolation see element-declared defaults (`Carousel.defaultIndex`, `RadioGroup.defaultValue`, etc.) on first render. The host store always wins over defaults — never invert the merge. Per-element seeding effects still own persistence (full label entries).

## Adding a new defaulted element

When introducing a new element type with a `defaultValue` / `defaultIndex`:

1. Add a case in `elements/collectDefaults.ts` returning `{value, label?}`.
2. If the element clamps/coerces the raw default at runtime (like `CarouselElementComponent.clampIndex`), mirror the same logic in `collectDefaults.ts` — otherwise the overlaid value disagrees with the rendered index.

## Adding a container element (with `children`)

Beyond the schema-mirror checklist in the root CLAUDE.md, a container needs its type added to the `parentType` union in **all 5** spots or tsc cascades (the `ScreenRenderer.tsx` `renderChildren` mismatch is the tell): `shared.ts` (`RenderContext.renderChildren`), `renderElement.tsx` (param + dispatch case), `StackElement.tsx` + `TextElement.tsx` (`Props.parentType`), and `ScreenRenderer.tsx` (the `renderChildren` impl). Children render via `ctx.renderChildren(children, "<Type>")`.

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

`elements/runActions.ts` runs a `ButtonAction[]` (continue / setVariable / custom) — shared by `Button.actions` and the generic `onPress`. It lives in its **own** module, NOT `shared.ts`: `shared.ts` ↔ `expression.ts` already form a cycle (`expression` imports `interpolate` from `shared`) and `runActions` needs both. `ButtonAction` types/schemas are the leaf `elements/actions.ts` (UI mirror of headless `common.types.ts`) so `BaseBoxProps.ts` + `runActions.ts` import them cycle-free. `setVariable` `arrayOp` (`append`/`remove`/`toggle`) operates on the JSON-`string[]` CheckboxGroup encoding — value = `JSON.stringify(values)`, label = comma-joined members.

## Product variables

Resolved store products are projected into the variable bag as FLAT DOTTED KEYS
(`product.<slot>.price`, `product.<slot>.pricePerWeek`, `product.<slot>.savingsPct`,
plus `products.loaded` / `products.purchasing` / `products.error`). `interpolate()`
and `evaluateCondition` both do a flat `variables[key]` lookup, so this needs no
engine change — `{{product.yearly.price}}` and
`renderWhen: { "products.loaded": { eq: "true" } }` just work.

Products OVERLAY the merged bag and win over author variables
(`withProductVariables` in `Runtime/variables.ts`): they are facts read from the
store, and a displayed price must match what StoreKit charges.

**Never render a price the CMS supplied.** Prices come only from a
`ProductProvider`. When resolution fails, `products.loaded` is `"false"` — gate
the CTA on it.

`ProductRuntime` sits in `RenderContext`, so it must be referentially stable
across variable writes; `useProducts` memoizes it on its contents. An unstable
one re-renders every memoized element on every write, and nothing type-checks it.
