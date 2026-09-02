# @rocapine/react-native-onboarding

**A CMS-driven onboarding system for React Native mobile apps.**

Build beautiful, customizable onboarding flows that update instantly without app
releases.

---

## ✨ Features

- 🎨 **Pre-built Components** - Ready-to-use screens (ratings, pickers,
  carousels, media content, and more)
- 🔄 **CMS-Driven** - Update onboarding flows remotely without app releases
- 📱 **React Native** - Works with Expo and bare React Native projects
- 🎯 **Type-Safe** - Full TypeScript support with runtime validation
- 💾 **Offline Support** - Built-in AsyncStorage caching; stale-while-revalidate by default, or pin a version with a custom `cacheKey`
- 🎭 **Themeable** - Customizable colors, typography, and styling
- 🔧 **Extensible** - Three levels of customization from theme tokens to
  complete renderer overrides

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
  OnboardingStudio,
  ProgressBar,
} from "@rocapine/react-native-onboarding";

// Once, at module scope — before anything renders.
OnboardingStudio.init({
  projectId: "your-project-id",
  appVersion: "1.0.0",
});

export default function RootLayout() {
  return (
    <OnboardingProvider
      locale="en"
      customAudienceParams={{ onboardingId: "your-onboarding-id" }}
    >
      <ProgressBar />
      <YourApp />
    </OnboardingProvider>
  );
}
```

`init` returns the client it built, if you want it for `clearCache()`. You can
also still construct one yourself and pass it as a `client` prop — an explicit
prop always wins over `init`.

### Use in Your Screens

```typescript
import {
  OnboardingPage,
  useOnboardingQuestions,
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

## 👤 User Properties

Audience targeting reads a `key: value` map of user properties. `OnboardingStudio`
is a module-level object, so a login handler or an analytics service can write to
it — no hook, no provider:

```typescript
import { OnboardingStudio } from "@rocapine/react-native-onboarding";

OnboardingStudio.setUserProperty("plan", "free");
OnboardingStudio.setUserProperties({ daysSinceInstall: 3, hasTeam: true });

OnboardingStudio.setUserProperty("plan", null);  // null DELETES a key
OnboardingStudio.removeUserProperty("plan");     // same thing
OnboardingStudio.getUserProperties();
OnboardingStudio.reset();                        // forget the user — e.g. on logout
```

`setUserProperties` **merges**, so independent writers don't clobber each other.
Values may be `string`, `number` or `boolean`. To read them in a component:

```typescript
const { properties, status } = useUserProperties();
```

`reset()` clears user properties only — it deliberately leaves the payload cache
alone, because logging out shouldn't force a refetch of content that hasn't
changed. Use `OnboardingStudio.getClient()?.clearCache()` if you want both.

### Getting the first launch right

Properties are only *hydrated* from disk, so a first-ever install has nothing to
hydrate. Seed them in `init` — which runs before anything renders — and even that
first launch is targeted correctly:

```typescript
OnboardingStudio.init({
  projectId: "your-project-id",
  userProperties: { plan: "free" },
});
```

**Properties persist** to AsyncStorage and are hydrated before the first
fetch, so a returning user is targeted correctly on the very first launch-frame
with no host code. A first-ever install has nothing to hydrate: its first
onboarding matches your catch-all audience — see
[Getting the first launch right](#getting-the-first-launch-right) to avoid even
that.

### When a change applies

**Audience resolution happens at serve time, and a served payload is frozen for
that presentation.** A property you set applies to the *next* serve, never
retroactively:

- **Onboarding** — served once, when `OnboardingProvider` mounts. A
  `setUserProperty` during the flow (or a change to the `customAudienceParams`
  prop) does not refetch, re-key or swap the onboarding under the user, and
  does not blank the screen; it is picked up the next time an onboarding is
  served — the next mount, or the next launch. So write a property the moment
  you compute it, even mid-onboarding. The corollary: anything *this* serve
  must target on has to be set **before the provider mounts** — a property that
  resolves asynchronously during startup (attribution, a score fetched over the
  network) and lands after mount targets the next serve, silently.
- **Paywall** — served at `register(moment)` / `present(moment)`. The catalog
  follows the store until then, so a property set before the call is honoured
  by it; one set after applies to the next call.
- **`reset()`** follows the same rule: it clears the properties for the *next*
  serve. An onboarding already on screen keeps the audience it was served with
  — on logout mid-flow, leave the flow (unmount the provider) rather than
  expecting it to re-target in place.

To re-serve an onboarding with the current properties, present it again — a
remount of the provider (e.g. a `key`) is a new serve. It is also a full
teardown of everything under the provider (in a host that wraps the router:
the router), so do it at a flow boundary, never mid-onboarding.

### Values reach audience filters as strings

Everything crosses the wire on a querystring. The normal authoring shape works as
you'd expect, because the filter's literal is a number and JavaScript coerces:

```jsonc
{ ">=": [{ "var": "daysSinceInstall" }, 3] }   // "3" >= 3  → true ✅
```

Watch for a filter whose literal is itself a **string** — that comparison is
lexicographic, so `"10"` is *not* greater than `"9"`:

```jsonc
{ ">": [{ "var": "daysSinceInstall" }, "9"] }  // "10" > "9" → false ⚠️
```

### Reserved names

These are refused with a warning, because the SDK puts them on the request
querystring itself and a duplicate silently breaks the request:

`projectId`, `platform`, `appVersion`, `draft`, `locale`, `omitNulls`, `moment`,
`now`

### Relationship to `customAudienceParams`

The prop still works and is not deprecated. Treat it as the **static** baseline
(build-time facts like an `onboardingId`) and the store as the **runtime** half.
Where both define a key, **the store wins**.

---

## 🔓 Gating a Feature with `register`

`register` shows the paywall for a moment and runs your feature only if the user
buys:

```typescript
const { register } = usePaywall();

await register("unlock_stats", () => router.push("/stats"));
```

| Situation | What happens |
|---|---|
| The moment has a paywall | It's presented; the feature runs **only** on a purchase |
| The moment has no paywall | The feature runs immediately (`reason: "no-paywall"`) |
| No catalog reachable | The feature runs, with a warning (`reason: "catalog-unavailable"`) |
| Another paywall is already showing | The feature is withheld; the live paywall is untouched |

It returns `{ ran, presented, reason, outcome? }`, so you can log how often you're
giving a feature away:

```typescript
const result = await register("unlock_stats", unlock);
if (result.reason === "catalog-unavailable") analytics.track("gate_failed_open");
```

**`register` fails open.** When the catalog can't be reached — offline, or still
loading after `registerTimeoutMs` (default 3000) — it runs the feature rather than
blocking it. Failing closed would make your gated features silently dead on an
offline launch, with no paywall on screen to explain why. Tune the wait with
`<PaywallProvider registerTimeoutMs={...}>`.

**There is no entitlement check.** `register` gates on the moment alone. To stop
charging an existing subscriber, set a property and author an audience filter on
it:

```typescript
OnboardingStudio.setUserProperty("plan", "pro");   // audience: plan != "pro"
```

> ⚠️ **A Stripe-billed paywall never runs the feature**, even after a successful
> checkout: a Payment Link's entitlement arrives out-of-band through RevenueCat, so
> the presentation never reports `"purchased"`. Grant access from your RevenueCat
> entitlement webhook instead. `register` warns when it presents one.

---

## 📚 Documentation

### For SDK Users

Complete documentation for using the SDK in your app:

- **[Getting Started](./docs/getting-started.mdx)** - Installation, setup, and
  your first onboarding flow
- **[Core Concepts](./docs/core-concepts.mdx)** - How the SDK works, caching,
  progress tracking
- **[API Reference](./docs/api-reference.mdx)** - Complete API documentation
- **[Page Types](./docs/page-types.mdx)** - Available page types and their
  features

### Customization

Learn how to customize your onboarding experience:

- **[Customization Overview](./docs/customization/intro.mdx)** - Choose your
  customization level
- **[Level 1: Theming](./docs/customization/theming.mdx)** - Colors, typography,
  and semantic styles
- **[Level 2: Custom Components](./docs/customization/custom-components.mdx)** -
  Replace specific UI components
- **[Level 3: Custom Renderers](./docs/customization/custom-renderers.mdx)** -
  Complete screen control

### Support

- **[Troubleshooting](./docs/troubleshooting.mdx)** - Common issues and
  solutions

### For Contributors

Want to contribute to the SDK?

- **[Contributing Guide](./CONTRIBUTING.md)** - Development setup, architecture,
  and contribution guidelines

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
/>;
```

### Level 2: Custom Components

Replace specific UI components:

```typescript
<OnboardingProvider
  customComponents={{
    QuestionAnswerButton: CustomButton,
    QuestionAnswersList: AnimatedList,
  }}
/>;
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
- **ComposableScreen** _(under development)_ - Declarative layout system driven
  entirely from the CMS. Build arbitrary screens by composing `YStack`,
  `XStack`, and `Text` elements with full layout, spacing, border, and
  typography control — no custom renderer needed.

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

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md)
for details.

### Publishing:

- Bump version and commit "chore: bump version"
- Publish
  ```
  npm publish --access public
  ```

---

## 📧 Support

- **Email:** support@rocapine.com
- **Issues:**
  [GitHub Issues](https://github.com/rocapine/react-native-onboarding-studio/issues)
- **Documentation:** [Rocapine Docs](https://docs.rocapine.com)

---

## 📄 License

MIT © [Rocapine](https://rocapine.com)
