---
name: migrate-from-superwall
description: Moves an Expo / React Native app's paywalls from Superwall to Onboarding Studio native paywalls — inventories Superwall placements, asks which library will handle purchases (keep Superwall, or switch to RevenueCat), wires the matching `ProductProvider`, maps placements to Studio moments, rolls out behind a Superwall fallback, then removes what is left. Use when the user says "migrate from Superwall", "replace Superwall paywalls", "move our paywalls to the Studio", "native paywalls instead of Superwall", "keep Superwall only for purchases", or the app calls `Superwall.shared.register` and wants Studio paywalls.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: [project-id?]
---

# Migrate from Superwall
Superwall does three jobs in a typical app: it **decides** which paywall a user sees (campaigns), **shows** it, and often **buys** (StoreKit / Play). Onboarding Studio takes over the first two — moments, audiences and weighted variants decide; `PaywallHost` shows. The third job, buying, is a choice the user makes at the start of this skill, because it decides what is risky.

`setup-paywalls` is the reference for every piece of SDK wiring. This skill is the migration around it: what to inventory, the purchase decision, the order of operations, the fallback, and what to delete at the end.

## When invoked
1. **Inspect the target app** with `../onboarding-best-practices/references/inspect-target-app.md`, then the Superwall inventory below.
2. **Run `check-sdk-version`.** This migration needs `@rocapine/react-native-onboarding` and `-ui` **>= 1.78.0** (moments, `register`, user properties, sticky assignment). Propose the upgrade and wait.
3. **Ask the purchase question** (next section) and wait for the answer. Do not write code before it.

## 1. Inventory Superwall
Grep the app and write the results down for the user before changing anything:

| Find | Grep for | Why it matters |
| --- | --- | --- |
| Which package | `@superwall/react-native-superwall`, `expo-superwall` in `package.json` | Decides whether "keep Superwall as buyer" is possible (see below) |
| Every placement | `register(`, `registerPlacement`, `getPresentationResult` | Each becomes a Studio moment |
| Who buys today | `purchaseController` in `Superwall.configure`; `purchasesAreCompletedBy` in `Purchases.configure` | No controller = Superwall buys. `MY_APP` = RevenueCat only observes |
| Who reads access | `subscriptionStatus`, `setSubscriptionStatus`, `getEntitlements`, `customerInfo.entitlements` | The entitlement source of truth after migration |
| Analytics hung on Superwall | `SuperwallDelegate`, `handleSuperwallEvent`, `transactionComplete`, `PaywallPresentationHandler` | These events stop when Superwall stops presenting. They move to the `observer` |
| Targeting data | `setUserAttributes` | Moves to `OnboardingStudio.setUserProperties` |
| Other store libraries | `react-native-purchases`, `expo-iap`, `react-native-iap` | Two libraries finishing the same transactions is the bug to avoid |

## 2. Ask: which library will handle purchases?
Ask the user this question, with the inventory in front of them, and recommend based on what you found:

> **Which library should buy and finish transactions once paywalls come from the Studio?**
> - **A. Keep Superwall** — Superwall keeps buying exactly as today; it just stops choosing and showing paywalls. Needs the `expo-superwall` package (Expo SDK 53+).
> - **B. RevenueCat** — RevenueCat becomes the buyer for every paywall, Superwall's included until it is removed.

How to recommend:

| Situation | Recommend | Why |
| --- | --- | --- |
| Superwall buys today, RevenueCat absent or `MY_APP` | **A** | Purchase path unchanged: no buyer switch, nothing new can leave transactions unfinished |
| RevenueCat already buys (Superwall has a RevenueCat `PurchaseController`, or RevenueCat completes purchases) | **B** | RevenueCat already owns the transactions; Superwall adds nothing to buying |
| Goal is to remove Superwall entirely in this project | **B** | A keeps a Superwall dependency and contract alive |
| Expo SDK < 53, or a bare RN app that cannot take `expo-superwall` | **B** | A's `purchase()` exists only in `expo-superwall`; the legacy `@superwall/react-native-superwall` (2.x) cannot buy outside its own paywalls |

Whatever the answer, the rule is the same: **exactly one library finishes transactions.** Never add `expoIapProductProvider` (or any second store library) next to the chosen buyer.

Then follow **3A** or **3B**, never both.

## 3A. Keep Superwall as the buyer
The Studio decides and shows; when the user taps buy, the paywall calls `Superwall.purchase(productId)`. Superwall buys and finishes the transaction as today, RevenueCat (if present) keeps observing, and Superwall's `transactionComplete` delegate event should keep firing.

### Move to `expo-superwall`
Only if the app is still on `@superwall/react-native-superwall`. Follow Superwall's compat guide (`expo-superwall/compat`, which mirrors the legacy API): swap the package, change imports to `expo-superwall/compat`, rebuild the dev client. Check `register`, `identify`, `setUserAttributes`, the delegate and the presentation handler still compile and fire. Ship this on its own before any Studio paywall — it is a native-module change, and mixing it with the paywall switch hides which one broke.

### The product provider
Use the SDK's `superwallProductProvider` (**SDK >= 1.81.0**; on an older SDK, upgrade first via `check-sdk-version`). It wraps `Superwall.products` / `Superwall.purchase` / `Superwall.shared.restorePurchases` behind the SDK's `ProductProvider`, and loads `expo-superwall/compat` itself:

```tsx
import { PaywallProvider, superwallProductProvider } from "@rocapine/react-native-onboarding";

const provider = superwallProductProvider(); // module scope: stable

<PaywallProvider productProvider={provider}>
  <App />
  <PaywallHost />
</PaywallProvider>
```

If `expo-superwall` is missing, the provider throws a clear error on first use rather than at import. If the app imports the compat module itself, pass it: `superwallProductProvider(Superwall)`.

Things to tell the user explicitly:

- **`pending` is reachable.** `Superwall.purchase` resolves `pending` for iOS Ask to Buy and Play slow payments. Every authored buy button needs an `onPending` branch (e.g. `dismiss`), or the user taps buy and nothing happens. Never grant access from it. See `setup-paywalls` → "Wire `onPending`".
- **The purchase result carries no entitlements.** Access comes from the existing source of truth: RevenueCat `CustomerInfo` if present, else `Superwall.shared.getEntitlements()` / subscription status.
- **Do not configure a `purchaseController`** in this path. With one, `Superwall.purchase` routes back through your controller (a JS → native → JS round trip) and you are effectively on path B.
- **RevenueCat stays exactly as it is** (observer, `MY_APP`). Do not flip it: nothing in this path makes RevenueCat buy.

Sandbox checks before rollout, on iOS AND Android:
1. Each Studio product shows the store's price, period and trial on the native paywall — this verifies the adapter's period and trial mapping against real `ProductResponse` values from your store setup.
2. Android subscriptions with several base plans buy the right plan. If not, store the full `productId:basePlanId[:offerId]` form as the Studio product's Android id; `Superwall.purchase` accepts it.
3. A purchase on a Studio paywall still produces Superwall's `transactionComplete` event (and whatever analytics hang off it). If it does not, move those events to the `observer` (section 5).

## 3B. RevenueCat as the buyer
The Studio decides and shows; `revenueCatProductProvider()` buys. Superwall, while it still serves fallback traffic, must stop buying too — otherwise two libraries finish transactions.

Do this **first, alone, and test it in sandbox** before any Studio paywall ships:

1. **RevenueCat completes purchases.** Remove `purchasesAreCompletedBy: { type: MY_APP, … }` from `Purchases.configure` (the default is RevenueCat). Leaving `MY_APP` while RevenueCat buys is the worst bug available here: the user is charged, nothing finishes the transaction, iOS re-delivers it every launch, and **Google Play auto-refunds any purchase not acknowledged within 3 days** — lost revenue with every purchase looking successful.
2. **Superwall buys through RevenueCat.** Pass a `PurchaseController` to `Superwall.configure({ apiKey, purchaseController })` whose `purchaseFromAppStore` / `purchaseFromGooglePlay` / `restorePurchases` call `Purchases`. Superwall publishes a reference implementation, `RCPurchaseController`, in its React Native repo's `example/` — adapt it rather than writing one.
3. **Feed Superwall's subscription status from RevenueCat.** With a controller, Superwall no longer knows who is subscribed. In `Purchases.addCustomerInfoUpdateListener`, call `Superwall.shared.setSubscriptionStatus(...)` with the active entitlement ids. Skipped, Superwall thinks every user is inactive and shows paywalls to paying subscribers.
4. **Configure order:** `Purchases.configure` before `Superwall.configure`.
5. Then mount `<PaywallProvider productProvider={revenueCatProductProvider()}>` per `setup-paywalls`, and key sticky assignment on the RevenueCat id: `OnboardingStudio.init({ projectId, assignmentId: () => Purchases.getAppUserID() })`.

Notes:
- `revenueCatProductProvider` never resolves `pending`, so `onPending` is optional here.
- Sandbox-check that Superwall's `transactionComplete` still fires when the controller does the purchase; if not, move those events to the `observer` or to the RevenueCat listener.
- Android: same base-plan check as 3A — store `productId:basePlanId` in the Studio if the first match is the wrong plan.

## 4. Studio side
Use the Onboarding Studio MCP if connected (tools in parentheses), else the Studio UI. In this order:

1. **Products** (`upsert_project_product`): one per store product, with **both** `iosProductId` and `androidProductId`. A ref missing the current platform's id is dropped silently — blank prices, dead buy button.
2. **Paywalls** (`create_paywall`, then `publish_paywall`): an element tree, or `renderMode: "custom"` + `customScreenId` + `customPayload` to keep a hand-built native screen. A custom screen calls the chosen buyer itself and must `complete({ status: "purchased", transaction })`.
3. **Moments** (`create_moment`): **reuse each Superwall placement name as the moment key** so call sites stay readable during the switch.
4. **Audiences** (`create_moment_audience`) and **variants** (`set_moment_variants`, weights sum to 100 per audience). During rollout give each moment a **test audience only, with no catch-all** — see section 6.

## 5. App side
Wire per `setup-paywalls` (one `PaywallProvider` at the root, `<PaywallHost />` as a sibling, custom screens on the provider), with the provider from 3A or 3B. Then:

1. **One fallback helper replaces every `register` / `registerPlacement` call:**
   ```ts
   const { register, catalog, catalogStatus } = usePaywall();
   const gate = (moment: string, feature: () => void) =>
     catalogStatus === "ready" && catalog?.paywalls[moment]
       ? register(moment, feature)
       : legacyRegisterPlacement(moment, feature); // the old Superwall call
   ```
   `register` alone never falls back: it runs the feature immediately on `no-paywall` and on `catalog-unavailable`. The fallback deliberately covers a catalog that is not ready yet — falling back only on "ready and absent" would hand an offline user the feature for free. Never decide on `catalog !== null` (a cached catalog may still be refreshing).
2. **Subscribers:** `register` does not check entitlements. Set `OnboardingStudio.setUserProperty("plan", "pro")` when access is granted (and `"free"` when it lapses), and add a filter on it to each moment's audiences. This replaces Superwall's "don't show to subscribers" behaviour.
3. **Targeting:** move `setUserAttributes` values that audiences filter on to `OnboardingStudio.setUserProperties`. Keep the Superwall call while Superwall still serves fallback traffic.
4. **Analytics:** pass an `observer` to `PaywallProvider` (rocalytics' paywall tracker plugs in directly) and re-emit the event names the Superwall presentation handler emitted (`paywall_presented` / `dismissed`, …), so dashboards keep working. For PURCHASE events, know what `end(outcome)` carries:
   - **Element-tree paywalls:** `transaction` has only `productId`. The SDK never sees store transaction ids, because `ProductProvider.purchase` returns none. Keep taking trial / direct-subscription events and transaction ids from the buyer itself: Superwall's `transactionComplete` (path A, sandbox-check it still fires) or RevenueCat's customer-info listener (path B).
   - **Custom-screen paywalls:** `originalTransactionIdentifier` (iOS) and `purchaseToken` (Android) are present only if the screen passes them: `complete({ status: "purchased", transaction })`.
   - A resolved product's `trial` is set only for a FREE trial (a paid intro offer has none), so it is safe for "trial vs direct" only when every product's intro offer is free.
5. **Screenshots:** run `setup-paywall-screenshots` so debug builds upload each paywall to the Studio — the only preview a custom-screen paywall gets.

## 6. Roll out, then remove Superwall
1. **Ship** with each moment serving the Studio paywall to a **test audience only** (e.g. a user property set on internal builds) and **no catch-all**. A moment with no matching audience is absent from the catalog, so everyone else falls back to Superwall through the helper.
2. **Widen** the test audience; compare conversion per variant in the Studio against Superwall.
3. **Add the catch-all** audience to each moment once the Studio paywall wins. Superwall now serves nobody.
4. **Remove** the Superwall presentation code: the fallback branch, campaigns, `PaywallPresentationHandler`, the delegate events now covered by the observer.
5. **Path A:** Superwall stays installed as the buyer — say so; removing it later means doing 3B then. **Path B:** remove the Superwall SDK and its `PurchaseController` entirely; RevenueCat already buys.

## Verification
Per build, on a sandbox device:
1. `npx tsc --noEmit` clean.
2. The `get-paywalls` request fires at app mount.
3. A user in the test audience sees the Studio paywall; a user outside it sees the Superwall paywall (fallback works).
4. `present()` / `register` resolves on dismiss, and a second call still opens.
5. A sandbox purchase on the Studio paywall grants access through the entitlement source of truth, and the purchase/trial analytics events arrive.
6. Restore on a Studio paywall restores access.
7. Offline launch: the gated feature falls back to Superwall rather than opening for free.

## Don'ts
- **Don't** let two libraries finish transactions: one buyer, chosen in section 2.
- **Don't** keep RevenueCat on `MY_APP` once it buys (path B).
- **Don't** pass Superwall a `PurchaseController` on path A, or skip the subscription-status sync on path B.
- **Don't** add a catch-all audience before the rollout is done — it turns the fallback off for everyone at once.
- **Don't** grant access from `onPending` or from `present()`'s result; read the entitlement source of truth.
- **Don't** mix the `expo-superwall` package swap and the Studio paywall switch in one release.
