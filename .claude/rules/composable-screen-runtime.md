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
