# @rocapine/react-native-onboarding

**A CMS-driven onboarding system for React Native mobile apps.**

Build beautiful, customizable onboarding flows that update instantly without app releases.

---

## ✨ Features

- 🎨 **Pre-built Components** - Ready-to-use screens (ratings, pickers, carousels, media content, and more)
- 🔄 **CMS-Driven** - Update onboarding flows remotely without app releases
- 📱 **React Native** - Works with Expo and bare React Native projects
- 🎯 **Type-Safe** - Full TypeScript support with runtime validation
- 💾 **Offline Support** - Built-in caching with AsyncStorage
- 🎭 **Themeable** - Customizable colors, typography, and styling
- 🔧 **Extensible** - Three levels of customization from theme tokens to complete renderer overrides

---

## 🚀 Quick Start

### Installation

```bash
npm install @rocapine/react-native-onboarding
npx expo install expo-router
```

### Setup

```typescript
import {
  OnboardingProvider,
  OnboardingStudioClient,
  ProgressBar,
} from "@rocapine/react-native-onboarding";

const client = new OnboardingStudioClient("your-project-id", {
  appVersion: "1.0.0",
});

export default function RootLayout() {
  return (
    <OnboardingProvider
      client={client}
      locale="en"
      customAudienceParams={{ onboardingId: "your-onboarding-id" }}
    >
      <ProgressBar />
      <YourApp />
    </OnboardingProvider>
  );
}
```

### Use in Your Screens

```typescript
import {
  useOnboardingQuestions,
  OnboardingPage,
} from "@rocapine/react-native-onboarding";

export default function OnboardingScreen() {
  const { step, isLastStep } = useOnboardingQuestions({ stepNumber: 1 });

  const handleContinue = () => {
    if (isLastStep) {
      router.push("/home");
    } else {
      router.push(`/onboarding/${stepNumber + 1}`);
    }
  };

  return <OnboardingPage step={step} onContinue={handleContinue} />;
}
```

That's it! 🎉

---

## 📚 Documentation

### For SDK Users

Complete documentation for using the SDK in your app:

- **[Getting Started](./docs/getting-started.mdx)** - Installation, setup, and your first onboarding flow
- **[Core Concepts](./docs/core-concepts.mdx)** - How the SDK works, caching, progress tracking
- **[API Reference](./docs/api-reference.mdx)** - Complete API documentation
- **[Page Types](./docs/page-types.mdx)** - Available page types and their features

### Customization

Learn how to customize your onboarding experience:

- **[Customization Overview](./docs/customization/intro.mdx)** - Choose your customization level
- **[Level 1: Theming](./docs/customization/theming.mdx)** - Colors, typography, and semantic styles
- **[Level 2: Custom Components](./docs/customization/custom-components.mdx)** - Replace specific UI components
- **[Level 3: Custom Renderers](./docs/customization/custom-renderers.mdx)** - Complete screen control

### Support

- **[Troubleshooting](./docs/troubleshooting.mdx)** - Common issues and solutions

### For Contributors

Want to contribute to the SDK?

- **[Contributing Guide](./CONTRIBUTING.md)** - Development setup, architecture, and contribution guidelines

---

## 🎭 Customization Levels

### Level 1: Theming

Customize colors, typography, and semantic styles:

```typescript
<OnboardingProvider
  theme={{
    colors: { primary: "#FF5733" },
    typography: { fontFamily: { title: "CustomFont-Bold" } },
  }}
/>
```

### Level 2: Custom Components

Replace specific UI components:

```typescript
<OnboardingProvider
  customComponents={{
    QuestionAnswerButton: CustomButton,
    QuestionAnswersList: AnimatedList,
  }}
/>
```

### Level 3: Custom Renderers

Complete control over entire screens:

```typescript
export default function OnboardingScreen() {
  const { step } = useOnboardingQuestions({ stepNumber });

  if (step.id === "custom-screen") {
    return <CustomRenderer step={step} onContinue={handleContinue} />;
  }

  return <OnboardingPage step={step} onContinue={handleContinue} />;
}
```

---

## 🎨 Available Page Types

- **Question** - Interactive questions with single or multiple choice answers
- **MediaContent** - Display images or videos with title and description
- **Carousel** - Multi-slide horizontal pagination with page indicators
- **Picker** - Type-specific input pickers for structured data
- **Loader** - Sequential progress animation with optional carousel
- **Ratings** - App store rating prompts with social proof
- **Commitment** - User commitment and agreement screens

[Learn more about page types →](./docs/page-types.mdx)

---

## 📦 Optional Dependencies

Install these only if you're using the specific screen types:

| Screen Type                | Package                       | Install Command                                |
| -------------------------- | ----------------------------- | ---------------------------------------------- |
| **Picker**                 | `@react-native-picker/picker` | `npx expo install @react-native-picker/picker` |
| **Ratings**                | `expo-store-review`           | `npx expo install expo-store-review`           |
| **Commitment** (signature) | `@shopify/react-native-skia`  | `npx expo install @shopify/react-native-skia`  |

---

## 💡 Example Project

Check out the `example/` directory for a complete working example:

```bash
cd example/
npm install
npm start
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Publishing:

- Bump version and commit "chore: bump version"
- Publish
  ```
  npm publish --access public
  ```

---

## 📧 Support

- **Email:** support@rocapine.com
- **Issues:** [GitHub Issues](https://github.com/rocapine/react-native-onboarding-studio/issues)
- **Documentation:** [Rocapine Docs](https://docs.rocapine.com)

---

## 📄 License

MIT © [Rocapine](https://rocapine.com)
