---
name: setup-headless-sdk
description: Installs and wires the `@rocapine/react-native-onboarding` headless SDK in an Expo or React Native app — constructs the `OnboardingStudioClient`, mounts `OnboardingProvider`, and consumes the flow with `useOnboardingStart` / `useOnboardingStep`. Use when the user wants to add the Rocapine onboarding data layer to their app, asks "set up the onboarding SDK", "install rocapine headless", "connect to onboarding studio", or "why is my onboarding not loading".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: [project-id?]
---

# Setup Headless SDK

Install `@rocapine/react-native-onboarding`, construct a client, mount `OnboardingProvider`, and read the flow with the onboarding hooks.

## When invoked

1. **Inspect target app first** — run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture entry point, existing theme system, font loading mechanism, env-var convention, error-boundary library in use. Tailor every step below to those findings.
2. **Run `check-sdk-version` skill** if the SDK is already installed — if mismatched, propose an upgrade and wait for the user's decision. Refusal is fine; carry on with whatever's installed.
3. Verify the target is an Expo/RN app: `package.json` contains `expo` or `react-native`.
4. If the SDK is already installed, jump to the wiring step.

## Install

```bash
npx expo install @rocapine/react-native-onboarding
```

Use `npx expo install`, not `npm install`, so Expo resolves a version compatible with the app's React Native. `@rocapine/*` is a private-registry scope — a `401` means the registry isn't configured; run `rocapine doctor --fix` rather than hand-editing `~/.npmrc`.

**Do not install `@tanstack/react-query` or `@react-native-async-storage/async-storage`.** They're regular dependencies of the package, not peer deps — they come along, and `OnboardingProvider` mounts its own `QueryClientProvider` internally. The host neither installs nor configures React Query.

Required peers: `react`, `react-native` (already present in any RN app). Everything else is an **optional** peer, installed only if you use it:

| Optional peer | Needed for |
|---|---|
| `expo-font` | loading locally bundled font files |
| `expo-image` | WebP/AVIF decode + asset preloading |
| `expo-router` | the default navigation adapter (back button + per-step focus effect) |

Non-expo-router apps install nothing extra and inject an adapter instead — see the `setup-ui-sdk` skill's **Back navigation** section.

## Configure the SDK

On **1.74.0+** call `OnboardingStudio.init` **once at module scope**, not inside a component — the providers read it during render, so it must run before the first one:

```tsx
import { OnboardingStudio } from "@rocapine/react-native-onboarding";
import Constants from "expo-constants";

OnboardingStudio.init({
  projectId: process.env.EXPO_PUBLIC_ROCAPINE_PROJECT_ID!,
  appVersion: Constants.expoConfig?.version ?? "1.0.0",
  isSandbox: __DEV__,        // preview unpublished draft steps
  timeout: 10000,
  userProperties: { plan: "free" },   // optional; see User properties below
});
```

`init` returns the client it built, for `clearCache()` — or use `OnboardingStudio.getClient()` later. Calling it twice with the same config is a silent no-op (Fast Refresh re-runs module scope); a *changed* config replaces the client and warns.

**Before 1.74.0, or if you prefer an explicit client**, construct one and pass it as a `client` prop — an explicit prop always wins over `init`:

```tsx
import { OnboardingStudioClient } from "@rocapine/react-native-onboarding";

const client = new OnboardingStudioClient(projectId, { appVersion, isSandbox: __DEV__ });
```

Every option below is accepted by both forms. `OnboardingStudioClientOptions` — all optional:

- `appVersion` — sent as a targeting param.
- `isSandbox` — serves the draft instead of the published deployment. Also always fetches fresh (ignores `cacheKey`).
- `baseUrl` — override the edge-function origin.
- `fallbackOnboarding` — an `Onboarding` object served if the fetch fails. `onboardingExample` is exported from the package for this.
- `timeout` — fetch timeout in ms.
- `cacheKey` — pins the payload. With a `cacheKey` the onboarding is persisted under `rocapine-onboarding-sdk-{cacheKey}` and served **cache-first with no background revalidation** — the pinned version stays put across launches until you call `client.clearCache()`. Omit for the default key and stale-while-revalidate.

`platform` is not an option — the client reads `Platform.OS` itself. There is no `draft` option; it's `isSandbox`.

## Mount the provider

```tsx
import { OnboardingProvider } from "@rocapine/react-native-onboarding";

export default function RootLayout() {
  return (
    <OnboardingProvider
      locale="en"
      fontsFallback={<SplashPlaceholder />}
      onComplete={({ variables, metadata }) => {
        // Terminal branch reached. Navigate away, mark onboarding done, etc.
        router.replace("/(app)");
      }}
    >
      <Stack />
    </OnboardingProvider>
  );
}
```

Every prop `OnboardingProvider` accepts — there are no others:

| Prop | Default | Purpose |
|---|---|---|
| `client` | `OnboardingStudio`'s | optional on 1.74.0+ — omit it and the provider uses the client `init()` built. An explicit one wins. With **neither**, this provider **throws** a message naming both fixes (an onboarding with no client has nothing to render; a host `ErrorBoundary` catches it) |
| `locale` | `"en"` | locale passed to the steps query |
| `customAudienceParams` | `{}` | **static** targeting params for audience matching — build-time facts fixed at mount. Anything that changes at runtime belongs in `OnboardingStudio` (below), which merges over this and wins per key |
| `customActions` | `{}` | named handlers invokable from a ComposableScreen `{ type: "custom" }` Button action |
| `fontsFallback` | `null` | rendered while the payload is fetched **and** remote fonts download |
| `navigation` | expo-router adapter | injectable navigation adapter; must be a stable module-scope reference |
| `onComplete` | — | fired by `completeOnboarding()` with `{ variables, metadata }` |

There is **no** `projectId`, `platform`, `appVersion`, `draft`, `theme`, `lightTheme`, `darkTheme` or `initialColorScheme` prop. Project config lives on `OnboardingStudio.init` (or the client); theming lives on the UI SDK's `ThemeProvider` (see `customize-onboarding-theme`).

**Set `fontsFallback` whenever the onboarding uses Studio-served fonts** — the gate renders `null` during fetch + font download, so without it the user sees a blank frame.

### User properties (audience targeting)

Requires **1.74.0 or later**. Which onboarding a user gets is decided by the project's audience waterfall, evaluated against a `key: value` property map. Set it up whenever the project has more than one audience — otherwise every user matches the catch-all.

```typescript
import { OnboardingStudio } from "@rocapine/react-native-onboarding";

// A module-level object: call this from a login handler or analytics service.
OnboardingStudio.setUserProperty("plan", "free");
OnboardingStudio.setUserProperties({ daysSinceInstall: 3 });
OnboardingStudio.reset();  // forget the user, on logout
```

- `setUserProperties` **merges** (so auth and analytics don't clobber each other); a `null` value deletes a key.
- Values are `string | number | boolean`, and reach filters as strings — a filter comparing against a number coerces fine, one comparing against a string is lexicographic (`"10" > "9"` is false).
- **Persisted and hydrated before the first fetch**, so a returning user is targeted correctly on the first launch-frame with no host code. A first-ever install has nothing to hydrate — seed it in `init` (`init({ projectId, userProperties: { plan: "free" } })`), which runs before anything renders, and even that launch is targeted correctly.
- **A change applies to the NEXT serve, never retroactively.** The onboarding is served once, when `OnboardingProvider` mounts, and that payload is frozen for the presentation: a `setUserProperty` (or a `customAudienceParams` change) during the flow does not refetch, re-key, swap the onboarding or blank the screen — it is picked up on the next mount or launch. Write a property the moment you compute it, even mid-onboarding — but anything **this** serve must target on has to be set before the provider mounts; a property that resolves asynchronously during startup and lands after mount targets the next serve, with no error. `reset()` follows the same rule. A paywall is served at `register`/`present`, so it follows the store until that call. To re-serve an onboarding with the current properties, remount the provider (a `key`) — a full teardown, so at a flow boundary.
- Refused names, because the SDK puts them on the querystring itself: `projectId`, `platform`, `appVersion`, `draft`, `locale`, `omitNulls`, `moment`, `now`.
- The provider holds its query until hydration completes, which is one AsyncStorage read. Set `fontsFallback` and that frame is covered.

**Wire `onComplete`.** The terminal branch calls `completeOnboarding()`; if no handler is set the SDK logs a warning and nothing advances, leaving the user stranded on the last screen.

## Consume the flow

Three hooks, three jobs. Note the hook is `useOnboardingStep` — there is no `useOnboardingQuestions`.

**Entry route** — resolve where the flow starts (honors `configuration.startStepId`, else step 1):

```tsx
import { useOnboardingStart } from "@rocapine/react-native-onboarding";

const { startStepNumber } = useOnboardingStart();
router.push(`/onboarding/${startStepNumber}`);
```

**Step route** — `stepNumber` is **1-indexed**:

```tsx
import {
  useOnboardingStep,
  resolveNextStepNumber,
  OnboardingProgressContext,
} from "@rocapine/react-native-onboarding";

const { step, steps, completeOnboarding } = useOnboardingStep({ stepNumber });
const { setVariable, getVariables } = useContext(OnboardingProgressContext);

const onContinue = (value?: any) => {
  const nextNumber = resolveNextStepNumber(step, getVariables(), steps);
  if (nextNumber === null) completeOnboarding();   // terminal branch
  else router.push(`/onboarding/${nextNumber}`);
};
```

`useOnboardingStep` returns `{ step, isLastStep, stepsLength, onboardingMetadata, steps, completeOnboarding }`. **Branch on `resolveNextStepNumber(...) === null`, not on `isLastStep`** — `isLastStep` is positional and not branch-aware, so it's wrong for any flow with branches or an `__END__` sentinel.

**Layout** — progress state for the header:

```tsx
import { useOnboarding } from "@rocapine/react-native-onboarding";

const { progressPercentage, isProgressBarVisible, onboarding } = useOnboarding();
```

## Suspense and errors

`useOnboardingStep` and `useOnboardingStart` use `useSuspenseQuery`, so any route calling them must sit under a `<Suspense fallback={…}>`.

`OnboardingDataGate` **throws** network/parse errors so the host can handle them — wrap in an `ErrorBoundary` (match the app's existing one from the probe). Never swallow them.

## The progress bar is yours to render

`OnboardingProvider` does **not** inject a progress bar. The host renders `<ProgressBar>` from the UI SDK, driven by `useOnboarding()` — typically in the onboarding layout so it persists across step routes. See `setup-ui-sdk`.

## Environment

```
EXPO_PUBLIC_ROCAPINE_PROJECT_ID=...
```

Match the app's env-var convention from the probe.

## Refreshing a pinned payload

With a `cacheKey` set, the payload never revalidates on its own:

```tsx
await client.clearCache();     // drops the persisted entry; next mount refetches
```

To force an in-session refetch as well, invalidate the React Query key `["onboardingQuestions", …]`.

## Verification

Suggest running the `sdk-integration-verifier` agent.

## Don'ts

- Don't pass `projectId` / `platform` / `appVersion` / `draft` to `OnboardingProvider` — they aren't props. Project config goes in the `OnboardingStudioClient` constructor.
- Don't reach for `useOnboardingQuestions` — it doesn't exist. It's `useOnboardingStep({ stepNumber })`.
- Don't install `@tanstack/react-query` or `async-storage` for the headless SDK, and don't add your own `QueryClientProvider` — the provider brings one.
- Don't construct the client inside a component — a new client each render refetches.
- Don't treat `isLastStep` as the end of the flow; use `resolveNextStepNumber(...) === null`.
- Don't catch errors inside `OnboardingDataGate` — they're meant to bubble.
- Don't omit `onComplete` if any branch terminates; the flow silently stalls.
- Don't hardcode `projectId` in source — use env.
- Don't define the `navigation` adapter inline in JSX — it must be a stable reference.
- Don't skip the app probe — provider placement and env conventions depend on app conventions.

## ComposableScreen note

This plugin authors ComposableScreen steps only, which need the UI SDK to render. Run `setup-ui-sdk` next — it covers the required and optional peer deps ComposableScreen depends on.
