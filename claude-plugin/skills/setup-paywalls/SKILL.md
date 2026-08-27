---
name: setup-paywalls
description: Wires Rocapine paywalls into an Expo or React Native app — mounts `PaywallProvider`, picks a billing adapter (RevenueCat, expo-iap, or Stripe Payment Links), hosts the modal with `PaywallHost`, and presents by moment with `usePaywall`. Use when the user wants to show a paywall, asks "set up paywalls", "add the upgrade screen", "wire RevenueCat to the onboarding SDK", "charge through Stripe", or "why does present() do nothing".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: [project-id?]
---

# Setup Paywalls

Paywalls are a **separate integration from the onboarding flow.** `OnboardingProvider` does not enable them, and a host can ship one without the other. Four pieces, in this order:

1. `PaywallProvider` — wraps the app, fetches the catalog, resolves products
2. a **billing adapter** — how a purchase actually happens
3. `PaywallHost` — renders the presented paywall's element tree
4. `usePaywall().present(moment)` — shows one

## When invoked

1. **Inspect the target app first** — run the probe from `../onboarding-best-practices/references/inspect-target-app.md`. Capture entry point, existing billing library (RevenueCat? expo-iap? none?), and whether `OnboardingProvider` is already mounted.
2. **Run `check-sdk-version`.** Paywall moments and Stripe need **1.70.0 or later**. On an older version `present()` takes a `placement`, not a `moment`, and there is no Stripe support at all — propose the upgrade and wait for the user's decision.
3. If `PaywallProvider` is already mounted, jump to whichever piece is missing.

## Prerequisite: the studio side must exist first

`present("onboarding_end")` resolves `{ status: "error" }` if no **moment** with that key exists in the project, and a moment with no catch-all audience serves nothing to unmatched users. Confirm in the studio (Moments screen) that the moment exists, has an audience whose filters match, and has at least one published paywall variant. A correct client wiring against an empty moment looks identical to a broken wiring.

## Install

```bash
npx expo install @rocapine/react-native-onboarding @rocapine/react-native-onboarding-ui
```

The UI package is required — `PaywallHost` lives there. `@rocapine/*` is a private-registry scope; a `401` means the registry isn't configured, so run `rocapine doctor --fix` rather than hand-editing `~/.npmrc`.

Then install exactly one billing peer, matching the adapter chosen below. Nothing extra for Stripe.

| Adapter | Peer to install |
|---|---|
| `revenueCatProductProvider` | `react-native-purchases` |
| `expoIapProductProvider` | `expo-iap` |
| `stripeLinkProductProvider` | none |

## Mount `PaywallProvider`

Above everything that might present a paywall — typically the app root, alongside or wrapping `OnboardingProvider`. It fetches the whole catalog **eagerly at mount**, deliberately: a paywall must render the instant the user taps upgrade, so there is no per-moment fetch in the common path.

```tsx
import { PaywallProvider, OnboardingStudioClient } from "@rocapine/react-native-onboarding";

// Same client the onboarding flow uses — construct it once and share it.
// See the `setup-headless-sdk` skill for the full options.
const client = new OnboardingStudioClient(
  process.env.EXPO_PUBLIC_ROCAPINE_PROJECT_ID!,
  { appVersion: Constants.expoConfig?.version ?? "1.0.0", isSandbox: __DEV__ },
);

<PaywallProvider client={client} productProvider={provider}>
  <App />
  <PaywallHost />   {/* see "Host the modal" */}
</PaywallProvider>
```

Props worth knowing:

| Prop | Why |
|---|---|
| `client` | required |
| `productProvider` | the store adapter (App Store / Play) |
| `stripeProductProvider` | the Stripe adapter, if any paywall uses `billing: "stripe"` |
| `locale` | overrides the device locale for authored copy |
| `customAudienceParams` | **static** values the studio's audience filters can match on — build-time facts set once at mount. For anything that changes at runtime use `userProperties` (see below), which merges over this and wins per key |
| `presentAckTimeoutMs` | how long to wait for the host to confirm the paywall appeared. Defaults to 5000. `null` disables the recovery — only pass it if your host genuinely cannot acknowledge. |

**Do not** mount two `PaywallProvider`s. Products are resolved once over the union of every paywall's `products[]` and published through context; a second provider means a second store round-trip and two `purchasing` flags.

## Pick a billing adapter

### Store purchases (the default)

```tsx
import { revenueCatProductProvider } from "@rocapine/react-native-onboarding";
const provider = revenueCatProductProvider();   // uses the installed react-native-purchases
```

or, with no vendor in the path:

```tsx
import { expoIapProductProvider } from "@rocapine/react-native-onboarding";
const provider = expoIapProductProvider();
```

Both resolve a product ref by platform — `ios` on iOS, `android` on Android — and **silently drop a ref whose id for that platform is missing**. That failure is nearly invisible: the paywall still presents and `isReady` still turns true, but every `product.<key>.*` variable renders empty and `purchase()` fails. If prices are blank, check the studio's product catalog before suspecting the wiring.

### Stripe Payment Links (1.70.0+)

For a paywall the studio marks `billing: "stripe"`. Pass it **alongside** the store adapter, not instead of it — the provider publishes whichever runtime matches the presented paywall.

```tsx
import { stripeLinkProductProvider } from "@rocapine/react-native-onboarding";
import Purchases from "react-native-purchases";

const stripeProvider = stripeLinkProductProvider({
  // MUST be the RevenueCat App User ID — see below.
  clientReferenceId: () => Purchases.appUserID,
  restore: () => storeProvider.restore(),
});

<PaywallProvider
  client={client}
  productProvider={storeProvider}
  stripeProductProvider={stripeProvider}
>
```

Four things about this adapter that are not guessable:

- **It makes no network call.** Listing a Stripe price needs a secret key and nothing in this system holds one, so the price is authored in the studio and travels inline on the product ref. That also means the price can drift from Stripe — nothing reconciles them.
- **`clientReferenceId` must return the RevenueCat App User ID.** It is the key RevenueCat's Stripe webhook matches on, and the only thing tying the payment to the user. It is a getter, not a value, because the id changes on login. `purchase()` **fails closed** if it returns null rather than taking money that can never be attributed — so wire it to a source that resolves *after* `Purchases.configure()`, or your first tap returns an error.
- **`purchase()` resolves `"pending"`, never `"purchased"`.** It opens the Payment Link in the browser; on web this JS context is then destroyed. The entitlement arrives later through RevenueCat, so read entitlement state rather than the purchase result.
- **Pass `restore`.** A Payment Link cannot enumerate past purchases, so without a delegate `restore()` returns an error and a Restore button does nothing. Delegate it to your store adapter.

## Host the modal

`PaywallHost` owns its own full-screen `Modal`, reads which paywall is active itself, and wires the acknowledgement — so mounting it is the whole job. Render it as a **sibling** of your app, inside `PaywallProvider`, never as a child of a screen (navigation would unmount it mid-presentation).

```tsx
import { PaywallHost } from "@rocapine/react-native-onboarding-ui";

<PaywallProvider client={client} productProvider={provider}>
  <App />
  <PaywallHost />
</PaywallProvider>
```

That is the whole integration. Its only prop is `customScreens`, and even that is better set on `PaywallProvider` (see below); do **not** hand it `elements`, `complete` or `customActions` — it has no such props and TypeScript will reject them.

### If a paywall renders your own screen

A studio author can set a paywall's Render mode to **Custom screen** instead of an element tree — for a hand-built native paywall the element vocabulary cannot express. Such a paywall names a `customScreenId`, and you register a component under that key:

```tsx
import type { CustomPaywallScreenProps } from "@rocapine/react-native-onboarding-ui";

const NativePaywall = ({ payload, complete, paywall }: CustomPaywallScreenProps) => {
  // payload: { monthly: { ios: "com.app.m", android: "app_m" }, … }
  // Do your own store calls with those ids, then:
  //   complete({ status: "purchased" })  or  complete()  to dismiss.
};

// Module scope, NOT inline in JSX — see the stability note below.
const SCREENS = { "paywall-native-v2": NativePaywall };

// Register on the PROVIDER, not the host: two things render these screens —
// PaywallHost's Modal and a `Paywall` onboarding step (see below) — and only
// the provider is visible to both.
<PaywallProvider client={client} productProvider={provider} customScreens={SCREENS}>
  <App />
  <PaywallHost />
</PaywallProvider>
```

`PaywallHost` still accepts `customScreens` as a prop and it wins where passed, so an integration written against 1.72.0 keeps working — but it is invisible to a `Paywall` onboarding step, so prefer the provider.

Four things that will otherwise cost you an afternoon:

- **`complete` must be called on every exit path**, including your own close button. Until it is, the paywall stays active and every later `present()` resolves `"already-presenting"`. The acknowledgement timeout only rescues a paywall that never *appeared*, not one that appeared and was never closed.
- **`customScreens` must be referentially stable** — module scope or `useMemo`. It lands in the context value and in consumers' dependency arrays, so a fresh object each render re-derives their decisions each render.
- **You get product IDS, not prices.** The SDK resolves no store products for a custom paywall, so `payload` carries ids and your screen asks the store for its own display prices. That is deliberate: a native paywall already knows how to do that, and it is the reason it does not need the studio.
- **An unregistered id shows nothing, by design.** `present()` resolves `{ status: "error", reason: "unknown-custom-screen" }` and the Modal never opens, rather than trapping the user behind an empty full-screen sheet. The console names the missing id *and* the ones you did register, which is usually the whole diagnosis.

Everything else still applies unchanged — the same Modal, so your screen gets the iOS refused-presentation recovery, Android hardware back, and a nested `SafeAreaProvider` for free.

### A paywall as an onboarding STEP

A paywall does not have to be a Modal fired by `present()`. A studio author can add a **`Paywall` step** to an onboarding, which names a moment:

```json
{ "type": "Paywall", "payload": { "moment": "onboarding_end" } }
```

It renders **in flow position** — progress header and all — and the audience waterfall behind that moment still picks which paywall variant each user sees, so it stays A/B-testable by weight. Composable and custom-screen paywalls both work.

You wire nothing extra for it, but two facts decide whether it works at all:

- **It requires an ancestor `PaywallProvider`.** The step reads the paywall catalog. With no provider it logs the mount instruction and SKIPS the step — deliberately, because a paywall that structurally cannot appear must not trap the user in the funnel forever.
- **It is HARD-GATED: only a purchase advances.** A `dismiss` action on the paywall does nothing there. Note a Stripe Payment Link resolves `"pending"`, not `"purchased"`, and pending does **not** advance — so a Stripe paywall on such a step needs an `onPending` branch, or the user has no way forward.

The same skip-rather-than-trap rule covers a mis-typed moment key, an unpublished paywall, a moment whose audiences matched nothing, and an unregistered custom screen. Each logs what was wrong and what was available.

### Only if you must supply your own modal

`usePaywallHost()` (from the headless package) is the seam for a host that cannot use the bundled Modal — a custom transition, a non-Modal container. Taking it on means taking on both invariants below yourself; `PaywallHost` already satisfies them.

```tsx
import { usePaywallHost } from "@rocapine/react-native-onboarding";

const { activePaywall, complete, acknowledgePresentation, customActions } = usePaywallHost();
// …render activePaywall.elements through your own ScreenRenderer,
// call acknowledgePresentation once it is on screen, complete() exactly once.
```

**`acknowledgePresentation` is not optional.** iOS refuses to present over an already-presenting view controller — another Modal, a `presentation: "modal"` route, a StoreKit alert. Without the acknowledgement the SDK cannot tell "shown" from "silently refused", and one refused presentation would leave `activeMoment` set for the life of the process, making every later `present()` resolve `"already-presenting"` with no error and no log. The acknowledgement is what lets it recover.

**`complete` must be called exactly once per presentation**, or the `present()` promise never settles.

## Set user properties (targeting)

Requires **1.74.0 or later**. Which paywall a moment serves is decided by its audience waterfall, evaluated against a `key: value` map of user properties. Wire this up whenever the project has more than one audience — without it every user matches the catch-all.

```tsx
import { userProperties } from "@rocapine/react-native-onboarding";

// From anywhere — a singleton, no hook and no provider needed.
userProperties.set({ plan: "free", daysSinceInstall: 3 });
userProperties.reset();  // on logout
```

- `set` **merges**, so independent writers (auth, analytics) don't clobber each other. `null` deletes a key.
- Values are `string | number | boolean` and reach filters as strings. A filter comparing against a **number** coerces correctly; one comparing against a **string** is lexicographic, so `"10" > "9"` is false.
- **Properties persist** and are hydrated before the first catalog fetch, so a returning user is targeted correctly on the first launch-frame. A first-ever install matches the catch-all, then refetches on the first `set` — call `set` before mounting the provider if that matters.
- These names are refused (the SDK puts them on the querystring itself): `projectId`, `platform`, `appVersion`, `draft`, `locale`, `omitNulls`, `moment`, `now`.

## Present one

```tsx
import { usePaywall } from "@rocapine/react-native-onboarding";

const { present, isReady, catalogStatus } = usePaywall();

const result = await present("onboarding_end");
// { status: "purchased" | "dismissed" | "cancelled" | "error", reason?, activeMoment? }
```

`present()` **never throws** — it resolves `{ status: "error" }` with a `reason` you can switch on exhaustively. The ones that mean *your* wiring:

| `reason` | What to do |
|---|---|
| `unknown-moment` | the moment key does not exist in this project's catalog |
| `already-presenting` | a paywall is already up; `activeMoment` names which |
| `host-never-presented` | the platform refused. With `PaywallHost` this means something else was already presenting; with your own modal, that you never called `acknowledgePresentation` |
| `parse-error` | authored data is invalid — fix it in the studio, the app cannot |
| `render-error` | the element tree threw |
| `paywall-disappeared` | a studio publish removed the moment mid-presentation |

Gate a "fall back to another engine" decision on `catalogStatus === "ready"`, **not** on `catalog !== null`. A catalog served from disk while a fresh fetch is in flight reports `"revalidating"`, and a moment missing from it may simply not have arrived yet.

## Or gate a feature: `register`

Requires **1.74.0 or later**.

`present` is the low-level call: it tells you how the paywall closed and leaves you to act on it. `register` is the one to reach for when the paywall exists to unlock *something* — it decides, presents if needed, and runs your feature only if the user bought.

```tsx
const { register } = usePaywall();

await register("unlock_stats", () => router.push("/stats"));
```

| Situation | What happens | `reason` |
|---|---|---|
| The moment has a paywall | presented; feature runs **only** on a purchase | `purchased` / `not-purchased` |
| The moment has no paywall | feature runs immediately | `no-paywall` |
| No catalog reachable | feature runs, with a warning | `catalog-unavailable` |
| A paywall is already showing | feature withheld, live paywall untouched | `not-purchased` |

**Which to use:** `register` when a paywall guards a feature — it is the whole if/else, so you cannot forget a branch. `present` when the caller needs the outcome for something other than unlocking (analytics on dismissal, a downsell chain, deciding a route).

Three things to tell the user explicitly, because none is visible from the call site:

- **It fails open.** Offline, or still loading after `registerTimeoutMs` (default 3000), it runs the feature rather than blocking it — an offline launch must not make the app's features silently dead. Read `reason: "catalog-unavailable"` off the result to measure how often that happens; if it is not near zero, that is revenue.
- **There is no entitlement check.** `register` gates on the moment alone. Exclude existing subscribers by setting a user property and authoring an audience filter on it — `userProperties.set({ plan: "pro" })`, audience `plan != "pro"`. Do NOT expect the SDK to know they already paid.
- **A Stripe-billed paywall never runs the feature.** A Payment Link's entitlement arrives out-of-band through RevenueCat, so the presentation never reports `"purchased"`. Grant access from the RevenueCat webhook. `register` warns when it presents one.

## Verification

1. `npx tsc --noEmit` — clean.
2. Launch and confirm the catalog fetch fires **at mount**, before any tap (network tab or the `get-paywalls` request).
3. `present("<a real moment key>")` shows the paywall, and resolves rather than sitting pending — a `present()` that never settles is the acknowledgement failing.
4. Dismiss it and confirm `present()` resolves and a second `present()` still works — that proves `complete` is wired.
5. On a Stripe paywall: tap buy and confirm the browser opens with `client_reference_id` in the URL. If `purchase()` returns an error instead, `clientReferenceId` resolved null.

## Don'ts

- **Don't** mount two `PaywallProvider`s, or mount one per screen. One, at the root.
- **Don't** call `present()` before `isReady` and expect no spinner — that flag is what "no spinner" means.
- **Don't** hand-roll the modal without wiring `acknowledgePresentation`. `PaywallHost` does it for you; skip it in a custom host and the failure is silent and permanent.
- **Don't** render a price you computed yourself. Interpolate `{{product.<key>.price}}` so the store's own formatting and currency are used.
- **Don't** treat `purchase()` returning `"pending"` as failure. On the Stripe path it is the normal outcome.
- **Don't** hardcode moment keys the studio does not have. `unknown-moment` is the single most common wiring bug.

## Wire `onPending` — a Stripe buy button needs it

**A Stripe Payment Link purchase always resolves `"pending"`**, never `"purchased"`: `purchase()` opens the link, the browser takes over, and nothing is confirmed yet. So the authored buy button must declare `onPending`, or tapping it runs nothing and the user returns from Safari to an untouched screen.

```json
{
  "type": "purchase",
  "product": "{{plan}}",
  "onPending": [{ "type": "dismiss" }],
  "onError":   [{ "type": "custom", "function": "showPurchaseError" }]
}
```

`onSuccess` still fires for a store purchase, so the same button works on both billing paths — declare both.

**Never grant access from `onPending`.** Pending means unconfirmed: the user may never pay. Use it to close the paywall or show a "finish in your browser" state, and read entitlement state (RevenueCat) to decide what the user actually has.

For the same reason `present()` resolves `"dismissed"` rather than `"purchased"` on this path. That is honest, not a bug — treat entitlement state as the source of truth for access, and the `present()` result only as "how the paywall closed".
