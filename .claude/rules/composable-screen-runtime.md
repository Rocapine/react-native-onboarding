---
paths:
  - "packages/onboarding-ui/src/UI/Pages/ComposableScreen/**"
---

# ComposableScreen UIElement Runtime

## Container style (BaseBoxProps)

Every UIElement renderer that wraps content builds `containerStyle` from `BaseBoxProps`: `alignSelf`, `flex`, `flexShrink/Grow`, `width` (via `dim()`), `height` (via `dim()`), `min/maxWidth/Height`, `margin*`, `padding*`, `borderRadius/Width/Color`, `backgroundColor` (only when no `backgroundGradient`), `opacity`, `overflow`. Apply to outermost wrapper (`GradientBox` or `View`). Missing fields = user can't control that aspect from CMS payload.

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

## Font hook rule (Text-rendering elements)

```ts
const f = useResolvedFontStyle(props.fontFamily, props.fontWeight);
// style: { fontFamily: f.fontFamily, fontWeight: f.resolvedToVariant ? undefined : (props.fontWeight as any) ?? <theme default> }
```

`f.resolvedToVariant === true` → registry matched concrete weighted variant (e.g. `Inter-700`); **suppress `fontWeight`** or iOS/Android applies synthetic emboldening on top of already-weighted font file.

Use legacy `useResolvedFontFamily` only for elements that never set `fontWeight`.

## RenderContext variables → primitive flattening

`ctx.variables` is `Record<string, ComposableVariableEntry>` (each entry `{value, label?}`). Headless utils that expect primitive variables (`evaluateCondition`, `evaluateLeaf`, `resolveNextStepNumber`) want `Record<string, unknown>`. Flatten before calling:

```ts
const flatVars = useMemo(
  () => Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, v?.value])),
  [variables]
);
```

Skip the flatten and your condition reads the entry object, not its value — every `eq`/`neq` silently mis-evaluates.

## `renderWhen` gating

Every UIElement variant accepts optional `renderWhen?: LeafCondition | ConditionGroup`. Single gating point at top of `elements/renderElement.tsx`: flatten `ctx.variables`, call `evaluateCondition`, return `null` if false. Covers all 15 variants — container subtrees skip naturally because the bail-out runs before `renderChildren`.

## Element-default overlay (Renderer.tsx)

`Renderer.tsx` builds `effectiveVariables = { ...collectElementDefaults(elements), ...composableVariables }` so `renderWhen` + `{{var}}` interpolation see element-declared defaults (`Carousel.defaultIndex`, `RadioGroup.defaultValue`, etc.) on first render. `composableVariables` wins over defaults — never invert the spread. Per-element seeding effects still own persistence (full label entries).

## Adding a new defaulted element

When introducing a new element type with a `defaultValue` / `defaultIndex`:

1. Add a case in `elements/collectDefaults.ts` returning `{value, label?}`.
2. If the element clamps/coerces the raw default at runtime (like `CarouselElementComponent.clampIndex`), mirror the same logic in `collectDefaults.ts` — otherwise the overlaid value disagrees with the rendered index.

## iOS shadow needs no overflow clip

A view with `overflow: hidden` (default for `Image`, gradient wrappers, many container styles) clips its own shadow on iOS, so the shadow renders invisible. For elements that want a shadow, build a wrapper View that carries `shadow*` + layout (no overflow clip) and let the inner content carry `borderRadius` + `overflow: hidden` for corner clipping. See `ImageElement.tsx` / `ButtonElement.tsx`. Also: when only `shadowColor` is set, default `shadowOpacity:1`, `shadowRadius:4` — iOS defaults opacity to 0 so a lone `shadowColor` does nothing.

## RN treats `padding` and `padding{Horizontal,Vertical}` independently

`style={{ padding: eff.padding, paddingHorizontal: eff.paddingHorizontal ?? 24 }}` will still apply 24 when payload sets `padding: 0`, because the axis prop's `??` fallback ignores the shorthand. Gate axis defaults on `eff.padding != null ? undefined : <default>` so explicit `padding:0` actually wins. Same gotcha for `margin`.

## Don't wrap ComposableScreen payload in a page-level ScrollView

Page Renderer is intentionally a plain `View flex:1` inside `KeyboardAvoidingView` — `contentContainerStyle: { flexGrow: 1 }` leaves inner `flex:1` children unbounded vertically, so a `Carousel`/`flex:1` payload grows with its intrinsic content and pushes siblings off-screen. Payloads needing scroll must use the `ScrollView` UIElement.

## Rive intrinsic = artboard pixel size

`rive-react-native` doesn't expose the artboard ratio to JS, so a Rive view with no `height` / `flex` / `aspectRatio` reports the raw artboard pixels as its intrinsic — fills the screen. `RiveElement` falls back to `aspectRatio: 1` when unsized; authors with a known ratio override via `aspectRatio`.
