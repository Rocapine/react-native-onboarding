---
paths:
  - "packages/onboarding-ui/src/UI/Pages/ComposableScreen/**"
---

# ComposableScreen UIElement Runtime

## Container style (BaseBoxProps)

Every UIElement renderer that wraps content builds `containerStyle` from `BaseBoxProps`: `alignSelf`, `flex`, `flexShrink/Grow`, `width` (via `dim()`), `height` (via `dim()`), `min/maxWidth/Height`, `margin*`, `padding*`, `borderRadius/Width/Color`, `backgroundColor` (only when no `backgroundGradient`), `opacity`, `overflow`. Apply to outermost wrapper (`GradientBox` or `View`). Missing fields = user can't control that aspect from CMS payload.

## Motion: animation / transform (BaseBoxProps)

`animation` (`entering`/`exiting`/`layout`/`effect`) + `transform` live on `BaseBoxProps`, so every element inherits them. A single `AnimatedBox` wrapper injected in `renderElement` (only when `animation`/`transform` present) applies them for all 15 types — **don't** convert individual element roots to `Animated.View`. It forwards `flex`/`alignSelf` so the wrapper stays layout-transparent.

`buildAnimation.ts` resolves reanimated builders **by name** (`Reanimated[preset]`) — the schema `preset` string IS the exact reanimated builder name; unknown preset → no-op (forward-compat). Shared `EASING_MAP` lives here (imported by `ProgressIndicatorElement`) — don't re-declare it.

## TextSpan is not a UIElement

Rich-text `TextSpan` (Text element's `content[]`) renders as inline nested `<Text>` (`RichTextSpan`), bypassing `renderElement` — so **no `animation`/`transform`/`effect` on spans** (and RN ignores `transform` on inline nested Text regardless). Animated/rotating text = a standalone `Text` element. Spans take only inline text-style props (font*, color, backgroundColor, opacity, textTransform, textDecoration*, letterSpacing, lineHeight).

The **element-level** alternative is the `RichText` container (`RichTextElement.tsx`): a **wrapping flex row `<View>`** (`flexDirection:"row"`, `flexWrap` default `"wrap"`) whose `children` (Text-only) render via `renderElement`. Because each child `Text` is a real flex child of a `<View>` — **not** a nested `<Text>` — it honors its own box props (`padding`, `borderRadius`, `borderWidth`, `backgroundColor`, `margin`, `transform`), so words + padded/rounded/rotated chips wrap and align together (mirrors the Tamagui `XStack flexWrap="wrap"` of `<Text>`/chip pattern in host apps). Children keep `renderWhen` / `expression`, and — unlike inline spans — **may** use `animation`/`transform` (the `AnimatedBox` `View` wrapper is valid inside the row). Children are Text-only at the schema level (`children: z.array(TextUIElementSchema)`). This is distinct from inline `TextSpan` (one wrapping paragraph, text-style only).

**Inherited text style:** a `<View>` doesn't propagate text style to nested `<Text>`, so RichText's text-style props (`fontSize`/`color`/`textAlign`/etc.) are published via `RichTextStyleContext` (in `shared.ts`); `TextElementComponent` reads it with `useContext` and merges each field as `p.X ?? inherited.X` (child wins). Empty default `{}` → Text outside a RichText is unchanged. So container typography is declared once and children inherit — don't expect View-level text style to cascade on its own.

**Word-splitting (why a multi-word child wraps):** a flex row wraps between *items*, not inside them — so a single multi-word `Text` child would drop to its own line as one block (chip stranded above). RichText fixes this by expanding each **flowing-text** child (`isFlowingText`: plain string content, no box styling / motion) into one inline `<Text>` per `split(/(\s+)/)` token (words **and** spaces preserved), so text wraps word-by-word like `parseTitleWithChips` in host apps. **Chips** (children with `backgroundColor`/`borderRadius`/`border`/`padding`/`animation`/`transform`) stay atomic. Consequences: don't set `gap` when relying on split spacing (it double-spaces — spaces are real items); give chips `marginHorizontal` for breathing room; `renderWhen` is evaluated once per source child before splitting (words then render unconditionally), and `expression` is interpolated before the split.

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

## Multi-select variables are JSON-encoded strings

`CheckboxGroup` stores its value as `JSON.stringify(string[])` to fit the string-based variable system — an empty selection is the literal `"[]"`, not `""`. `evaluateCondition` decodes any value that parses to an array before testing, so `is_empty` / `is_not_empty` / `contains` / `in` see the real collection. Anything else reading these vars (new operators, `{{interpolation}}`) must decode too — a raw `"[]"` is a non-empty 2-char string and reads as "not empty".

## `renderWhen` gating

Every UIElement variant accepts optional `renderWhen?: LeafCondition | ConditionGroup`. Single gating point at top of `elements/renderElement.tsx`: flatten `ctx.variables`, call `evaluateCondition`, return `null` if false. Covers all 15 variants — container subtrees skip naturally because the bail-out runs before `renderChildren`.

## Element-default overlay (Renderer.tsx)

`Renderer.tsx` builds `effectiveVariables = { ...collectElementDefaults(elements), ...composableVariables }` so `renderWhen` + `{{var}}` interpolation see element-declared defaults (`Carousel.defaultIndex`, `RadioGroup.defaultValue`, etc.) on first render. `composableVariables` wins over defaults — never invert the spread. Per-element seeding effects still own persistence (full label entries).

## Adding a new defaulted element

When introducing a new element type with a `defaultValue` / `defaultIndex`:

1. Add a case in `elements/collectDefaults.ts` returning `{value, label?}`.
2. If the element clamps/coerces the raw default at runtime (like `CarouselElementComponent.clampIndex`), mirror the same logic in `collectDefaults.ts` — otherwise the overlaid value disagrees with the rendered index.

## Adding a container element (with `children`)

Beyond the schema-mirror checklist in the root CLAUDE.md, a container needs its type added to the `parentType` union in **all 5** spots or tsc cascades (the `Renderer.tsx` `renderChildren` mismatch is the tell): `shared.ts` (`RenderContext.renderChildren`), `renderElement.tsx` (param + dispatch case), `StackElement.tsx` + `TextElement.tsx` (`Props.parentType`), and `Renderer.tsx` (the `renderChildren` impl). Children render via `ctx.renderChildren(children, "<Type>")`.

**Restricting children to one element type** (e.g. `RichText` → Text-only): extract that variant's `z.object` into a named const (`TextUIElementSchema`) in **both** `types.ts` files, reference it in the union slot **and** `children: z.array(...)`; TS type is `children: Array<Extract<UIElement, { type: "X" }>>`. A non-matching child then fails parse with `invalid_union`.

**Text-style inheritance from a `<View>` container** doesn't cascade in RN — publish the container's text props via a React context (`RichTextStyleContext` in `shared.ts`) and merge in `TextElementComponent` as `p.X ?? inherited.X` (child wins).

## iOS shadow needs no overflow clip

A view with `overflow: hidden` (default for `Image`, gradient wrappers, many container styles) clips its own shadow on iOS, so the shadow renders invisible. For elements that want a shadow, build a wrapper View that carries `shadow*` + layout (no overflow clip) and let the inner content carry `borderRadius` + `overflow: hidden` for corner clipping. See `ImageElement.tsx` / `ButtonElement.tsx`. Also: when only `shadowColor` is set, default `shadowOpacity:1`, `shadowRadius:4` — iOS defaults opacity to 0 so a lone `shadowColor` does nothing.

## RN treats `padding` and `padding{Horizontal,Vertical}` independently

`style={{ padding: eff.padding, paddingHorizontal: eff.paddingHorizontal ?? 24 }}` will still apply 24 when payload sets `padding: 0`, because the axis prop's `??` fallback ignores the shorthand. Gate axis defaults on `eff.padding != null ? undefined : <default>` so explicit `padding:0` actually wins. Same gotcha for `margin`.

## Don't wrap ComposableScreen payload in a page-level ScrollView

Page Renderer is intentionally a plain `View flex:1` inside `KeyboardAvoidingView` — `contentContainerStyle: { flexGrow: 1 }` leaves inner `flex:1` children unbounded vertically, so a `Carousel`/`flex:1` payload grows with its intrinsic content and pushes siblings off-screen. Payloads needing scroll must use the `ScrollView` UIElement.

## Rive intrinsic = artboard pixel size

`rive-react-native` doesn't expose the artboard ratio to JS, so a Rive view with no `height` / `flex` / `aspectRatio` reports the raw artboard pixels as its intrinsic — fills the screen. `RiveElement` falls back to `aspectRatio: 1` when unsized; authors with a known ratio override via `aspectRatio`.
