---
name: composable-screen-layout-debug
description: Diagnose ComposableScreen UIElement layout failures (zero size, clipped content, overflow, broken flex). Use when an element renders blank, collapses, or content is cut off.
user-invocable: true
argument-hint: "<ElementName or symptom>"
---

Walks through the common failure modes when a ComposableScreen UIElement renders incorrectly.

## Symptom checklist

| Symptom | Likely cause |
|---------|--------------|
| Element invisible / zero height | No `flex`, no `height`, no children with intrinsic size |
| Content clipped on edges | `overflow: hidden` (default) blocks peek/shadow |
| Carousel/Video/Lottie 0×0 | Library got string `"50%"` width or `undefined` height |
| Children stacked wrong | Missing `flex: 1` on intermediate wrapper, parent has no defined height |
| Gradient invisible | `backgroundGradient` set but `expo-linear-gradient` not installed → falls back to plain `View` |
| `alignSelf` ignored | Parent is `ZStack` (absolute children) instead of YStack/XStack |

## Diagnostic order

### 1. Check what `dim()` returns

`dim(props.width)` passes through numbers and `"50%"` strings. Libraries expecting numeric pixels (e.g. `react-native-reanimated-carousel`) will break on strings. If the element wraps such a library, measure with `onLayout`:

```tsx
const [size, setSize] = useState<{width: number; height: number} | null>(null);
<View style={{flex: 1}} onLayout={e => setSize(e.nativeEvent.layout)}>
  {size && size.width > 0 && <Lib width={size.width} height={size.height} />}
</View>
```

### 2. Check parent stack type

- `YStack` — vertical, children flow top→bottom
- `XStack` — horizontal, children flow left→right
- `ZStack` — absolute layering, children need explicit position

If element vanishes inside `ZStack`, it's likely positioned at `0,0` with no width.

### 3. Check `overflow`

Default for `containerStyle` is `hidden`. Carousel `left-align` carouselType requires `visible` to render the peeking next slide. Same for any element with shadows/badges spilling outside bounds.

### 4. Check gradient peer dep

`GradientBox` silently falls back to plain `<View>` if `expo-linear-gradient` not installed. Check `node_modules/expo-linear-gradient` exists.

### 5. Check `flex` chain

Flex needs unbroken chain from screen root. If one ancestor lacks `flex: 1` or fixed height, descendants collapse. Use React DevTools or temporarily add `borderWidth: 1` debugging borders.

### 6. Check Zod parse passed

If Zod default isn't applied, the prop will be `undefined` at render time. Confirm parsed data, not raw `step.payload`.

---

## Reference: `containerStyle` canonical fields

```typescript
const containerStyle = {
  alignSelf: props.alignSelf,
  flex: props.flex,
  flexShrink: props.flexShrink,
  flexGrow: props.flexGrow,
  width: dim(props.width),
  height: dim(props.height),
  minWidth: props.minWidth,
  maxWidth: props.maxWidth,
  minHeight: props.minHeight,
  maxHeight: props.maxHeight,
  margin: props.margin,
  marginHorizontal: props.marginHorizontal,
  marginVertical: props.marginVertical,
  padding: props.padding,
  paddingHorizontal: props.paddingHorizontal,
  paddingVertical: props.paddingVertical,
  borderRadius: props.borderRadius,
  borderWidth: props.borderWidth,
  borderColor: props.borderColor,
  backgroundColor: props.backgroundGradient ? undefined : props.backgroundColor,
  opacity: props.opacity,
  overflow: props.overflow ?? "hidden",
};
```

If your element is missing any of these, the user can't control that aspect from CMS payload.
