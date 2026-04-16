# @rocapine/react-native-onboarding-ui

**UI layer for the Rocapine Onboarding Studio SDK.**

Pre-built renderers, components, and a theme system on top of
`@rocapine/react-native-onboarding`.

---

## Installation

```bash
npm install @rocapine/react-native-onboarding-ui @rocapine/react-native-onboarding
```

---

## Usage

Render any CMS-driven step with a single component:

```typescript
import { OnboardingPage } from "@rocapine/react-native-onboarding-ui";

export default function OnboardingScreen() {
  const { step } = useOnboardingQuestions({ stepNumber: 1 });
  return <OnboardingPage step={step} onContinue={handleContinue} />;
}
```

---

## 🎨 Page Types

| Type                                     | Description                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `Question`                               | Single / multi-select answer screens                   |
| `MediaContent`                           | Image or video with title and description              |
| `Carousel`                               | Horizontal paginated slides                            |
| `Picker`                                 | Structured data pickers (weight, height, age, gender…) |
| `Loader`                                 | Animated progress bars with optional carousel          |
| `Ratings`                                | App store rating prompts with social proof             |
| `Commitment`                             | Agreement / signature screens                          |
| `ComposableScreen` _(under development)_ | Declarative layout system — see below                  |

---

## 🧱 ComposableScreen _(under development)_

> **This page type is still under active development. The API may change before
> it is considered stable.**

`ComposableScreen` lets you build arbitrary onboarding screens entirely from CMS
data, without writing a custom renderer. You compose a tree of layout and text
elements that is rendered directly to native views.

### Element types

**`YStack`** — vertical flex container (`flexDirection: "column"`)

**`XStack`** — horizontal flex container (`flexDirection: "row"`)

**`Text`** — text node

### Supported props

#### Stack elements (`YStack` / `XStack`)

| Prop                | Type                                                                          | Notes                                  |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| `gap`               | `number`                                                                      | Space between children                 |
| `padding`           | `number`                                                                      |                                        |
| `paddingHorizontal` | `number`                                                                      |                                        |
| `paddingVertical`   | `number`                                                                      |                                        |
| `margin`            | `number`                                                                      |                                        |
| `marginHorizontal`  | `number`                                                                      |                                        |
| `marginVertical`    | `number`                                                                      |                                        |
| `flex`              | `number`                                                                      |                                        |
| `flexShrink`        | `number`                                                                      | Defaults to `1` inside an `XStack`     |
| `flexWrap`          | `"wrap" \| "nowrap"`                                                          |                                        |
| `alignItems`        | `"flex-start" \| "center" \| "flex-end" \| "stretch"`                         |                                        |
| `justifyContent`    | `"flex-start" \| "center" \| "flex-end" \| "space-between" \| "space-around"` |                                        |
| `width`             | `number`                                                                      |                                        |
| `height`            | `number`                                                                      |                                        |
| `minWidth`          | `number`                                                                      |                                        |
| `maxWidth`          | `number`                                                                      |                                        |
| `minHeight`         | `number`                                                                      |                                        |
| `maxHeight`         | `number`                                                                      |                                        |
| `backgroundColor`   | `string`                                                                      |                                        |
| `borderWidth`       | `number`                                                                      |                                        |
| `borderRadius`      | `number`                                                                      |                                        |
| `borderColor`       | `string`                                                                      |                                        |
| `overflow`          | `"hidden" \| "visible" \| "scroll"`                                           | Use `"hidden"` to clip rounded corners |
| `opacity`           | `number`                                                                      |                                        |

#### Text elements

| Prop                | Type                            | Notes                                   |
| ------------------- | ------------------------------- | --------------------------------------- |
| `content`           | `string`                        | **Required**                            |
| `fontSize`          | `number`                        |                                         |
| `fontWeight`        | `string`                        |                                         |
| `color`             | `string`                        | Defaults to `theme.colors.text.primary` |
| `textAlign`         | `"left" \| "center" \| "right"` |                                         |
| `letterSpacing`     | `number`                        |                                         |
| `lineHeight`        | `number`                        |                                         |
| `backgroundColor`   | `string`                        |                                         |
| `padding`           | `number`                        |                                         |
| `paddingHorizontal` | `number`                        |                                         |
| `paddingVertical`   | `number`                        |                                         |
| `margin`            | `number`                        |                                         |
| `marginHorizontal`  | `number`                        |                                         |
| `marginVertical`    | `number`                        |                                         |
| `borderWidth`       | `number`                        |                                         |
| `borderRadius`      | `number`                        |                                         |
| `borderColor`       | `string`                        |                                         |
| `opacity`           | `number`                        |                                         |

### Example payload

```json
{
  "type": "ComposableScreen",
  "payload": {
    "elements": [
      {
        "id": "card",
        "type": "YStack",
        "props": {
          "padding": 24,
          "gap": 12,
          "borderWidth": 1,
          "borderRadius": 16,
          "borderColor": "#E0E0E0",
          "overflow": "hidden"
        },
        "children": [
          {
            "id": "title",
            "type": "Text",
            "props": {
              "content": "Welcome aboard",
              "fontSize": 24,
              "fontWeight": "700"
            }
          },
          {
            "id": "subtitle",
            "type": "Text",
            "props": {
              "content": "Let's get you set up.",
              "fontSize": 16
            }
          }
        ]
      }
    ]
  }
}
```

---

## 🎭 Theming

Pass a `theme` prop (or `lightTheme` / `darkTheme`) to `OnboardingProvider`:

```typescript
<OnboardingProvider
  theme={{
    colors: { primary: "#FF5733" },
    typography: { fontFamily: { title: "CustomFont-Bold" } },
  }}
/>;
```

See `@rocapine/react-native-onboarding` for the full token reference.

---

## 📦 Optional Dependencies

| Feature                | Package                       |
| ---------------------- | ----------------------------- |
| Picker screens         | `@react-native-picker/picker` |
| Ratings screen         | `expo-store-review`           |
| Commitment (signature) | `@shopify/react-native-skia`  |

---

## 📄 License

MIT © [Rocapine](https://rocapine.com)
