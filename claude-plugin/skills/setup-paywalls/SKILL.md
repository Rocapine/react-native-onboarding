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
  <PaywallModalHost />   {/* see "Host the modal" */}
</PaywallProvider>
```

Props worth knowing:

| Prop | Why |
|---|---|
| `client` | required |
| `productProvider` | the store adapter (App Store / Play) |
| `stripeProductProvider` | the Stripe adapter, if any paywall uses `billing: "stripe"` |
| `locale` | overrides the device locale for authored copy |
| `customAudienceParams` | extra values the studio's audience filters can match on |
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

`PaywallProvider` decides *what* to present; the host decides *how*. Read `usePaywallHost()` and render `PaywallHost` inside whatever modal your app uses.

```tsx
import { usePaywallHost } from "@rocapine/react-native-onboarding";
import { PaywallHost } from "@rocapine/react-native-onboarding-ui";

function PaywallModalHost() {
  const { activePaywall, complete, acknowledgePresentation, customActions } = usePaywallHost();

  return (
    <Modal
      visible={activePaywall !== null}
      onShow={acknowledgePresentation}          // REQUIRED — see below
      onRequestClose={() => complete({ status: "dismissed" })}
    >
      {activePaywall && (
        <PaywallHost
          elements={activePaywall.elements as any}
          complete={complete}
          customActions={customActions}
        />
      )}
    </Modal>
  );
}
```

**`acknowledgePresentation` is not optional.** iOS refuses to present over an already-presenting view controller — another Modal, a `presentation: "modal"` route, a StoreKit alert. Without the acknowledgement the SDK cannot tell "shown" from "silently refused", and one refused presentation would leave `activeMoment` set for the life of the process, making every later `present()` resolve `"already-presenting"` with no error and no log. The acknowledgement is what lets it recover.

**`complete` must be called exactly once per presentation**, or the `present()` promise never settles.

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
| `host-never-presented` | the platform refused; you probably did not call `acknowledgePresentation` |
| `parse-error` | authored data is invalid — fix it in the studio, the app cannot |
| `render-error` | the element tree threw |
| `paywall-disappeared` | a studio publish removed the moment mid-presentation |

Gate a "fall back to another engine" decision on `catalogStatus === "ready"`, **not** on `catalog !== null`. A catalog served from disk while a fresh fetch is in flight reports `"revalidating"`, and a moment missing from it may simply not have arrived yet.

## Verification

1. `npx tsc --noEmit` — clean.
2. Launch and confirm the catalog fetch fires **at mount**, before any tap (network tab or the `get-paywalls` request).
3. `present("<a real moment key>")` shows the paywall; the modal's `onShow` fires.
4. Dismiss it and confirm `present()` resolves and a second `present()` still works — that proves `complete` is wired.
5. On a Stripe paywall: tap buy and confirm the browser opens with `client_reference_id` in the URL. If `purchase()` returns an error instead, `clientReferenceId` resolved null.

## Don'ts

- **Don't** mount two `PaywallProvider`s, or mount one per screen. One, at the root.
- **Don't** call `present()` before `isReady` and expect no spinner — that flag is what "no spinner" means.
- **Don't** skip `acknowledgePresentation`. See above; the failure is silent and permanent.
- **Don't** render a price you computed yourself. Interpolate `{{product.<key>.price}}` so the store's own formatting and currency are used.
- **Don't** treat `purchase()` returning `"pending"` as failure. On the Stripe path it is the normal outcome.
- **Don't** hardcode moment keys the studio does not have. `unknown-moment` is the single most common wiring bug.

## Known limitation (1.70.0)

**A `"pending"` purchase result runs no ButtonActions.** `onSuccess` and `onError` are not dispatched for it, so on the Stripe path an authored buy button cannot dismiss the paywall or navigate — the user returns from the browser to the same untouched screen, and `present()` resolves `"dismissed"` even for a completed purchase.

Until that is closed, a Stripe paywall needs the host to drive what happens next: dismiss it yourself when the app returns to the foreground, and read entitlement state rather than the `present()` result to decide what the user now has access to.
