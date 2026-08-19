# ComposableScreen element props

The complete prop surface, straight from the zod schemas. This file answers "does
this prop exist?" — for what a prop MEANS, when to reach for an element, which
optional peer dep it needs and how it degrades without one, read
`../SKILL.md`, which is hand-written on purpose.

**Accepted is not the same as recommended.** The schema still takes some
deprecated props (`Button.action`, superseded by `actions`), and a prop listed
here can still be wrong for the shape you are writing. `../SKILL.md`'s
right/wrong table is the authority on which of these to actually use.

<!-- BEGIN:generated-element-props -->

_Generated from `packages/onboarding/src/screens` by
`scripts/check-element-docs.mjs --write`. Do not edit between the markers._

**Element-level keys** (outside `props`, on every element): `children`, `id`, `name`, `renderWhen`, `type`. `children` is required on containers and forbidden elsewhere.

**Box props** — accepted by every element, omitted from the per-element lists below:

`width` · `height` · `minWidth` · `maxWidth` · `minHeight` · `maxHeight` · `flex` · `flexShrink` · `flexGrow` · `aspectRatio` · `alignSelf` · `opacity` · `backgroundColor` · `backgroundGradient` · `overflow` · `margin` · `marginHorizontal` · `marginVertical` · `padding` · `paddingHorizontal` · `paddingVertical` · `borderWidth` · `borderRadius` · `borderColor` · `shadowColor` · `shadowOffset` · `shadowOpacity` · `shadowRadius` · `elevation` · `transform` · `animation` · `onPress`

### Own props, per element

| Element | Container | Own props (beyond box props) |
|---------|-----------|------------------------------|
| `AnimatedText` | — | `from` · `to` · `duration` · `delay` · `easing` · `autoplay` · `loop` · `decimals` · `thousandsSeparator` · `fontSize` · `fontWeight` · `fontFamily` · `fontStyle` · `color` · `textAlign` · `letterSpacing` · `lineHeight` |
| `Button` | — | `label` · `actions` · `action` · `variant` · `color` · `fontSize` · `fontWeight` · `fontFamily` · `fontStyle` · `textAlign` · `disabledWhen` · `disabledBackgroundColor` · `disabledColor` · `pressedStyle` · `disabledStyle` · `transitionDurationMs` · `haptic` |
| `Carousel` | yes | `carouselType` · `autoPlay` · `autoPlayInterval` · `loop` · `showDots` · `dotColor` · `activeDotColor` · `dotWidth` · `dotHeight` · `activeDotWidth` · `activeDotHeight` · `dotsGap` · `dotsPosition` · `dotsMarginTop` · `dotsMarginBottom` · `defaultIndex` · `variableName` · `progressVariableName` |
| `CheckboxGroup` | — | `variableName` · `defaultValues` · `haptic` · `gap` · `direction` · `itemAlignItems` · `itemGap` · `showTick` · `tickPosition` · `tickColor` · `tickSelectedColor` · `tickBorderRadius` · `tickSize` · `items` · `itemBackgroundColor` · `itemSelectedBackgroundColor` · `itemBorderColor` · `itemSelectedBorderColor` · `itemBorderRadius` · `itemBorderWidth` · `itemColor` · `itemSelectedColor` · `itemFontSize` · `itemFontWeight` · `itemFontFamily` · `itemFontStyle` · `itemSubLabelColor` · `itemSelectedSubLabelColor` · `itemSubLabelFontSize` · `itemSubLabelFontWeight` · `itemSubLabelFontFamily` · `itemSubLabelFontStyle` · `itemPadding` · `itemPaddingHorizontal` · `itemPaddingVertical` · `itemShadowColor` · `itemShadowOffset` · `itemShadowOpacity` · `itemShadowRadius` · `itemElevation` |
| `DatePicker` | — | `variableName` · `defaultValue` · `minimumDate` · `maximumDate` · `mode` · `display` · `textColor` · `accentColor` · `locale` · `format` |
| `DrawingPad` | — | `variableName` · `imageVariableName` · `strokeColor` · `strokeWidth` · `clearable` · `clearButtonPosition` · `clearButtonOffset` · `clearButtonSize` · `clearButtonColor` · `clearButtonIconColor` · `clearButtonLabel` · `imageFormat` |
| `Icon` | — | `name` · `size` · `color` · `strokeWidth` · `fill` · `fillOpacity` |
| `Image` | — | `url` · `mode` · `resizeMode` · `blurRadius` |
| `Input` | — | `variableName` · `placeholder` · `defaultValue` · `keyboardType` · `returnKeyType` · `autoCapitalize` · `secureTextEntry` · `maxLength` · `multiline` · `numberOfLines` · `editable` · `autoFocus` · `color` · `fontSize` · `fontWeight` · `fontFamily` · `fontStyle` · `lineHeight` · `letterSpacing` · `textAlign` · `placeholderColor` |
| `KeyboardAvoidingView` | yes | `behavior` · `keyboardVerticalOffset` · `enabled` |
| `Lottie` | — | `source` · `autoPlay` · `loop` · `speed` |
| `ProgressIndicator` | — | `variant` · `variableName` · `value` · `autoplay` · `loop` · `initialValue` · `minValue` · `maxValue` · `step` · `labelSuffix` · `duration` · `delay` · `easing` · `color` · `trackColor` · `thickness` · `size` · `showLabel` · `labelColor` |
| `ProgressiveBlurImage` | — | `url` · `resizeMode` · `intensity` · `tint` · `mask` · `maxBlurOpacity` · `blurAppear` |
| `RadioGroup` | — | `variableName` · `defaultValue` · `haptic` · `gap` · `direction` · `itemAlignItems` · `itemGap` · `showTick` · `tickPosition` · `tickColor` · `tickSelectedColor` · `tickBorderRadius` · `tickSize` · `items` · `itemBackgroundColor` · `itemSelectedBackgroundColor` · `itemBorderColor` · `itemSelectedBorderColor` · `itemBorderRadius` · `itemBorderWidth` · `itemColor` · `itemSelectedColor` · `itemFontSize` · `itemFontWeight` · `itemFontFamily` · `itemFontStyle` · `itemSubLabelColor` · `itemSelectedSubLabelColor` · `itemSubLabelFontSize` · `itemSubLabelFontWeight` · `itemSubLabelFontFamily` · `itemSubLabelFontStyle` · `itemPadding` · `itemPaddingHorizontal` · `itemPaddingVertical` · `itemShadowColor` · `itemShadowOffset` · `itemShadowOpacity` · `itemShadowRadius` · `itemElevation` |
| `RichText` | yes | `gap` · `alignItems` · `justifyContent` · `flexWrap` · `fontSize` · `fontWeight` · `fontFamily` · `fontStyle` · `color` · `textAlign` · `letterSpacing` · `lineHeight` |
| `Rive` | — | `url` · `autoPlay` · `fit` · `alignment` · `artboardName` · `stateMachineName` |
| `SafeAreaView` | yes | `mode` · `edges` |
| `ScrollView` | yes | `horizontal` · `bounces` · `showsVerticalScrollIndicator` · `showsHorizontalScrollIndicator` · `alwaysBounceVertical` · `alwaysBounceHorizontal` · `contentInset` · `contentContainerPadding` · `keyboardShouldPersistTaps` · `alignItems` · `justifyContent` |
| `Slider` | — | `variableName` · `defaultValue` · `min` · `max` · `step` · `minimumTrackTintColor` · `maximumTrackTintColor` · `thumbTintColor` · `disabled` |
| `Text` | — | `content` · `mode` · `fontSize` · `fontWeight` · `fontFamily` · `fontStyle` · `color` · `textAlign` · `letterSpacing` · `lineHeight` |
| `TypewriterText` | — | `content` · `mode` · `preset` · `duration` · `delay` · `stagger` · `easing` · `spring` · `loop` · `loopDelay` · `cursor` · `cursorChar` · `reserveSpace` · `fontSize` · `fontWeight` · `fontFamily` · `fontStyle` · `color` · `textAlign` · `letterSpacing` · `lineHeight` |
| `Video` | — | `url` · `autoPlay` · `loop` · `muted` · `controls` · `contentFit` |
| `WheelPicker` | — | `variableName` · `defaultValue` · `items` · `range` · `itemColor` · `itemFontSize` · `itemFontFamily` |
| `XStack` | yes | `gap` · `alignItems` · `justifyContent` · `flexWrap` |
| `YStack` | yes | `gap` · `alignItems` · `justifyContent` · `flexWrap` |
| `ZStack` | yes | `justifyContent` · `alignItems` |

<!-- END:generated-element-props -->
