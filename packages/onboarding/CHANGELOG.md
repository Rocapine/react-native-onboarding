# Changelog

All notable changes to `@rocapine/react-native-onboarding` are documented here.

---

## [Unreleased]

---

## [1.74.1] - 2026-09-02

### Fixed

- **A user-property write during an onboarding no longer blanks the app.**
  `OnboardingDataGate` followed the user-property store reactively: a
  `setUserProperty` mid-flow changed the merged audience params, the React Query
  key followed them, the query answered `data: undefined` for the never-seen key,
  and the gate rendered `null` — unmounting the **entire** subtree under the
  provider (in hosts that wrap the app: router reset, every screen's state lost),
  refetching `get-onboarding-steps`, and remounting. The only workaround was to
  seed every property before the provider mounted.

  The rule now is: **audience resolution happens at serve time, and a served
  payload is frozen for that presentation.** `OnboardingProvider` resolves the
  effective params **once**, from the first ready snapshot of the store, and
  pins them for the lifetime of the mount (`useAudienceParams`); the data gate
  just fetches what it is handed. A property written during the flow — or a change to
  the `customAudienceParams` prop — does not re-key, refetch or swap the
  onboarding; it applies to the **next** serve (next mount, next launch). Hosts
  can write a property the moment they compute it, even mid-onboarding. The
  corollary: anything the current serve must target on has to be set before
  the provider mounts. `reset()` likewise clears for the next serve.

  `PaywallProvider` is deliberately unchanged: a paywall is served at
  `register(moment)`, so it is right that its catalog follows the store until
  then, and it never blanks while refetching.

  The escape hatch is intact: `client.clearCache()` plus invalidating
  `["onboardingQuestions", …]` still refetches — the same query, under the pinned
  audience, without an unmount. Re-targeting with the current properties is a
  new serve: remount the provider — at a flow boundary, since a remount is the
  full teardown.

- **`useOnboardingStep` / `useOnboardingStart` now build the query the gate
  served.** They built their own `useSuspenseQuery` from the **raw**
  `customAudienceParams` prop, while the gate (since 1.74.0) merged the store over
  it — so with a non-empty store the two keys differed: a second fetch, resolved
  **without** the user's properties, and that was the payload the screens
  rendered. `OnboardingProvider` now resolves the params once and hands that
  same value to both the data gate and the `OnboardingProgressContext` the hooks
  already read, so both build the same query and there is exactly one fetch.
  The hooks themselves are unchanged.

### Changed

- **Tests** — the headless package can now render React in tests (`react-dom` +
  `jsdom` dev dependencies, `*.test.tsx` excluded from `tsc`). The provider suite
  renders the real `OnboardingProvider` against a fake client.

---

## [1.74.0] - 2026-08-27

### Added

- **`OnboardingStudio`** — the SDK's front door, in the shape of the SDKs it sits
  alongside (`Superwall.configure`, `Purchases.configure`, `amplitude.init`): one
  module-level object owning configuration and user identity.

  ```ts
  OnboardingStudio.init({ projectId: "…", appVersion: "1.0.0" });  // returns the client

  OnboardingStudio.setUserProperty("plan", "free");
  OnboardingStudio.setUserProperties({ daysSinceInstall: 3 });     // merges
  OnboardingStudio.setUserProperty("plan", null);                  // deletes
  OnboardingStudio.removeUserProperty("plan");
  OnboardingStudio.getUserProperties();
  OnboardingStudio.reset();                                        // forget the user
  OnboardingStudio.getClient() / isInitialized();

  const { properties, status } = useUserProperties();              // React read path
  ```

  `init` is idempotent for an unchanged config — Fast Refresh re-runs module
  scope, and rebuilding the client there would orphan the one the providers
  already hold. A genuinely *changed* config replaces the client and warns.

  `reset()` clears user properties, in memory and on disk, and deliberately
  leaves the configuration and the payload cache alone: logging out should forget
  who someone is, not force a refetch of content that has not changed.
  `getClient()?.clearCache()` is there for both.

  User properties feed audience resolution for **both** onboardings and paywalls.
  Values are `string | number | boolean`; they persist to AsyncStorage and are
  hydrated **before the first fetch**, so a returning user is targeted correctly
  on the first launch-frame with no host code. A first-ever install has nothing
  to hydrate — seed it with `init({ …, userProperties: { plan: "free" } })`,
  which runs before anything renders, and even that launch is targeted correctly.

  `register`/`present` deliberately do **not** live on this object, unlike
  Superwall's `register`: presenting needs the mounted provider's catalog and
  presentation state, so they stay on `usePaywall()`, where a call cannot be made
  before a provider exists.

- **`client` is now optional on both providers.** Omit it and they use the client
  `init()` built; pass one and it still wins, so every existing host is
  unaffected. With neither, the two providers behave differently on purpose:
  `OnboardingProvider` **throws** (an onboarding with no client has nothing to
  render, and a host `ErrorBoundary` catches one screen) while `PaywallProvider`
  **warns and renders its children with paywalls inert** — it wraps the whole
  app, so throwing would take down every screen over a missing paywall client.

  Eight names are refused with a warning — `projectId`, `platform`, `appVersion`,
  `draft`, `locale`, `omitNulls`, `moment`, `now`. The last two are server-owned;
  the other six would **break the request outright**, because the client appends
  user params before its own, `URLSearchParams` permits duplicates, and the two
  server-side readers disagree about which wins (`.get()` takes the first — the
  user's value — while `Object.fromEntries` takes the last).

- **`register(moment, feature)`** on `usePaywall()` — gate a feature on a moment.
  Runs the feature immediately when the moment has no paywall, otherwise presents
  it and runs the feature **only** on a purchase. Resolves
  `{ ran, presented, reason, outcome? }`.

  It gates on the moment **alone** — there is no entitlement check. Exclude
  existing subscribers with a user property plus an audience filter.

  It **fails open**: with no reachable catalog it runs the feature and warns,
  because failing closed would make gated features silently dead on an offline
  launch. `reason: "catalog-unavailable"` is how a host measures that rate.

  A **Stripe**-billed paywall never runs the feature even on a successful
  checkout — a Payment Link's entitlement arrives out-of-band through RevenueCat,
  so the presentation never reports `"purchased"`. `register` warns when it
  presents one.

- **`registerTimeoutMs`** on `PaywallProvider` (default `3000`) — how long
  `register` waits for the catalog to settle before deciding without it.

- **`resolveRegisterDecision` / `shouldRunFeature`** are exported: they are pure,
  so a host building its own gating on `catalog` can reuse the SDK's exact rules
  rather than reimplement them slightly differently.

### Changed

- **Both providers now merge the store over `customAudienceParams`**, store-wins
  per key, and hold their query until the store hydrates. The prop is neither
  deprecated nor removed — it becomes the *static* baseline (build-time facts)
  while the store carries what changes at runtime, so existing hosts are
  untouched. One consequence worth naming: one store now feeds **both**
  waterfalls, so an onboarding audience and a paywall audience can no longer
  disagree about the same user, which two independent props always allowed.

### Fixed

- **The AsyncStorage cache keys are now scoped by audience params.** The
  react-query key always was; the disk key was a bare constant, so a cache-first
  read could serve a payload resolved under *different* params — non-null, and so
  indistinguishable from a correct one. Observed in production: an audience gated
  on `hoursSinceOnboardingPaywall >= 44` was served the pre-threshold catalog on
  the launch where the user first became eligible, so the arm under test lost
  exactly the launch that mattered. Rare while params were a static prop;
  mutable properties would have made it the normal path.

  An empty params hash yields the legacy key byte-for-byte, so existing installs
  keep their cache. This is also what makes `catalogStatus: "revalidating"`
  trustworthy — a served catalog now always matches the current params — which
  `register`'s decision relies on.

- **`clearCache()` now clears every params variant**, via a `getAllKeys()` prefix
  scan rather than naming two keys it can no longer predict. It previously missed
  every key but the current one. It deliberately does **not** clear user
  properties: clearing a payload cache must not forget who the user is.

---

## [1.73.0] - 2026-08-27

### Added

- **`PaywallStepType`** — a step that IS a paywall. `payload` is one field, a
  `moments.key`:

  ```json
  { "type": "Paywall", "payload": { "moment": "onboarding_end" } }
  ```

  Rendered inline, in flow position, by the UI package. The whole thing needed
  **no wire change**: `get-paywalls` already returns the catalog keyed by
  moment with the audience waterfall applied, so resolving the step is a
  lookup — and targeting plus weighted A/B therefore work inside an onboarding
  with no new machinery. Composable and custom-screen paywalls both work,
  because `renderMode` is a property of the paywall the moment resolved to, not
  of the step.

  Deliberately not a paywall id: that would bypass the waterfall, so
  A/B-testing a paywall inside an onboarding would mean duplicating the whole
  onboarding.

- **`PaywallProvider` accepts `customScreens`**, and `usePaywall()` /
  `usePaywallHost()` expose it. This is now **the canonical place** to register
  custom paywall screens, because two things render them: `PaywallHost`'s Modal
  and the inline `Paywall` step, which never goes through `PaywallHost`.

  `PaywallHost`'s own `customScreens` prop (1.72.0) still works and **wins where
  passed**, so existing integrations are unaffected — but it is invisible to a
  `Paywall` step, so prefer the provider.

- **`CustomPaywallScreenProps` / `CustomPaywallScreens` are now exported from
  this package.** They moved here from `-ui` because the registry they type is
  published on `PaywallProvider`. The UI package re-exports both names, so its
  deep-import path resolves unchanged.

- **`usePaywall().isProviderMounted`** — whether a real `PaywallProvider` is
  above the consumer. Needed by anything that renders a spinner while the
  catalog loads: with no provider, `catalogStatus` reports `"loading"` and
  nothing ever arrives, so such a consumer would spin forever. Deliberately NOT
  a new `CatalogStatus` member — widening that union would break every host
  switching exhaustively over it, and "no provider" is not a catalog state.

---

## [1.72.0] - 2026-08-27

### Added

- **`Paywall.renderMode`, `.customScreenId` and `.customPayload`** — a paywall
  can now be a host-rendered custom screen instead of an authored element tree.
  `renderMode: "custom"` means the HOST draws it: `customScreenId` names a
  screen registered on `PaywallHost` (UI package), and `customPayload` is a map
  of slot key to per-platform store product id
  (`{ monthly: { ios, android } }`) — the one thing a native paywall cannot get
  from anywhere else, since the moment waterfall picked *this* variant and which
  products it offers is an authoring decision.

  All three are **optional, and an absent `renderMode` reads as `"elements"`**.
  Not because the studio omits them — it always sends a value — but because a
  device on this SDK can be talking to an older `get-paywalls` that predates the
  fields, and on that pairing every existing paywall must behave exactly as
  before.

  A property of the PAYWALL rather than the moment, the same as `billing`: one
  moment audience can weight an element-tree variant against a native-screen
  variant and ramp the change as an A/B test.

- **`PaywallCustomPayload`** — exported so a host's custom screen can type the
  product map it receives without restating the shape.

- **`PresentErrorReason: "unknown-custom-screen"`** — a `renderMode: "custom"`
  paywall named a screen this host did not register (or named none at all), so
  nothing could be rendered and the Modal was never opened. Deliberately NOT
  folded into `"parse-error"`: that one is a CMS data bug the studio author must
  fix, this is a wiring bug the app must fix. **Hosts switching exhaustively on
  `PresentErrorReason` must widen that switch.**

### Changed

- **No store products are resolved for a custom paywall.**
  `collectProductRefs` does not walk `customPayload`, so such a paywall issues
  no store round-trip at all and its screen receives product ids rather than
  prices. A native paywall asks the store for its own display prices, which is
  precisely what it does not need the studio for.

---

## [1.71.0] - 2026-08-26

### Fixed

- **`expoIapProductProvider` was broken against expo-iap 5.x** — every product
  silently failed to resolve. Five separate API mismatches, none of which any
  test exercised (the only existing coverage asserted that the adapter fails
  politely when expo-iap is *absent*):

  - `getProducts(skus)` **no longer exists** in expo-iap 5.x; it is
    `fetchProducts({ skus, type })`, an object argument. The old call threw
    `M.getProducts is not a function`. The legacy name is still used as a
    fallback so a host pinned to expo-iap ≤4 keeps working.
  - **`initConnection()` was never called.** Nothing opens the store connection
    implicitly — `useIAP` does it for hook consumers, but an adapter is not a
    hook — so every query failed. Now opened once per provider and cleared on
    failure, so a first call during a network outage does not poison the
    provider for the rest of the session.
  - **`periodIso` was always `null`,** because expo-iap 5.x publishes no
    `subscriptionPeriodISO`: iOS splits it into `subscriptionPeriodUnitIOS` +
    `subscriptionPeriodNumberIOS`, and Android buries it in the first pricing
    phase of the first subscription offer. This was the most damaging one —
    `deriveProductFields` computes `pricePerDay` / `pricePerWeek` /
    `pricePerMonth` / `pricePerYear` and `savingsPct` from `periodIso` alone, so
    a null did not degrade them, it **removed** them, and an unknown variable
    interpolates to EMPTY rather than to a literal. A per-week-framed paywall
    silently lost its headline number.
  - **`requestPurchase` was sent the wrong shape.** 5.x wants
    `{ request: { ios, android }, type }`; the old flat `{ request: { sku } }`
    reached neither platform branch, so StoreKit received an undefined sku.
    `type` (`"in-app"` / `"subs"`) is now derived from the store product.
  - **`finishTransaction` was never called,** so StoreKit re-delivered every
    transaction on each launch.

### Changed

- **`expoIapProductProvider.purchase()` resolves `"pending"` where it used to
  resolve `"purchased"`,** when `requestPurchase` resolves `null` — which is the
  normal expo-iap 5.x outcome, because the transaction is delivered to
  `purchaseUpdatedListener` instead. Reporting `"purchased"` there granted
  access for a purchase that had not completed and might still fail. Hosts whose
  buy button relies on `onSuccess` firing on this path must declare `onPending`
  (added below) — that is what it is for.

### Added

- `onPending?: ButtonAction[]` on `PurchaseButtonAction` (type + schema), mirroring
  `@rocapine/react-native-onboarding-ui`'s dispatcher. A `"pending"` result is
  unconfirmed, not successful — a Stripe Payment Link purchase always resolves it,
  and so now does an expo-iap purchase awaiting its listener.

---

## [1.70.0] - 2026-08-26

### Changed

- **BREAKING — `Paywall.placement` is now `Paywall.moment`.** `placement` was a
  column on `paywalls`; the addressable entity is now a `moment`, and the key a
  host passes to `present()` is `moments.key`. Same meaning, new name. Onboarding
  Studio already serves this shape, so a host on the old field reads `undefined`.
- **BREAKING — `audienceId` / `audienceName` moved from `PaywallCatalog.metadata`
  onto each `Paywall`.** Each moment now runs its own independent audience
  waterfall, so two entries in one response can legitimately have matched
  different audiences. A single catalog-level field could no longer describe
  that; keeping one would have been quietly wrong rather than merely imprecise.
- **BREAKING — the `ONBS-Audience-Id` response header is now `ONBS-Audience-Ids`,**
  a parallel array alongside `ONBS-Paywall-Ids`, because a response carries
  several moments and each resolves its own audience.

### Added

- **Stripe as a third billing path.** `ProductRef.stripe` carries a pre-created
  Stripe Payment Link plus the authored price, and the new
  `stripeLinkProductProvider` synthesises a `ResolvedProduct` from it with **no
  network call** — listing a Stripe price needs a secret key, and by design
  nobody holds one. `ResolvedProduct.store` gains `"stripe"`.
- `PaywallProvider` gains a `stripeProductProvider` prop. The catalog's product
  union is resolved through both providers and the runtime published is the one
  matching the presented paywall's `billing`, because the runtime is a single
  map keyed by product key — a `store` and a `stripe` paywall both declaring
  `yearly` would otherwise fight over `product.yearly.price`.
- `Paywall.billing` (`"store" | "stripe"`) on the wire type.
- `productRefIdentity`, now the single enumeration of `ProductRef`'s identity
  fields, replacing two hand-maintained copies that never failed loudly when
  stale.

### Fixed

- `PaywallProvider`'s doc comments no longer refer to `placement`.

### Notes on the Stripe path

- `purchase()` resolves `"pending"`, never `"purchased"` — the browser leaves
  the app and on web the JS context is destroyed. The entitlement arrives via
  RevenueCat's Stripe integration, matched on `client_reference_id`, which
  **must** be the RevenueCat App User ID. `purchase()` **fails closed** if that
  value is absent rather than taking money that can never be attributed;
  genuine anonymous checkout is an explicit `allowAnonymous` opt-in.
- **A `"pending"` result runs no ButtonActions** (`onSuccess`/`onError` are not
  dispatched), so an authored Stripe buy button cannot yet dismiss the paywall
  or navigate. Closing this needs an `onPending` action or a host callback and
  is the top follow-up — the Stripe path is not usable end to end until then.
- Authored prices are not reconciled with Stripe; a price changed in Stripe and
  not in the studio renders stale.

---

## [1.69.0] - 2026-08-21

### Added

- **`usePaywall().catalogStatus`** — `"loading" | "ready" | "revalidating" | "error"`, exported as `CatalogStatus`. `isReady` is a single boolean over at least three distinct situations (no catalog yet, a catalog whose products are still resolving, and a failed query — which also presents as `catalog === null`), so a host deciding "wait for the catalog" versus "fall back to another paywall engine" could not tell them apart, and every host needing that distinction ended up building its own multi-input gate.
- **`usePaywall().productsStatus`** — the other half of `isReady`, so a host seeing `catalogStatus: "ready"` with `isReady: false` can tell it is waiting on the store rather than on us.

### Notes

- **`"revalidating"` is the state this was actually built for, and it is not cosmetic.** In production the catalog is served CACHE-FIRST from AsyncStorage under a key that is **not** scoped by `customAudienceParams` — the react-query key is param-scoped, the disk key is a bare constant (`getPaywalls.query.ts` / `infra/queries/cacheKey.ts`). So a host sending volatile params gets an instantly-available catalog **resolved under different params**, with a fresh fetch in flight behind it. That catalog is non-null, so it reads as ready, and a host gating on `catalog.paywalls[placement]` can conclude the placement does not exist and route away milliseconds before the correct catalog lands.
- Reported from a production pilot, where the consequence was specific: for an audience gated on a threshold (`hoursSinceOnboardingPaywall >= 44`), the launch on which a user first becomes eligible was served the PRE-threshold catalog, so the arm under test lost exactly the launch that mattered — turning an A/B into a measurement of cache behaviour. `catalogStatus === "revalidating"` is how a host now distinguishes "this catalog is final" from "this may be superseded in a moment", and therefore whether a missing placement means absent or not-yet.
- **The disk cache is deliberately left unkeyed.** Scoping it by params would cause a miss on every param change and destroy the fast first paint the cache exists for, which is the correct trade-off for the common case of stable params. Exposing the state is strictly more useful than changing the caching, and was what the reporting host asked for.
- A present catalog outranks an error on purpose: when a background revalidation fails, react-query keeps the cached `data` and sets `error`, and a usable catalog must not be reported as a failure.
- Additive. `isReady` is unchanged and still the right single check for "presenting now will not show a spinner".

---

## [1.68.2] - 2026-08-21

### Notes

- No headless changes. Version moves in lockstep with `@rocapine/react-native-onboarding-ui`, which fixes a `Carousel` pagination dot announcing "Slide 1 of 6 - undefined" to screen readers. See that package's changelog — it also records the Metro-cache gotcha when testing 1.68.1's Carousel fix.

---

## [1.68.1] - 2026-08-21

### Notes

- No headless changes. Version moves in lockstep with `@rocapine/react-native-onboarding-ui`, which pins the `react-native-reanimated-carousel` peer range to `^4.0.0` — a fresh install was resolving v5, whose named-only export made the `Carousel` element render `undefined` and red-box on device. See that package's changelog.

---

## [1.68.0] - 2026-08-21

### Added

- **`product.<slot>.pricePerDay` / `pricePerDayAmount`** — the per-day price, exposed at last. `deriveProductFields` already computed `perDay(p)` and derived week/month/year and `savingsPct` from it, then discarded the value itself, so the per-day framing that anchors most trial paywalls ("$0.43 / day" beside "$39.99 / quarter") could not be authored at all despite the number existing. Projected as a flat dotted variable like its siblings and covered by the exhaustive key-list test.

### Notes

- **Absent whenever the period is unparseable**, exactly like `pricePerWeek`/`Month`/`Year` — `perDay` needs a period. That matters because the failure is indistinguishable from "the feature did not ship": a product resolved without a period (or, in the studio editor's indicative preview, a catalog row with no `duration_iso`) yields an empty string rather than an error. There is a test pinning this.
- **A misspelled product variable fails silently.** `interpolate` renders an unknown `{{key}}` as an EMPTY STRING, never as the literal template, so `{{product.yearly.pricePerDya}}` ships as a blank where a price should be and reads as a styling bug. Now that prices are authorable directly on `RadioGroup`/`CheckboxGroup` cards (1.67.1) that is the one authoring error that reaches production invisibly — called out in the `compose-screen-builder` skill.

---

## [1.67.1] - 2026-08-21

### Fixed

- **A malformed element tree could crash the app instead of failing validation.** `UIElementSchema` was a plain `z.union` of ~27 recursive variants, so it tried every branch at every node and each container branch re-parsed the whole subtree on the way — making any shape that missed on all of them exponential rather than linear. Three consequences, all reproduced against a real 52-node paywall, and all crashes rather than errors: every `id` stripped **exhausted a 512 MB heap in ~10 s** ("Ineffective mark-compacts near heap limit"); one container missing its `children` key threw **`RangeError: Invalid string length` from inside zod's own error constructor** (the error object was too large to build, so nothing could report it); and even when it did return, the only readable issue was `invalid_union` / "Invalid input" at the array index. `PaywallHost` parses serve-path payloads deliberately outside its error boundary — and a boundary cannot catch an OOM anyway — so the first case was an app-kill vector reachable from authored data. Now `z.discriminatedUnion("type", …)`: all three cases return in single-digit milliseconds with the exact failing path (`0.id`, `0.children`, `…props.variant`), and an unknown `type` reports a discriminator miss naming every valid element.

### Notes

- **`id` being required was not a fix for this, it was the trigger.** `id: z.string()` is required on every variant, so a missing one misses every branch at every node — which is precisely what made that case maximal-cost. A required field cannot fail fast inside a non-discriminated union, so "require `id` and fail early" was a no-op; the discriminator is what makes it fast.
- **Every variant now needs exactly ONE literal `type`.** `YStack` and `XStack` are therefore two entries sharing one props schema rather than one entry with `z.union([literal, literal])`, which a discriminated union cannot key off. Element count is unchanged (27) and no previously-valid payload becomes invalid.
- Error *messages* change shape for invalid payloads — precise paths instead of `invalid_union`. Nothing that parsed before parses differently now.

---

## [1.67.0] - 2026-08-21

### Fixed

- **One refused presentation permanently disabled paywalls for the rest of the process.** iOS will not present a view controller over one that is already presenting — another `Modal`, a `presentation: "modal"` route, a StoreKit alert. `present()` had already set the active placement by then, but the host's Modal never appeared, so nothing ever called `complete()`: the pending promise never settled, the placement stayed set for the life of the app, and **every later `present()` — for any placement — resolved `"error"` with no error and no log.** Confirmed in production on a monetisation surface, where the failure is invisible to the host and to us. The existing self-heal structurally could not catch it: that one requires `activePaywall` to be null, and here it is non-null (the catalog holds the paywall perfectly well — only the platform refused to show it). `PaywallProvider` now abandons a presentation the host never confirmed, after `presentAckTimeoutMs` (default 5000 ms), resolving `{status:"error", reason:"host-never-presented"}` and logging why. An **acknowledgement** rather than a bare timeout, because a paywall a user is reading legitimately stays active for minutes, so elapsed time alone cannot tell "still on screen" from "never appeared" — only an unacknowledged presentation is ever torn down.

### Added

- **`PresentResult.reason`** — every `"error"` now says WHY: `unknown-placement`, `already-presenting`, `parse-error`, `render-error`, `host-never-presented`, `paywall-disappeared`. The bare status conflated conditions whose correct recovery is opposite: `unknown-placement` means the catalog may not have arrived yet and retrying is right, `already-presenting` means retrying is wrong and something may be stuck. A caller given only the status could act correctly on neither, and two separate multi-hour production investigations were spent reconstructing by elimination what this value already knew. Exported as `PresentErrorReason` so a host can switch exhaustively.
- **`PresentResult.activePlacement`** — set alongside `reason: "already-presenting"`, naming the placement that holds the surface. The same placement means the caller double-called and wants its own in-flight guard; a different one means something else is stuck, which the caller cannot fix. Different diagnoses, so the bare status served neither.
- **`presentAckTimeoutMs`** on `PaywallProvider` — tunes the window above. `null` disables the recovery, which reinstates the permanent-wedge failure; only pass it if the host cannot acknowledge.
- **`acknowledgePresentation`** on the paywall context (`usePaywallHost()`) — how a host confirms a paywall genuinely reached the screen. `@rocapine/react-native-onboarding-ui` wires it to its Modal's `onShow`, which never fires when the platform refuses; that is what makes it the right signal.

### Notes

- **Both packages must move together for this release.** The recovery depends on the host acknowledging, so a newer headless paired with a `-ui` older than 1.67.0 would never receive an acknowledgement and would abandon legitimate presentations after the timeout. The two packages share a version by policy and `npm run publish:all` ships them together, so this is a caveat for hand-pinned installs, not the normal path.

---

## [1.66.0] - 2026-08-19

### Notes

- No headless changes. Version moves in lockstep with `@rocapine/react-native-onboarding-ui`, which fixes `enteringSettleDelayMs` being unreachable from `OnboardingPage` — see that package's changelog.

---

## [1.65.0] - 2026-08-19

### Added

- **`animation.entering.once`** — play an entrance **exactly once per screen lifetime**, on the first render where the element is visible. Fixes two bugs that share one cause: `renderWhen` visibility is mount/unmount (a false gate returns `null`) while reanimated fires `entering` on mount, so a gated element replays its entrance every time the gate flips back to true — swipe away from a carousel slide and back, and its decorations animate in again. No payload-level workaround exists: `gte` still unmounts when you move backwards past the threshold, and `replayWhen` is the exact opposite (it remounts on *every* change), so the latch has to live in the SDK.
- **An initial-mount play is DEFERRED, not suppressed.** If the first visible render is the screen's own mount, the entrance waits until the screen has settled. An entrance fired during the host navigator's push transition is half-consumed by it — with staggered delays, the early ones run under the transition and the late ones land after, so the reveal reads as half-animated — and on a cold run remote images may not have decoded either. Suppressing would have traded a partial entrance for none, which is the bug rather than the fix. Scope, stated precisely because it is easy to over-claim: the deferral buys clear air from the **entry transition**; it does not wait on image decode, because nothing in React Native reports that. Delaying does hand decode a head start, but as a side effect rather than a guarantee. Later visibility flips never replay; `once` wins over `replayWhen` when both are set.

### Notes

- Fully opt-in. Nothing changes for an element that does not set it, and screen-entrance choreography is untouched — a blanket "never animate on initial mount" would have broken that for every screen.

---

## [1.64.0] - 2026-08-19

### Added

- **`progressHeader` covers the last two values a forked bar needed.** `backButtonStrokeWidth` (chevron stroke weight, default `2`) — `backButtonSize` covered the glyph's size but not its weight, and at a 20pt glyph the difference between `2` and `2.5` reads as "the icon changed" without anyone being able to say why. `paddingTop` (space above the bar, default `0`) — the block had `paddingBottom` but nothing for the top, so a fork's extra space above the bar had no expression and the header sat higher after retirement.
- `paddingTop` is **added to** the top safe-area inset rather than replacing it. The inset is not optional, so a field that replaced it would let a payload push the header under the notch. `paddingBottom` has no inset to compose with, which is why only this one is additive — the asymmetry is spelled out in the type, the renderer and the docs.

### Notes

- Both default to the previous values, so nothing moves for anyone not setting them.
- **One structural difference is documented rather than fixed.** The header is a three-column row (back button / track / right spacer, flex `1 / trackFlex / 1`) and the reserved right column cannot be removed, so a fork whose track runs to the right padding edge will see its right end pull inward after retirement. `trackFlex` shrinks that column proportionally but never to zero. Removing it means a two-column mode — a layout change rather than another optional prop — so it deserves its own decision. Net: a forked bar is retirable **at a cost**, not at parity.

---

## [1.63.0] - 2026-08-19

### Added

- **`Repeat` UIElement — one template, N rows.** Materializes its `children` once per row of a payload-authored `props.data` array, replacing the duplicated subtrees that made every copy or style change an N-fold edit. **A `renderWhen` on the template gates per row, so `Repeat` also covers the "show exactly one of N" case — there is deliberately no `Match` element.** Row fields read as `{{item.<field>}}` and as `renderWhen` variables (`item.index` always present); `as` renames the scope, `keyField` picks the row field used for each materialized element's id suffix (`card` → `card__aries`) and React key. `data` is authored in the payload rather than sourced from a variable holding JSON, and a translatable row string carries its own **literal** i18n key — key coverage is measured by scanning payloads for literal key strings, so a computed key (`"zodiac_{{item.sign}}_title"`) would make the scanner find nothing, report the screen fully translated, and ship untranslated rows. New exports: `RepeatElementProps`.
- **`animation.replayWhen` on `BaseBoxProps`** — a variable name. Re-fires `entering` whenever that variable's value changes, so an element can re-animate **without** disappearing first; previously the only way to replay an entrance was to toggle `renderWhen`, which coupled "animate again" to "change visibility". The element's subtree is remounted, so transient state inside it resets and a continuous `effect` restarts; the initial mount is not a replay.
- **`Image.mode: "plain" | "expression"`** — `expression` enables `{{variable}}` interpolation in `url`, so one element serves a data-driven set instead of one duplicated subtree per case. References resolve to the variable's **`value`**, not its `label` (the inverse of `Text`): a URL segment is a machine identifier, so `{ value: "aries", label: "Aries" }` must yield `.../aries.png` and not a 404 on `.../Aries.png`. Defaults to `"plain"`, which stays fully static.
- **`Carousel.progressVariableName`** — publishes the carousel's *continuous* swipe position as a screen-scoped animated variable, so siblings can gate `renderWhen` on the finger rather than the settled slide (`variableName` still writes only on snap). The published value is **normalized to `[0, childCount)`**: the underlying `absoluteProgress` is clamped only when `loop: false` and is unbounded under `loop: true` (which is the default), so the raw value would leave every gate silently dead after the first lap.
- **`TypewriterText.reserveSpace`** — lays the fully-resolved string out invisibly to establish the box and overlays the animating characters, so a reveal never pushes siblings down. Only meaningful with `cursor: true` (without a cursor every character is already mounted from frame 0 and the box is stable). Measures the real resolved string, so it stays correct per locale, unlike the hardcoded wrapper height it replaces.
- **`inset` on `BaseBoxProps`** — `{ top?, left?, right?, bottom? }`, `number | string`, honoured on **`ZStack` children only**, replacing hand-computed `transform.translateX/Y` for off-anchor layers. An omitted side inherits the stack's shared anchor for that axis rather than meaning `0`; when an axis carries an inset, that axis drops both the opposite side's `0` and the shared anchor, so placement is correct at every anchor rather than only at `flex-start`.
- **`configuration.progressHeader`** — typed studio-authored progress-header styling (colours, `height`, `borderRadius`, paddings, `gap`, `trackFlex`, back-button), plus a `useProgressHeaderConfig()` hook. No backend change: the edge function already returns the whole `configuration` blob. New exports: `ProgressHeaderConfiguration`, `useProgressHeaderConfig`. The block covers the **back button's container** as well as its glyph — `backButtonBackgroundColor`, `backButtonBorderColor`, `backButtonBorderWidth`, `backButtonContainerSize`, `backButtonBorderRadius` — because glyph fields alone were not enough to retire a fork, which is what the block exists for: the one host known to have forked the bar wraps the chevron in a 32x32 white circle with a 1px border, and with only `backButtonColor`/`backButtonSize` that had no reachable expression. A lone `backButtonBorderColor` implies width `1` (RN defaults it to `0`, so a lone colour would draw nothing); all five unset render the previous bare chevron in a `padding: 4` touchable exactly.
- **Non-fatal payload diagnostics for misplaced keys.** `collectUnknownElementKeys` / `collectUnknownKeysInSteps` / `formatUnknownElementKeys` report keys sitting at an element's top level that the schema silently drops — classically `animation` outside `props`, which parses, renders, and never animates. Each finding carries a `kind`: `misplaced` (valid prop absent from `props` → "did you mean `props.X`?"), `shadowed` (valid prop **already** in `props`, so the top-level copy is inert, with a `conflicts` flag when the two values differ), or `unknown`. Allowed key sets are derived from `UIElementSchema` at runtime, so they cannot drift. `OnboardingProvider` runs the check once per payload under `__DEV__`. Deliberately **not** `.strict()`: rejecting unknown keys would turn already-published payloads carrying a stray key into hard parse failures. New exports: `UnknownElementKey`.

### Fixed

- **Template URLs are no longer handed to the asset preloader.** `extractAssetUrls` pushed any `url` prop verbatim, so an `Image` with `mode: "expression"` sent the literal `https://cdn/{{sign}}.png` to the prefetcher — a guaranteed 404 on every load. Such URLs are now skipped, and a `Repeat`'s template is instead resolved against each row so repeated media genuinely preloads.

---

## [1.62.0] - 2026-08-17

### Added

- **`client.getPaywalls()` — fetch a project's full paywall catalog in one round-trip.** Returns every placement (no per-placement fetch in the common path), cached under a dedicated `rocapine-paywalls-*` AsyncStorage namespace with the same stale-while-revalidate / custom-key behaviour as onboarding steps. New exports: `Paywall`, `PaywallCatalog`, `PaywallOptions`, `GetPaywallsResponseHeaders`, `PresentResult`.
- **`PaywallProvider` and `usePaywall()` — present a paywall from anywhere in the app, including screens with no onboarding flow mounted.** Mount `PaywallProvider` once, **above** `OnboardingProvider`, not beside or inside it — an app-level ancestor still reaches an `OnboardingProvider` mounted anywhere underneath. `usePaywall()` returns `{ present, isReady, catalog }`: `present(placement)` shows the matching paywall and resolves once the user leaves it (`"purchased" | "dismissed" | "cancelled" | "error"`), with **no network call** — the catalog and its products are already resolved from `PaywallProvider` mount, so a paywall renders the instant a user taps upgrade. An unknown placement, or presenting while another paywall is already showing, resolves `"error"` rather than throwing.
- **One shared product runtime across both providers.** `PaywallProvider` and `OnboardingProvider` publish/consume the same product context, so passing the same `productProvider` to each — with `PaywallProvider` as the ancestor — gives a single resolved product set and a single `purchasing` flag visible to both an onboarding step's `purchase` action and a standalone paywall's.
- **`dismiss` and `presentPaywall` ButtonActions.** `dismiss` finishes the current screen with `{ status: "dismissed" }` (a paywall host upgrades this to `"purchased"`/`"cancelled"` when a purchase actually completed during that presentation). `presentPaywall` opens a paywall by placement from an onboarding step or from a paywall's own content, and no-ops (with a `console.warn`) when no `PaywallProvider` is mounted anywhere above the host. Both were withheld from the `1.61.0` product-actions release specifically because no paywall host existed yet to make them meaningful.

---

## [1.61.0] - 2026-08-13

### Added

- **Vendor-neutral product runtime (`src/products/`).** Store subscriptions resolve at runtime through an injected `ProductProvider`, so a screen can display live prices and sell without the SDK depending on any billing vendor. New exports: `ProductProvider`, `ProductRef`, `ResolvedProduct`, `ProductWithDerived`, `ProductRuntime`, `PurchaseResult`, `RestoreResult`, `useProducts`, `deriveAll`, `deriveProductFields`, `formatCurrency`, `parseIsoDuration`, `productVariables`.
- **Three providers, none a dependency.** `revenueCatProductProvider`, `expoIapProductProvider`, and `stubProductProvider` (demos and previews only). `react-native-purchases` and `expo-iap` are loaded via `try { require() } catch` and are neither dependencies nor peer dependencies — absent, the adapter throws a clear error at call time rather than at import time.
- **Derived price fields are computed centrally**, not by adapters, so every provider yields identical numbers and formatting: `pricePerWeek`/`Month`/`Year` (string + amount), `savingsPct` (against a declared `compareTo` slot, normalized per day), `trialDays`.
- **Products project into the variable bag as flat dotted keys** — `product.<slot>.price`, `product.<slot>.pricePerWeek`, `product.<slot>.savingsPct`, plus `products.loaded` / `products.purchasing` / `products.error`. `interpolate()` and `evaluateCondition` both resolve keys by flat lookup, so `{{product.yearly.price}}` and `renderWhen` on `products.loaded` work with no rendering-engine change.
- **`purchase` and `restore` press actions** on `ButtonAction`. `purchase` interpolates its `product` field, so a `RadioGroup` writing `plan` can drive `{ type: "purchase", product: "{{plan}}" }`. Both accept `onSuccess` / `onError` follow-up action arrays (`purchase` also `onCancel`; `restore` also `onNothingToRestore`), which are full `ButtonAction[]` — so `"continue"` nested inside one still works.
- **`OnboardingProvider` accepts `productProvider` and `productRefs`** (both optional) and publishes a `products: ProductRuntime` on its context.

### Changed

- **`ButtonActionSchema` is now `z.ZodType<ButtonAction>` rather than `z.ZodUnion`.** The union became recursive when the follow-up action arrays were added, so it is declared with `z.lazy` and an explicit type annotation. Union-specific introspection (`.options`) is no longer available on it; parsing behaviour is unchanged.

### Notes

- Prices are never CMS data. Every displayed price comes from a `ProductProvider` — App Review rejects a paywall whose displayed price differs from the store. `stubProductProvider` exists for demos only and must never back a shipped paywall.
- A host that passes neither `productProvider` nor `productRefs` is unaffected: `useProducts` returns a referentially stable object forever after mount, so element memoization is preserved. Such apps do gain three variables in the bag (`products.loaded` = `"false"`, `products.purchasing` = `"false"`, `products.error` = `""`), computed once per screen mount.
- `dismiss` and `presentPaywall` actions are deliberately **not** included — they need a paywall host that does not exist yet, and shipping them as no-ops would let authors wire buttons that do nothing.

---

## [1.60.0] - 2026-08-13

### Added

- **`UIElement` and `UIElementSchema` are now public.** Both were module-private in `steps/ComposableScreen/types.ts`, where the step payload schema was their only consumer. They are exported from the new `src/screens/types.ts` and reachable from every existing import path. Purely additive — nothing was removed or renamed.
- **`ScreenElementsSchema`** — the elements array as a first-class, screen-agnostic schema, carrying the nested-`KeyboardAvoidingView` refinement that previously lived on the step payload. A caller parsing a full step still sees the same `payload.elements` issue path; the constraint simply belongs to the element tree rather than to steps, so a non-step screen can reuse it.

### Changed

- **Element schemas moved to `src/screens/`, ahead of the paywall work.** `src/steps/ComposableScreen/elements/*` is now `src/screens/elements/*`, and the `UIElement` union lives in `src/screens/types.ts`. `src/steps/ComposableScreen/types.ts` remains as the onboarding **step wrapper** (`BaseStepType` + `payload.elements`) and re-exports everything screen-agnostic, so every existing import path — including the documented `dist/steps/ComposableScreen/types.js` payload-validation recipe — resolves unchanged. This is the headless half of extracting the rendering engine so it can serve both onboarding steps and paywall screens.

---

## [1.59.2] - 2026-07-24

### Added

- **`TypewriterText` accepts `preset: "none"` to disable the per-character animation.** `TypewriterTextElementProps.preset` widens to `EnteringPreset | "none"` (zod schema accepts the literal too). Omitting `preset` still defaults to `"FadeInDown"` — `"none"` is the explicit opt-out.

---

## [1.59.1] - 2026-07-23

### Fixed

- **`startStepId` is read from `configuration`, not `metadata`.** The backend returns the entry-point id on `onboarding.configuration.startStepId`, but `useOnboardingStart()` read it from `metadata.startStepId` (always `undefined`), so the flow always fell back to the first step regardless of the studio-authored start node. `useOnboardingStart()` now reads `configuration.startStepId`. The `startStepId` field moved from `OnboardingMetadata` to the new `OnboardingConfiguration` interface (`Onboarding.configuration` is now typed instead of `any`). `resolveStartStepNumber(steps, startStepId)` is unchanged. Corrects the `1.59.0` location of `startStepId`.

---

## [1.59.0] - 2026-07-17

### Added

- **Explicit start node + end-via-branching + a first-class completion callback.** The onboarding graph now has studio-authored entry/exit semantics, all optional and backward compatible:
  - `OnboardingMetadata.startStepId` — id of the unique step the flow starts on, decoupled from array position. Resolve it with the new `resolveStartStepNumber(steps, startStepId)` helper or the new `useOnboardingStart()` hook (suspends on the payload, returns `{ startStepNumber }`). Falls back to the first step when absent or dangling.
  - `ONBOARDING_END_STEP_ID` (`"__END__"`) — a reserved end sentinel. A step's `nextStep.defaultTargetStepId` or any `branch.targetStepId` may target it to end the onboarding; ending is a first-class branching outcome, so a decision point can finish the flow from any step with no trailing screen. Exported for host/studio use.
  - `OnboardingProvider` gained an `onComplete?: ({ variables, metadata }) => void` prop, exposed to the host via the `completeOnboarding()` helper (returned from `useOnboardingStep` and available on the headless `OnboardingProgressContext`). New exported types `OnboardingCompletionContext` / `OnboardingCompleteHandler`.

### Changed

- **`resolveNextStepNumber` resolves the end sentinel.** It returns `null` when the matching branch's `targetStepId` — or the `defaultTargetStepId` — equals `ONBOARDING_END_STEP_ID`, in addition to the existing "no valid next" cases. Signature unchanged; payloads that don't use the sentinel are unaffected.
- **`BaseStepTypeSchema` rejects a step `id` equal to `ONBOARDING_END_STEP_ID`.** A step named `"__END__"` would be unreachable (branching to it ends the flow), so the schema now fails validation for it. Real step ids are unaffected.

---

## [1.58.0] - 2026-07-16

### Added

- **Custom Button action handlers now receive a `setVariable` setter.** `CustomActionHandler` args gained `setVariable(name, { value, label?, kind? })`, so a host-registered `{ type: "custom" }` handler can write back into the ComposableScreen variable context — the imperative counterpart to the declarative `{ type: "setVariable" }` action. Writes update both the render store (`renderWhen` / `{{interpolation}}`) and the branching store (`resolveNextStepNumber`), so a following `"continue"` branches on the new value. Backward compatible — existing handlers destructuring only `{ variables }` are unaffected.

---

## [1.57.4] - 2026-07-09

### Fixed

- **`preloadAssets` now prefetches images into the memory cache.** The batched `Image.prefetch(urls)` call passed no `cachePolicy`, so expo-image warmed only the `"disk"` cache — the first on-screen decode still flashed. It now prefetches with `"memory-disk"`, matching the render-side `cachePolicy` (onboarding-ui 1.57.4), so preloaded images are ready in memory.

---

## [1.57.3] - 2026-07-09

- No headless changes — version kept in lockstep with `@rocapine/react-native-onboarding-ui` 1.57.3 (ComposableScreen bordered-image corner fix).

---

## [1.57.2] - 2026-07-09

- No headless changes — version kept in lockstep with `@rocapine/react-native-onboarding-ui` 1.57.2 (ComposableScreen keyboard-avoiding background fix).

---

## [1.57.1] - 2026-07-09

- No headless changes — version kept in lockstep with `@rocapine/react-native-onboarding-ui` 1.57.1 (ComposableScreen loader `renderWhen` fix).

---

## [1.57.0] - 2026-07-01

### Changed

- Version bump to stay in lockstep with `@rocapine/react-native-onboarding-ui` 1.57.0 (ComposableScreen render-performance refactor lives in the UI package). No functional changes to the headless SDK.

---

## [1.56.0] - 2026-06-30

### Added

- **`TypewriterText` UIElement** — new ComposableScreen element that reveals its `content` string one character at a time (per-char delay = `delay + charIndex * stagger`). Props: `content` (required), `mode` (`plain`/`expression`), `preset` (entering preset, default `FadeInDown`), `duration` (400), `delay` (0), `stagger` (45), `easing`, `spring` (wins over `easing`), `loop` + `loopDelay` (repeat mode), `cursor` + `cursorChar` (blinking caret), plus the standard text-style props and all `BaseBoxProps`. Distinct from the whole-block `animation.entering` and from `AnimatedText` (number counter). Leaf, non-interactive.
- **Exported `EnteringPresetSchema` / `AnimationEasingSchema` / `SpringConfigSchema`** from `BaseBoxProps` so element schemas can reuse the entering-preset enum without duplicating it.

---

## [1.55.1] - 2026-06-26

### Added

- **`ZStack` `justifyContent` / `alignItems`** — the `ZStack` element schema now accepts these enums to anchor each content-sized layer within the stack (e.g. a floating bottom CTA with `justifyContent: "flex-end"`). Additive; defaults preserve prior top/stretch layering.

---

## [1.55.0] - 2026-06-25

### Added

- **Radial `backgroundGradient`** — `GradientBackground` is now a discriminated union of `linear` and `radial`. A radial gradient is `{ type: "radial", center?: { x, y }, radius?, stops }`: `center` is in 0–1 box fractions (default `{ 0.5, 0.5 }`), `radius` is a 0–1 box fraction (default `0.75`), and each `stop` is `{ color, position? }` (same as linear). Available on every element via `BaseBoxProps`. Existing linear gradients are unchanged.

---

## [1.54.0] - 2026-06-23

### Added

- **`cacheKey` client option + `OnboardingStudioClient.clearCache()`** — opt into app-controlled cache persistence. With no `cacheKey` (default), production caching is unchanged: stale-while-revalidate under `"rocapine-onboarding-studio"` (serve cache-first, heal in the background). Passing `cacheKey` persists the payload under `"rocapine-onboarding-sdk-{cacheKey}"` and serves it **cache-first with no background revalidation**, so a pinned version survives across launches and is never swapped out mid-flow — useful for resumable onboardings. The host triggers a refetch via the new `clearCache()` (removes the client's namespaced key; pair with invalidating the `["onboardingQuestions", …]` React Query key for an in-session refetch). The cache key is also part of the React Query key now, so clients with different keys no longer dedupe. Sandbox mode still always fetches fresh. Helpers `getOnboardingCacheKey` / `DEFAULT_ONBOARDING_CACHE_KEY` are exported.

---

## [1.53.0] - 2026-06-22

### Added

- **`DatePicker.format` prop** — optional `Intl.DateTimeFormatOptions` subset (`weekday`, `year`, `month`, `day`, `hour`, `minute`, `second`, `hour12`, `hourCycle`, `dateStyle`, `timeStyle`) on the `DatePicker` element schema (`DateTimeFormatOptionsSchema` / `DateTimeFormatOptions`), controlling how the picker's stored/displayed label is formatted across `date`/`time`/`datetime` modes. Lets authors choose 12h vs 24h, day/month/year style, etc. (e.g. `{ hour: "2-digit", minute: "2-digit", hour12: false }` → `"14:30"`). Omit for the previous default medium-style label. Note: Intl throws if `dateStyle`/`timeStyle` is combined with component fields — don't mix them (schema does not enforce).

---

## [1.52.0] - 2026-06-22

### Added

- **`headerHeight` + `setHeaderHeight` on `OnboardingProgressContext`, and the `useOnboardingHeaderHeight` hook.** The host-rendered `ProgressBar` is absolute-positioned, so its real footprint (top safe-area inset + bar + padding) was never available to step content. The bar now measures itself and publishes `headerHeight` (its full pixel footprint, including the inset it spans; `0` when hidden) so content can offset below it instead of guessing a fixed height. Consumers that already apply the top inset themselves should add only `headerHeight - insets.top` to avoid double-counting.

---

## [1.51.2] - 2026-06-22

### Changed

- **Version parity bump.** No headless SDK changes; released to stay in lockstep with `@rocapine/react-native-onboarding-ui` 1.51.2 (UI-only fix: RadioGroup/CheckboxGroup container now honors `flex`/`flexGrow`/`flexShrink`).

---

## [1.51.1] - 2026-06-22

### Changed

- **Version parity bump.** No headless SDK changes; released to stay in lockstep with `@rocapine/react-native-onboarding-ui` 1.51.1 (UI-only fix: centered RadioGroup/CheckboxGroup item labels).

---

## [1.51.0] - 2026-06-19

### Added

- **`RadioGroup` / `CheckboxGroup` per-item `image`.** Each `items[]` entry accepts an optional `image: { url, width?, height?, aspectRatio?, resizeMode?, borderRadius? }`, rendered above the label/sub-label as a column (image → label → subLabel). Validated in both step schemas (empty `url` and invalid `resizeMode` rejected).
- **`RadioGroup` / `CheckboxGroup` item layout props.** New group-level `itemAlignItems` (`"flex-start" | "center" | "flex-end" | "stretch"`, default `"center"`) controls the cross-axis alignment of each item's contents, and `itemGap` (number, default `12`) controls the spacing between an item's inner pieces (tick ↔ content, image ↔ text).

---

## [1.50.1] - 2026-06-19

### Changed

- **Version parity bump.** No functional changes to the headless SDK; released alongside `@rocapine/react-native-onboarding-ui` 1.50.1 (UI-only `RadioGroup` / `CheckboxGroup` tick-at-end layout fix).

---

## [1.50.0] - 2026-06-19

### Added

- **ComposableScreen `RadioGroup` / `CheckboxGroup` — tick + sub-label customization.** New tick props `tickPosition` (`"start"` | `"end"`, default `"start"`), `tickColor`, `tickSelectedColor`, `tickBorderRadius` (default: radio `tickSize / 2` full circle, checkbox `4`), and `tickSize` (tick diameter / box side in px, default `20` — radio's inner dot and checkbox's ✓ glyph scale with it). Each item now accepts an optional `subLabel` (secondary line) with state-aware styling: `itemSubLabelColor`, `itemSelectedSubLabelColor`, `itemSubLabelFontSize`, `itemSubLabelFontWeight`, `itemSubLabelFontFamily`, `itemSubLabelFontStyle`. Item `label` is now optional — when a label or sub-label is absent no gap is rendered.

---

## [1.49.1] - 2026-06-19

### Changed
- Version parity bump — no headless SDK changes. Released alongside the UI fix for ComposableScreen Carousel active dot sizing.

---

## [1.49.0] - 2026-06-19

### Added

- **ComposableScreen `Carousel` element — more dot controls.** New props `activeDotWidth`, `activeDotHeight` (active-dot size; default to `dotWidth`/`dotHeight` when unset), `dotsPosition` (`"top"` | `"bottom"`, default `"bottom"`), and `dotsMarginBottom` (default `0`). Complements the existing `dotColor`/`activeDotColor`/`dotWidth`/`dotHeight`/`dotsGap`/`dotsMarginTop`.

---

## [1.48.0] - 2026-06-19

### Added

- **Carousel pagination dot customization** — the `Carousel` step payload accepts an optional `pagination` object: `show`, `dotColor`, `activeDotColor`, `dotWidth`, `dotHeight`, `activeDotWidth`, `activeDotHeight`, `gap`, `position` (`"top"` | `"bottom"`), `marginTop`, `marginBottom`. All fields optional; omitting `pagination` keeps the previous default look.

---

## [1.47.0] - 2026-06-19

### Added

- **Injectable navigation** — new `OnboardingNavigationAdapter` type, default `expoRouterAdapter`, and `useOnboardingNavigation()` hook. `OnboardingProvider` accepts an optional `navigation` prop to plug in any navigation library (react-navigation, custom) instead of `expo-router`.

### Changed

- **`expo-router` is now an optional peer dependency** (was a hidden hard import). When installed it is used automatically; otherwise inject a `navigation` adapter. `useOnboardingStep` calls `navigation.useFocusEffect` instead of importing `expo-router` directly. Existing expo-router apps require no changes.

---

## [1.46.0] - 2026-06-18

### Added

- New `DrawingPad` ComposableScreen `UIElement` type (type + Zod schema). A
  freehand drawing / signature surface that serializes the captured drawing
  into runtime variable(s): `variableName` receives an SVG path string,
  `imageVariableName` receives a base64 image data URI. Props: `strokeColor`,
  `strokeWidth`, `backgroundColor`, `clearable`, `imageFormat` (`"png"|"jpeg"`),
  a customizable clear button (`clearButtonPosition` (4 corners),
  `clearButtonOffset`, `clearButtonSize`, `clearButtonColor`,
  `clearButtonIconColor`, `clearButtonLabel`), plus all `BaseBoxProps`. The
  renderer (UI package) requires the optional peer dependency
  `@shopify/react-native-skia`.

---

## [1.45.0] - 2026-06-18

### Added

- **`Slider` ComposableScreen UIElement** — a continuous numeric input bound to
  a variable. Value is stored as a stringified float (`kind: "float"`) so
  expressions/conditions coerce it numerically. Props: `variableName`,
  `defaultValue` (number), `min` (0), `max` (1), `step` (0 = continuous), plus
  `minimumTrackTintColor` / `maximumTrackTintColor` / `thumbTintColor` and
  `disabled`. Schema refines `min <= max`. Exposed via `SliderElementProps` and
  the `UIElement` union / `UIElementSchema`.

---

## [1.44.7] - 2026-06-18

### Changed

- Version sync with `@rocapine/react-native-onboarding-ui@1.44.7` (gradient
  elements no longer fill the screen). No headless changes.

---

## [1.44.6] - 2026-06-18

### Fixed

- Asset prefetch/preload now works for `ComposableScreen` steps. The element
  tree walker in `extractAssetUrls` recursed into `props.children`, but the
  `UIElement` schema stores `children` as a top-level sibling of `props`, so
  container recursion never fired — every nested `Image`/`Video`/`Lottie`/`Rive`
  asset was skipped (composable screens always wrap content in
  `SafeAreaView`/`ScrollView`/stacks). Now recurses into `element.children`, so
  nested assets warm the cache as intended.

---

## [1.44.5] - 2026-06-16

### Changed

- Version sync with `@rocapine/react-native-onboarding-ui@1.44.5` (staggered
  autoplay `ProgressIndicator` loader bars no longer reset to empty). No
  headless changes.

---

## [1.44.4] - 2026-06-16

### Changed

- Version sync with `@rocapine/react-native-onboarding-ui@1.44.4` (empty/null
  `fontFamily` now falls back to the theme default). No headless changes.

---

## [1.44.3] - 2026-06-16

### Fixed

- **Production no longer gets pinned to the offline fallback.** The production
  onboarding query was cache-first with `staleTime: Infinity`: it returned the
  AsyncStorage cache and **never called the edge function again**, and it cached
  whatever `getSteps` returned — including the offline fallback. So a single
  first-launch fetch failure (timeout / offline / cold-start) cached the
  fallback and pinned every subsequent launch to it, while the device stopped
  hitting the studio entirely. The query now (1) **never caches the fallback**
  (detected via the `ONBS-Onboarding-Id: "fallback"` header), so a bad launch
  self-heals on the next start, and (2) uses **stale-while-revalidate** — it
  serves the cache for an instant first paint while refreshing from the network
  in the background, so studio re-deploys propagate and a stale cache recovers.

---

## [1.44.2] - 2026-06-15

### Fixed

- **Italic font faces are no longer dropped.** The runtime font registry keyed
  variants by weight only, so a `700-italic` face was overwritten by the
  `700-normal` face at the same weight — any `fontStyle: "italic"` text then
  rendered upright. Variants are now keyed by **weight + style**, both faces are
  registered, and `resolveFontFamily` / `useResolvedFontStyle` /
  `useResolvedFontFamily` accept an optional `fontStyle` argument and pick the
  italic face when requested (falling back to the upright face when no italic is
  registered at that weight).
- **Apple SF Pro fonts now render at all weights on iOS.** A manifest family
  whose name collides with the iOS system font (`SF Pro`, `SF Pro Display`,
  `SF Pro Text`, `SF Pro Rounded`, `system`, … — matched case- and
  separator-insensitively) is no longer registered as a bundled face on iOS:
  registering under the system family name made iOS give the system font
  precedence, so only Regular resolved (other weights rendered as tofu). On iOS
  such families now resolve to `fontFamily: undefined` so React Native uses the
  real system font honoring `fontWeight`. On Android (no SF Pro system font) the
  bundled faces register and resolve normally.

### Added

- `isSystemFontFamily`, `normalizeStyle`, and the `FontStyleKey` /
  `RegisteredFace` types are now exported from the package.

---

## [1.44.1] - 2026-06-15

### Changed

- **Runtime font registration** — fonts now register under their file's
  PostScript name (the font file's base name, e.g. `Inter-SemiBold.ttf` →
  `Inter-SemiBold`) instead of a synthesized `<family>-<weight>` name.
  `buildRegisteredName` now derives the name from the font URL, stripping
  directory, query string, and extension.

---

## [1.44.0] - 2026-06-11

### Changed

- Version bump only — paired with `@rocapine/react-native-onboarding-ui` 1.44.0
  (`OnboardingPage` `keyboardVerticalOffset` prop). No headless changes.

---

## [1.43.0] - 2026-06-11

### Added

- **`ProgressiveBlurImage` `blurAppear`** — optional `{ delay?, duration?, easing? }`
  on the element schema. Drives a delayed fade-in of the blur layer over the
  always-visible sharp base image (the photo shows immediately, then the
  progressive blur arrives). Omitting it keeps the legacy static-on-mount blur.
  `easing` ∈ `"linear" | "ease-in" | "ease-out" | "ease-in-out"`. New exported
  `BlurAppear` type.

---

## [1.42.1] - 2026-06-11

### Changed
- **Version sync** — no functional change to the headless SDK. Released alongside `@rocapine/react-native-onboarding-ui@1.42.1` (Button `flex` fix) to keep both packages on the same version.

---

## [1.42.0] - 2026-06-10

### Added
- **RadioGroup / CheckboxGroup per-item shadow** — new optional props on both element schemas: `itemShadowColor`, `itemShadowOffset` (`{ width, height }`), `itemShadowOpacity` (0–1), `itemShadowRadius` (≥0), and `itemElevation` (≥0, Android). Applied to each item row.

---

## [1.41.2] - 2026-06-10

### Changed

- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.41.2 (applies `shadow*` props on Stack/ZStack containers).

---

## [1.41.1] - 2026-06-09

### Changed

- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.41.1 (fixes a static `transform` being suppressed until an element's entering animation finished).

---

## [1.41.0] - 2026-06-09

### Added

- **`autoFocus` prop on `Input` element** — when `true`, the input focuses on mount and the keyboard opens automatically. Optional, defaults to `false`.

---

## [1.40.0] - 2026-06-09

### Added
- **Background asset preloader** — once the onboarding payload is fetched, every remote image/video/Lottie/Rive/SVG asset referenced anywhere in the flow is warmed in the background so later screens render without a load flash. Fully non-blocking (never gates first render) and always on (no config). Covers ComposableScreen element trees (`Image`/`ProgressiveBlurImage`/`Video`/`Lottie`/`Rive`, recursing through container children), `MediaContent`, `Carousel`, and `Loader` `didYouKnowImages`. Bundled assets (MediaSource `localPathId`) are skipped — only remote URLs are warmed.
- **New exports** — `extractAssetUrls(onboarding)` (pure: returns deduped `AssetRef[]` of remote assets, safe on partial/malformed payloads) and `preloadAssets(assets)` (fire-and-forget; native image prefetch via expo-image/RN Image, HTTP-cache warm for video/Lottie/Rive/SVG with bounded concurrency). `AssetRef`/`AssetKind` types exported. Hosts can call these manually for custom preloading.

### Changed
- **`expo-image` added as an optional peer dependency** — used for batched image prefetch when present; falls back to `Image.prefetch` from react-native when absent. No-op if neither warms.

---

## [1.39.0] - 2026-06-08

### Added
- **`AnimatedText` UIElement schema** — type + Zod schema for the new count-up text element (`from`/`to`/`duration`/`delay`/`easing`/`autoplay`/`loop`/`decimals`/`thousandsSeparator` + text styling). Added to the ComposableScreen `UIElement` union. `to` is required; the element renders the number only and never writes a variable. See the UI package for the animated `TextInput` renderer.

---

## [1.38.2] - 2026-06-08

### Changed
- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.38.2 (UI-side fix: memoize `AnimatedBox` entering/exiting/layout builders so entry transitions don't restart on re-render).

---

## [1.38.1] - 2026-06-08

### Changed
- **Version sync only** — no headless changes. Bumped in lockstep with `@rocapine/react-native-onboarding-ui` 1.38.1 (UI-side re-render fixes in the Loader animations and ComposableScreen render tree).

---

## [1.38.0] - 2026-06-08

### Added
- **`ProgressIndicator` value range (`minValue` / `maxValue` / `step`)** — the indicator is no longer fixed to 0–100. `minValue` (default 0) and `maxValue` (default 100) set an arbitrary value range, so `autoplay` animates `initialValue → maxValue` and the bound `variableName` / label carry the **raw value** (not a percentage). Enables an animated count-up to N: `{ minValue: 0, maxValue: 5000, step: 50, autoplay: true, variableName: "…" }`, then read `{{var}}` in a `Text` (`mode: "expression"`). `step` (default 1, `> 0`) snaps the displayed/written value and bounds the per-sweep write count to `(maxValue − minValue) / step` — use a coarse step for large ranges.
- **`ProgressIndicator.labelSuffix`** — suffix appended after the label value (default `"%"`); set `""` or a unit (e.g. `" kg"`) for non-percentage ranges.

### Changed
- **`ProgressIndicator` `value` / `initialValue` no longer capped at 100** — their Zod `.min(0).max(100)` was relaxed to a plain number; out-of-range values clamp to `[minValue, maxValue]` at runtime instead of failing parse. Defaults (`minValue:0`, `maxValue:100`, `step:1`, `labelSuffix:"%"`) keep existing percentage payloads byte-identical.

---

## [1.37.0] - 2026-06-08

### Added
- **`onPress` on every UIElement** — `BaseBoxProps` now carries an optional `onPress: ButtonAction[]`, so any element can be made tappable with the same action list as `Button.actions` (`"continue"` / `{type:"setVariable"}` / `{type:"custom"}`, run sequentially, `"continue"` terminal). Flows automatically to every ComposableScreen element variant via the shared `BaseBoxProps`. The UI runtime ignores it on elements that own their own gesture (`Button`, `RadioGroup`, `CheckboxGroup`, `DatePicker`, `Input`, `WheelPicker`) — see the UI changelog.
- **`arrayOp` on the `setVariable` action** — `SetVariableButtonAction` gains an optional `arrayOp: "append" | "remove" | "toggle"` that treats the target variable as the JSON-encoded `string[]` multi-select used by `CheckboxGroup`. `value`/`label` are the single member to add (dedup), drop, or flip; the stored `label` stays comma-joined like a real checkbox and `kind` is ignored. Lets any element (via `onPress`) or `Button` add/remove a chip from a multi-select without a `CheckboxGroup` widget. Omitting `arrayOp` keeps the existing overwrite behavior.

### Changed
- **`ButtonAction` moved to `common.types.ts`** — `ButtonAction`, `CustomButtonAction`, `SetVariableButtonAction` and their Zod schemas now live in `steps/common.types.ts` (shared with the new `onPress`), re-exported from `steps/ComposableScreen/elements/ButtonElement.ts` for back-compat. No change to the public API surface or payload shape.

---

## [1.36.2] - 2026-06-08

### Changed
- **Version alignment** — no headless changes; bumped to stay in lockstep with `@rocapine/react-native-onboarding-ui` 1.36.2 (ComposableScreen text-element font fallback fix).

---

## [1.36.1] - 2026-06-04

### Changed
- **Expo SDK 56 / React Native 0.85 alignment** — bumped build-time `react` (19.2.3) and `react-native` (0.85.3) dev dependencies so the package builds against the SDK 56 toolchain. No runtime/API changes (peer deps stay `*`).

---

## [1.36.0] - 2026-06-04

### Added
- **`blurRadius` prop on the `Image` ComposableScreen element** — optional non-negative number applying a uniform Gaussian blur (native `Image.blurRadius`, no extra dependency). `0`/omitted = sharp; ignored for SVGs.
- **New `ProgressiveBlurImage` ComposableScreen element** — a full-bleed image with a gradient-masked Gaussian blur baked in (sharp where the `mask` is transparent, progressively blurred where it's opaque — the "welcome screen" hero look). Props: `url`, `intensity` (0–100, maps to a blur radius), `tint` (`light`/`dark`/`default`), `mask`, `maxBlurOpacity`, plus standard box props. The `mask` is a union — **linear** (`{ from, to, stops }`, `type` optional) or **radial** (`{ type:"radial", center?:{x,y}, radius?, stops }`); each stop's `opacity` = blur strength. Existing `{ from, to, stops }` payloads stay valid as linear. Leaf element (no `children`); intended as the bottom layer of a `ZStack`. New exported types `LinearBlurMask` / `RadialBlurMask`. (UI renders this by masking a blurred copy of the image — see the UI changelog.)

---

## [1.35.0] - 2026-06-02

### Added
- **`haptic` prop on `Button`, `RadioGroup`, `CheckboxGroup` ComposableScreen elements** — optional enum `"none" | "light" | "medium" | "heavy" | "soft" | "rigid"` mapping to expo-haptics `ImpactFeedbackStyle`. Opt-in: absent or `"none"` = no feedback, so existing onboardings are unchanged. Backed by the shared `HapticStyle` type + `HapticStyleSchema` enum in `steps/common.types.ts`.

---

## [1.34.1] - 2026-06-02

### Changed
- **Example onboarding** — added a second WebP image (landscape, 16:9) to the default onboarding's first composable screen, alongside the existing portrait WebP. No schema or API change.

---

## [1.34.0] - 2026-06-02

### Added
- **`ScrollView` element `alignItems` / `justifyContent`** — two optional props on the `ScrollView` UIElement controlling cross-axis alignment (`alignItems`: `"flex-start"` | `"center"` | `"flex-end"` | `"stretch"` | `"baseline"`) and distribution along the scroll axis (`justifyContent`: `"flex-start"` | `"center"` | `"flex-end"` | `"space-between"` | `"space-around"`). Applied to the scroll content container.

---

## [1.33.0] - 2026-06-01

### Added
- **`RichText` container UIElement** — a **wrapping flex row** of child `Text` elements (words + padded/rounded/rotated "chips" that wrap and align together, e.g. a "Boost your `[energy]`" marketing title). Because each child renders as a real flex child of a `<View>` (not a nested `<Text>` like inline `TextSpan`s), it honors its own box props — `padding`, `borderRadius`, `borderWidth`, `backgroundColor`, `margin`, `transform` — plus `renderWhen` and `expression` mode. Plain-text children are split into one item per word so the row wraps word-by-word like a paragraph (chips flow inline with the text); children with box styling or motion stay atomic. `children` are schema-restricted to `Text` only. `props` are layout props (`gap`, `alignItems` — incl. `"baseline"` — `justifyContent`, `flexWrap` defaulting to `"wrap"`) plus all `BaseBoxProps`, plus **inherited text-style defaults** (`fontSize`, `fontWeight`, `fontFamily`, `fontStyle`, `color`, `textAlign`, `letterSpacing`, `lineHeight`) — declare the title's base typography once on the container and each child `Text` inherits it (child overrides win). New exported type: `RichTextElementProps`. (Distinct from inline `TextSpan`, which stays a single text-style-only wrapping paragraph.)

---

## [1.32.0] - 2026-06-01

### Added
- **Animations / transitions / effects on every UIElement** — `BaseBoxProps` gains two optional fields, so any ComposableScreen element can declare motion. Schema mirrors `react-native-reanimated`: `preset` values are the **exact reanimated builder names** and modifier fields map to builder methods.
  - **`transform`** (static): `{ translateX?, translateY?, scale?, scaleX?, scaleY?, rotate? (deg) }`.
  - **`animation`**: `{ entering?, exiting?, layout?, effect? }`.
    - `entering` / `exiting`: `{ preset, duration?, delay?, easing?, spring? }`. Entering presets: `FadeIn(Up/Down/Left/Right)`, `SlideIn(Up/Down/Left/Right)`, `ZoomIn(Rotate/Up/Down/Left/Right/EasyUp/EasyDown)`, `BounceIn(Up/Down/Left/Right)`, `FlipIn(XUp/YLeft/XDown/YRight/EasyX/EasyY)`, `StretchIn(X/Y)`, `RotateIn(DownLeft/DownRight/UpLeft/UpRight)`, `RollIn(Left/Right)`, `PinwheelIn`, `LightSpeedIn(Left/Right)`; exiting presets are the matching `…Out…` names.
    - `layout`: `{ preset, duration?, spring? }` — `LinearTransition`, `FadingTransition`, `SequencedTransition`, `JumpingTransition`, `CurvedTransition`, `EntryExitTransition`.
    - `effect` (continuous loop, not a reanimated builder name): `{ preset: "pulse" | "fade" | "rotate" | "shimmer" | "bounce", duration?, delay?, easing?, loop?, minScale?/maxScale? (pulse), minOpacity? (fade), degrees? (rotate) }`.
  - `easing` (`"linear"` | `"ease-in"` | `"ease-out"` | `"ease-in-out"`) and `spring` (`{ damping?, stiffness?, mass? }`, mirrors `.springify(config)` and wins over `easing`). New exported types: `AnimationEasing`, `SpringConfig`, `EnteringPreset`, `ExitingPreset`, `LayoutPreset`, `EffectPreset`, `EnteringAnimation`, `ExitingAnimation`, `LayoutAnimation`, `ElementEffect`, `ElementAnimation`, `ElementTransform`.
- **`TextSpan` extended** — inline rich-text spans gain `backgroundColor`, `opacity` (0–1), `textTransform` (`"none"` | `"uppercase"` | `"lowercase"` | `"capitalize"`), `textDecorationColor`, `textDecorationStyle` (`"solid"` | `"double"` | `"dotted"` | `"dashed"`), and `lineHeight`. All optional, inline-safe (animation/transform remain element-level only — spans are not UIElements).

---

## [1.31.0] - 2026-06-01

### Added
- **Inline rich text for `Text`** — `TextElementProps.content` is now `string | TextSpan[]`. A span array renders styled fragments inline (nested `<Text>`) that wrap together on one baseline. New `TextSpan` type and `TextSpanSchema` exported from the headless package. Span fields (all optional except `text`): `text`, `fontWeight`, `fontStyle`, `fontFamily`, `fontSize`, `letterSpacing`, `color`, `textDecorationLine` (`"none"` | `"underline"` | `"line-through"` | `"underline line-through"`). Omitted span props inherit from the parent `Text`. In `mode: "expression"`, `{{variable}}` interpolation applies to each span's `text`.

### Changed
- **`TextElementPropsSchema.content`** widened from `z.string()` to `z.union([z.string(), z.array(TextSpanSchema)])`. Backward compatible — existing string payloads validate and render unchanged.

---

## [1.30.0] - 2026-05-29

### Added
- **`ProgressIndicator` UIElement** — new ComposableScreen element rendering a linear or circular progress display bound to an int variable (0–100). Schema (`ProgressIndicatorElementPropsSchema`) and type (`ProgressIndicatorElementProps`, `ProgressEasing`) exported from the headless package and added to the `UIElement` union. Props (all optional, plus `BaseBoxProps`): `variant` (`"linear"` | `"circular"`), `variableName` (bound int variable — written each frame during autoplay, read otherwise), `value` (static 0–100), `autoplay`, `loop`, `initialValue` (0–100), `duration` (ms), `delay` (ms before the animation starts), `easing` (`"linear"` | `"ease-in"` | `"ease-out"` | `"ease-in-out"`), `color`, `trackColor`, `thickness`, `size`, `showLabel`, `labelColor`.

---

## [1.29.0] - 2026-05-29

### Added
- **`DatePicker`: `"now"` sentinel for date bounds** — `defaultValue`, `minimumDate`, and `maximumDate` now accept the literal string `"now"` in addition to ISO 8601 date strings. `"now"` resolves to the current date/time at render, so a max date that should always be "today" no longer goes stale at module-load time. Schema validation accepts a value when it is `"now"` or parses via `Date.parse`.
- **`SetVariableButtonActionSchema` / `SetVariableButtonAction`** — exported from the headless package and added to the `ButtonActionSchema` union (`{ type: "setVariable", name, value, label?, valueMode?, kind? }`).

### Fixed
- **`ButtonActionSchema` rejected `setVariable` actions** — the headless union only accepted `"continue"` and `{ type: "custom" }`, while the UI package and runtime already supported `setVariable`. Any ComposableScreen payload using a `setVariable` button action failed parsing with `invalid_union`. Headless now mirrors the UI variant, fixing the schema drift.

---

## [1.28.0] - 2026-05-29

### Added
- **`RadioGroup` / `CheckboxGroup`: `showTick` prop** — both schemas extend with optional `showTick: boolean` (default `true`). When `false`, the per-item indicator (radio circle / checkbox box) is omitted; the item label and selected background / border styling still render. Lets authors build pill / card-style single- and multi-select groups without the tick glyph.

---

## [1.27.0] - 2026-05-29

### Added
- **Unary condition operators `is_empty` / `is_not_empty` / `is_null` / `is_not_null`** — usable in `renderWhen`, `Button.disabledWhen`, and `nextStep.branches[].condition`. They take no `value` (schema makes `value` optional for these and still required for binary operators). `empty` is type-aware (empty/whitespace string, empty array, or unset/null); `null` is unset/null only — a set-but-empty `""` is **not null** yet **is empty**. Exports `UNARY_CONDITION_OPERATORS` + `isUnaryConditionOperator`.
- **`WheelPicker` UIElement** — scrolling wheel selector for the ComposableScreen system. Binds a variable via `variableName` / `defaultValue`. Options come from either an explicit `items: Array<{label, value}>` or an auto-generated numeric `range: {min, max, step?, unit?}` (exactly one required; `unit` formats labels as `"<value> <unit>"`). Styling via `itemColor` / `itemFontSize` / `itemFontFamily` plus standard `BaseBoxProps`. Exports `WheelPickerElementProps`, `WheelPickerItem`, `WheelPickerRange`, `WheelPickerElementPropsSchema`, and helpers `resolveWheelPickerItems` / `generateWheelPickerRangeItems` (shared with the UI renderer + default collection). Rendered via the optional `@react-native-picker/picker` peer dep (same as the `Picker` step).

### Fixed
- **Condition evaluation now decodes JSON-array variable values** — multi-select elements (`CheckboxGroup`) store their value as a JSON string (`"[]"` when empty). `evaluateCondition` decodes such strings back to an array before testing, so a fully-deselected group correctly reads as empty: a `renderWhen` / `disabledWhen` using `is_not_empty` now hides/disables again when the last item is unselected (previously `"[]"` was treated as a non-empty string and never fell back). `contains` against these values is now real array membership rather than a substring match.

---

## [1.26.0] - 2026-05-28

### Added
- **`Icon` UIElement: `fill` + `fillOpacity` props** — `IconElementPropsSchema` extends with optional `fill: string` (any CSS color; omit ⇒ Lucide default `"none"` outlined) and `fillOpacity: number` (0–1, clamped). Enables filled / tinted Lucide icons (`Star`, `Heart`, `Bookmark`, `Circle`, `CheckCircle2`, …) from CMS payload.

### Changed
- **`onboarding-example.ts` ComposableScreen demo** — wrapped `root` YStack in a `ScrollView` UIElement so the payload scrolls (page renderer is intentionally a plain `View flex:1`, see `composable-screen-runtime.md`). Hero `Star` icon also showcases `fill` + `fillOpacity: 0.2` tint.

---

## [1.25.1] - 2026-05-28

### Added

- **`aspectRatio` on `BaseBoxProps`** — every UIElement now accepts an
  optional positive `aspectRatio` number, mirroring the React Native
  style prop. Pair with `width` / `height` to derive the other dimension
  instead of hard-coding both.

---

## [1.25.0] - 2026-05-27

### Added

- **`ScrollView` ComposableScreen UIElement** — new container element wrapping
  children in a scrollable view. Props (`ScrollViewElementProps`, extends
  `BaseBoxProps`): `horizontal`, `bounces`, `showsVerticalScrollIndicator`,
  `showsHorizontalScrollIndicator`, `alwaysBounceVertical`,
  `alwaysBounceHorizontal`, `contentInset` (`ScrollViewContentInset`:
  `{ top, right, bottom, left }`, iOS-only), `contentContainerPadding`,
  `keyboardShouldPersistTaps`.
- **`KeyboardAvoidingView` ComposableScreen UIElement** — new container element.
  Props (`KeyboardAvoidingViewElementProps`, extends `BaseBoxProps`):
  `behavior` (`KeyboardAvoidingBehavior`: `"padding" | "height" | "position"`,
  defaults to iOS `padding` / Android `height`), `keyboardVerticalOffset`,
  `enabled`.
- **Schema guard: no nested KeyboardAvoidingView** — `ComposableScreenStepPayloadSchema`
  now `superRefine`s the element tree and rejects any `KeyboardAvoidingView`
  nested inside another, reporting the offending element `id`.

> **Backend note:** `onboarding-studio` should mirror both new UIElement types
> (union + Zod schema + editor picker) and the nested-KAV validation rule, and
> default the `picker` archetype template to wrap its picker in a
> `KeyboardAvoidingView`.

---

## [1.24.0] - 2026-05-27

### Added

- **Button per-state style overrides** — `ButtonElementProps` gains
  `pressedStyle?: ButtonStyleOverride` and `disabledStyle?: ButtonStyleOverride`,
  each a `Partial` of the overridable Button props (`BaseBoxProps` plus
  `variant`, `backgroundColor`, `color`, `fontSize`, `fontWeight`,
  `fontFamily`, `fontStyle`, `textAlign`). Nested `pressedStyle`/`disabledStyle`
  are not overridable. New `transitionDurationMs?: number` controls the
  rest/pressed/disabled animation length (default `150`).
- **Shadow fields on `BaseBoxProps`** — `shadowColor`, `shadowOffset`
  (`{ width, height }`), `shadowOpacity` (0–1), `shadowRadius`, and `elevation`
  (Android) on every UIElement variant. Currently applied by the `Button`
  renderer in the UI package; schema accepts them on all elements.

### Changed

- **`disabledBackgroundColor` / `disabledColor` deprecated** — superseded by
  `disabledStyle.backgroundColor` / `disabledStyle.color`. Still honored as a
  fallback when `disabledStyle` is absent, so existing payloads are unaffected.

> **Backend note:** `onboarding-studio` should mirror the new `pressedStyle`,
> `disabledStyle`, and `transitionDurationMs` Button fields plus the shadow
> fields on `BaseBoxProps`, and surface per-state style editors. JSON
> serialization passes through unchanged.

---

## [1.23.0] - 2026-05-26

### Added

- **`renderWhen` on every UIElement variant** — optional
  `renderWhen?: LeafCondition | ConditionGroup` field on every entry of the
  `UIElement` discriminated union (Stack, Text, Image, Lottie, Rive, Icon,
  Video, Input, Button, RadioGroup, CheckboxGroup, DatePicker, Carousel,
  ZStack, SafeAreaView). Reuses the existing `LeafConditionSchema` /
  `ConditionGroupSchema` from `common.types` — no new condition types. When
  the condition evaluates falsy against current ComposableScreen variables,
  the runtime skips rendering the element and its entire subtree. Companion
  to `Button.disabledWhen` (visual disabled state) and `Branch.condition`
  (flow-level next-step selection); use `renderWhen` for in-screen
  conditional visibility (validation errors, variable-gated sections, etc.).

> **Backend note:** `onboarding-studio` should mirror the optional
> `renderWhen` field on every UIElement variant and surface a "Render when"
> condition picker in the element properties panel, reusing the Branch
> condition builder. JSON serialization passes through unchanged.

---

## [1.22.0] - 2026-05-11

### Added

- **`kind` on `ComposableVariableEntry`** — optional `"int" | "float" | "string"`
  tag on stored variables, exported as `ComposableVariableKind`. Drives
  expression-mode coercion for `setVariable` actions (numeric math vs string
  concat). Existing code paths ignore the tag, so back-compat is preserved.

> **Backend note:** `onboarding-studio` should optionally surface a `kind`
> field on `setVariable` actions and on any default variable seeding UI.

---

## [1.21.0] - 2026-05-11

### Added

- **`defaultIndex` and `variableName` on ComposableScreen `Carousel`** — new
  optional props on `CarouselElementProps`. `defaultIndex` (integer, ≥ 0,
  nullable) sets the initial page at mount. `variableName` binds the carousel
  index to a variable in the ComposableScreen variable store: `setVariable`
  button actions targeting that name scroll the carousel imperatively, and
  user swipes write the new index back to the variable so other elements
  (`Text` `{{var}}` interpolation, branching `evaluateCondition`) can react.
  Invalid / out-of-range values clamp to `[0, children.length - 1]`; missing
  / non-numeric values fall back to `defaultIndex ?? 0`.

> **Backend note:** `onboarding-studio` should mirror the `defaultIndex` and
> `variableName` fields on the Carousel UIElement schema and surface them in
> the CMS editor.

---

## [1.20.0] - 2026-05-11

### Added

- **`disabledWhen` on ComposableScreen `Button`** — new optional prop on
  `ButtonElementProps` accepting a `LeafCondition | ConditionGroup` (the
  same schema used by `Branch.condition`). When the condition evaluates
  truthy against current onboarding variables, the button blocks all
  press actions (continue, setVariable, custom) and renders in a disabled
  visual style.
- **`disabledBackgroundColor` and `disabledColor` on `Button`** — optional
  per-button overrides for the disabled-state colors. Defaults fall back to
  `theme.colors.disable` and `theme.colors.text.disable`.
- **`evaluateCondition`, `evaluateLeaf`, `isConditionGroup`, `Condition`**
  now exported from the package root so UI code (and host apps) can reuse
  the same condition runtime that powers branching.

> **Backend note:** `onboarding-studio` should mirror these `Button`
> schema fields and reuse the existing condition-builder UI from the
> `Branch.condition` editor.

---

## [1.19.0] - 2026-05-07

### Added

- **`fontFamily: "inherit"` on ComposableScreen `Text`/`Button`/`Input`** —
  `TextElementProps`, `ButtonElementProps`, and `InputElementProps` now type
  `fontFamily` as `string | "inherit"`. Omitting the prop or passing the
  literal `"inherit"` makes the renderer fall back to
  `theme.typography.defaultFontFamily`. Zod schemas remain
  `z.string().optional()` — the `"inherit"` literal is just a recognised
  string, no migration required for existing payloads.

> **Backend note:** The `onboarding-studio` server should surface
> `"inherit"` (or omission) as a first-class option when authoring
> Text/Button/Input `fontFamily` so CMS users can opt into the host app's
> default font.

---

## [1.18.0] - 2026-05-06

### Added

- **`fontStyle: "normal" | "italic"`** on Text-rendering ComposableScreen
  UIElements. Top-level prop on `TextElementProps`, `ButtonElementProps`,
  `InputElementProps`. Per-item prop `itemFontStyle` on
  `RadioGroupElementProps` and `CheckboxGroupElementProps`. All optional;
  Zod-validated as `z.enum(["normal", "italic"]).optional()`.
- **`setVariable` button action** — `Button.actions` accepts a new entry
  `{ type: "setVariable", name: string, value: string, label?: string }`
  that writes directly into the variable map. Useful to capture which
  branch a user chose before `"continue"` triggers `resolveNextStepNumber`.
  Stored shape matches existing element writes (`{ value, label }`).
- **`OnboardingProgressContext.getVariables()`** — synchronous getter that
  returns the latest variable snapshot from a ref. Use it inside
  `onContinue` handlers to feed `resolveNextStepNumber` with values just
  written by `setVariable`, since React state reads are stale within the
  same tick.

### Fixed

- **Branching with same-tick `setVariable` + `continue`** — variables were
  read from React state in the handler that just wrote them, so branch
  conditions evaluated against pre-set values and fell through to the
  default target. `setVariable` now updates a ref synchronously alongside
  the state setter; `getVariables()` exposes the fresh snapshot.

> **Backend note:** The `onboarding-studio` server must mirror the new
> `fontStyle` (and `itemFontStyle` for RadioGroup/CheckboxGroup) field on the
> affected UIElement schemas, and the new `setVariable` button action variant
> in the `ButtonAction` union and CMS editor.

---

## [1.17.1] - 2026-05-04

### Fixed

- **Runtime fonts manifest** — `registerFonts` now accepts the array shape
  returned by `onboarding-studio`
  (`{ family: [{ weight, style, url }, ...] }`) in addition to the legacy
  `{ family: { weightKey: url } }` map. Previously, iterating an array with
  `Object.entries` produced numeric indices (`"0".."N"`) as weight keys and
  passed the variant object as `url`, causing native expo-font to throw
  `loadSingleFontAsync expected resource of type Asset` and warnings like
  `Failed to load font "X" weight 8 from [object Object]`. The new
  `normalizeFamilyVariants` dedupes by weight and prefers `style: "normal"`
  variants over italic.

### Added

- **`FontVariantEntry`** and **`FontFamilyManifestInput`** exported types.
  `FontsManifest` widened to `Record<string, FontFamilyManifestInput>` so
  array-shape manifests are typed end-to-end.

---

## [1.17.0] - 2026-04-30

### Added

- **Runtime font download + load** — `Onboarding` response now accepts an
  optional top-level `fonts?: FontsManifest` field, where
  `FontsManifest = Record<string, Partial<Record<FontWeightKey, string>>>`.
  Font files are downloaded and registered via `expo-font` (optional peer
  dependency) when the onboarding payload is fetched. `FontWeightKey` accepts
  named (`regular`, `medium`, `semibold`, `bold`, `extrabold`) or numeric
  (`100`…`900`) keys, normalized internally.
- **`OnboardingProvider.fontsFallback?: ReactNode`** — rendered while the
  onboarding payload is fetched and remote fonts are downloading. Defaults to
  `null`.
- **`<FontLoaderGate fonts={...} fallback={...}>`** — standalone gate component
  that registers fonts and exposes a `FontRegistry` via context, for hosts that
  do not use `OnboardingProvider`.
- **`useFontRegistry()`** and **`useResolvedFontFamily(family, weight)`** hooks
  for resolving a `family + weight` request to the registered font name with a
  closest-weight fallback (CSS-style font matching).
- New exports: `FontWeightKey`, `FontFamilyManifest`, `FontsManifest`,
  `FontRegistry`, `registerFonts`, `resolveFontFamily`, `normalizeWeight`,
  `FontRegistryProvider`, `useFontRegistry`, `useResolvedFontFamily`,
  `FontLoaderGate`.

### Changed

- `OnboardingProvider` now wraps children in an internal `OnboardingDataGate`
  (`useQuery`) followed by `FontLoaderGate`, blocking render until the
  onboarding payload is fetched and any declared fonts finish loading. The
  previous `prefetchQuery` call is removed.

> **Backend note:** `onboarding-studio` should mirror the new `Onboarding.fonts`
> field — see the migration prompt in the PR description. ComposableScreen
> UIElement schemas are unchanged; this is an API-level addition.

---

## [1.16.0] - 2026-04-29

### Added

- **`Button.actions` ordered action array** — `ButtonElement.props` now accepts
  `actions?: ButtonAction[]`, where `ButtonAction = "continue" | { type: "custom"; function: string; variables?: string[] }`.
  Actions run sequentially on press; `await`s any returned Promise; aborts the
  remaining chain on a thrown error; `"continue"` is terminal.
- **`OnboardingProvider.customActions` prop** — `Record<string, CustomActionHandler>`
  where `CustomActionHandler = (args: { variables: Record<string, ComposableVariableEntry | undefined> }) => void | Promise<void>`.
  Functions are invoked by name from `Button.actions` `{ type: "custom", function, variables }`,
  receiving the requested variables filtered from the live ComposableScreen
  variable map.
- New exports: `ButtonAction`, `CustomButtonAction`, `ButtonActionSchema`,
  `CustomButtonActionSchema`, `CustomActionHandler`, `CustomActions`,
  `ComposableVariableEntry`.

### Changed

- `Button.action?: "continue"` is now **deprecated** but still accepted as a
  back-compat alias. When `actions` is absent and `action === "continue"`,
  runtime treats it as `actions: ["continue"]`. CMS payloads should migrate to
  `actions`.

> **Backend note:** The `onboarding-studio` server must mirror the new
> `Button.actions` field in its `ComposableScreen` UIElement schema (Zod) and
> CMS editor (ordered list of `"continue"` or
> `{ type: "custom"; function: string; variables?: string[] }`). The legacy
> `action` field should be kept readable for historical payloads.

---

## [1.15.0] - 2026-04-28

### Added

- **`SafeAreaView` UIElement** — new container element mirroring
  `react-native-safe-area-context`'s `SafeAreaView`. Props: `mode?: "padding" | "margin"`,
  `edges?` accepting either `("top" | "right" | "bottom" | "left")[]` or a per-edge
  object mapping each edge to `"off" | "additive" | "maximum"`. Extends `BaseBoxProps`.
  Exports: `SafeAreaViewElementProps`, `SafeAreaEdge`, `SafeAreaEdgeMode`,
  `SafeAreaViewElementPropsSchema`.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> validate the new `"SafeAreaView"` element type in the `ComposableScreen`
> UIElement union. Mirror `SafeAreaViewElementPropsSchema` (with the strict
> per-edge object) in the backend validation layer and add `SafeAreaView` to the
> CMS editor element-type picker. Run the schema-sync/publish process in
> `onboarding-studio` (regenerate Zod schemas, bump validator package, deploy)
> before publishing this SDK release so CI and runtime payloads do not drift.

---

## [1.14.0] - 2026-04-28

### Added

- **`ZStack` UIElement** — new container type that stacks children on top of each
  other using absolute positioning. Props: all `BaseBoxProps` fields (width,
  height, padding, borderRadius, overflow, backgroundGradient, etc.). Children
  fill the container bounds by default, enabling image-with-overlay patterns.
  `ZStackElementProps` and `ZStackElementPropsSchema` exported from the headless
  package.

---

## [1.13.1] - 2026-04-28

### Added

- **`ZStack` UIElement** — new container type that stacks children on top of each
  other using absolute positioning. Props: all `BaseBoxProps` fields (width,
  height, padding, borderRadius, overflow, backgroundGradient, etc.). Children
  fill the container bounds by default, enabling image-with-overlay patterns.
  `ZStackElementProps` and `ZStackElementPropsSchema` exported from the headless
  package.

---

## [1.13.0] - 2026-04-28

### Added

- **`backgroundGradient` on `BaseBoxProps`** — all UIElement types now accept an
  optional `backgroundGradient` prop alongside `backgroundColor`. Accepts a
  `GradientBackground` discriminated union (currently `type: "linear"`).

- **`LinearGradientConfig`** — linear gradient config: `from` and `to` are named
  `GradientEdge` positions (`"top"`, `"bottom"`, `"left"`, `"right"`, `"topLeft"`,
  `"topRight"`, `"bottomLeft"`, `"bottomRight"`); `stops` is an array of
  `{ color: string; position?: number }` (min 2 stops, position 0–1).

- **Exports** — `GradientBackground`, `GradientEdge`, `GradientStop`,
  `LinearGradientConfig`, and `GradientBackgroundSchema` exported from the
  headless package.

---

## [1.12.0] - 2026-04-28

### Added

- **Multi-path branching** — every step schema now includes a `nextStep` field
  (nullable, defaults to `null`). When `null`, navigation proceeds linearly.
  When set, an ordered list of `branches` is evaluated; the first matching branch
  wins and navigation jumps to `branch.targetStepId`. If no branch matches,
  `defaultTargetStepId` is used as a fallback; if that is absent or unresolved,
  linear progression applies.

- **`Branch.condition` nullable** — a `null` condition on a branch is treated as
  unconditional (always matches). Useful as a final catch-all entry after guarded
  branches.

- **Condition schema** — `LeafConditionSchema`, `ConditionGroupSchema`,
  `BranchSchema`, and `NextStepSchema` added to `common.types.ts` and exported
  from the package. Supported operators: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`,
  `contains`, `in`, `not_in`. Conditions nest recursively via `ConditionGroup`
  (`logic: "and" | "or"`, `conditions: Array<LeafCondition | ConditionGroup>`).
  `ConditionValueSchema` accepts `string | number | boolean | Array<string | number | boolean>`.

- **`BaseStepTypeSchema`** — all per-step Zod schemas now extend a single shared
  base (`id`, `name`, `displayProgressHeader`, `customPayload`,
  `continueButtonLabel`, `buttonSection`, `figmaUrl`, `nextStep`) via `.extend()`.
  Previously each schema declared these fields independently.

- **`variableName` on `Question` and `Picker`** — optional `z.string().min(1)`
  field. When set, the answer selected on that step is stored in the global
  variable store under this key and becomes available to branch conditions on
  subsequent steps.

- **Variable store** — `OnboardingProgressContext` gains `variables:
  Record<string, any>` and `setVariable(name, value)`. The store is written by
  the host app's `onContinue` handler and read by `resolveNextStepNumber`.

- **`resolveNextStepNumber(currentStep, variables, steps)`** — new exported pure
  function. Returns the 1-indexed step number to navigate to, or `null` when the
  flow ends. Resolution order: matching branch → `defaultTargetStepId` → linear
  next → `null`. Self-referencing targets (branch or default pointing back to the
  current step) are silently skipped to prevent infinite-loop routing.

- **`evaluateCondition` module** — pure condition-evaluation logic extracted to
  `src/evaluateCondition.ts` with no domain dependencies. Exports
  `evaluateLeaf`, `evaluateCondition`, `isConditionGroup`, and the `Condition`
  type.

- **Test suite** — Vitest added as a dev dependency. 75 tests across
  `evaluateCondition.test.ts` and `resolveNextStepNumber.test.ts` covering all
  operators, AND/OR nesting up to 3 levels, branch ordering, unconditional
  branches, `defaultTargetStepId` fallback, self-loop guard, and edge cases.

### Changed

- `NextStepSchema.branches` now defaults to `[]` — omitting `branches` from a
  `nextStep` object is valid; callers can set only `defaultTargetStepId`.

---

## [1.11.1] - 2026-04-27

### Changed

- **`BaseBoxProps` expanded** — all UIElement schemas now inherit `minWidth`,
  `maxWidth`, `minHeight`, `maxHeight`, `flexShrink`, `flexGrow`, `backgroundColor`,
  and `overflow` from the base. Previously these were missing or inconsistently
  defined per element.

- **`StackElement` (`YStack` / `XStack`) props** — now correctly extends
  `BaseBoxProps` instead of declaring `width`/`height` as number-only standalone
  fields. `width` and `height` now accept `number | string` (e.g. `"100%"`).
  Stack-specific props retained: `gap`, `alignItems`, `justifyContent`, `flexWrap`.

- **`TextElement` props** — now correctly extends `BaseBoxProps` instead of
  duplicating margin/padding/border fields. Text-specific props retained: `content`,
  `mode`, `fontSize`, `fontWeight`, `fontFamily`, `color`, `textAlign`,
  `letterSpacing`, `lineHeight`.

- **`InputElement` props** — added `fontFamily`, `lineHeight`, `letterSpacing`.

- **`ButtonElement` props** — removed redundant `alignSelf` override (now inherited
  from `BaseBoxProps` with the full enum).

- **`RiveElement` props** — renamed `autoplay` → `autoPlay` (consistent casing with
  all other elements).

- **`CarouselElement` props** — added dot style props: `dotColor`, `activeDotColor`,
  `dotWidth` (default `20`), `dotHeight` (default `4`), `dotsGap` (default `8`),
  `dotsMarginTop` (default `12`).

---

## [1.11.0] - 2026-04-24

### Added

- **`Carousel` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Carousel"`. Takes `children: UIElement[]` — any renderable
  UIElement tree as slide content (same recursive system as `YStack`/`XStack`).
  Props: `carouselType` (`"normal"` | `"left-align"` | `"parallax"` | `"stack"`,
  default `"normal"`), `autoPlay` (boolean, default `false`), `autoPlayInterval`
  (number ms, default `3000`), `loop` (boolean, default `true`), `showDots`
  (boolean, default `true`), `height` (number, optional), plus all `BaseBoxProps`.
  Validated by `CarouselElementPropsSchema` (Zod). Exports `CarouselElementProps`
  type.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `Carousel` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `CarouselElementPropsSchema` in the backend validation layer and add `Carousel`
> to the CMS element-type picker.

---

## [1.10.0] - 2026-04-23

### Added

- **`DatePicker` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "DatePicker"`. Props: `variableName` (string, optional — context
  key; selected date written as ISO 8601 string), `defaultValue` (ISO string, optional),
  `minimumDate` / `maximumDate` (ISO strings, optional), `mode`
  (`"date"` | `"time"` | `"datetime"`, default `"date"`), `display`
  (`"default"` | `"spinner"` | `"calendar"` | `"clock"` | `"compact"` | `"inline"`,
  optional — platform-specific), `textColor`, `accentColor`, `locale` (strings,
  optional), plus all `BaseBoxProps`. Validated by `DatePickerElementPropsSchema` (Zod).

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `DatePicker` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `DatePickerElementPropsSchema` in the backend validation layer and add `DatePicker`
> to the CMS element-type picker.

---

## [1.9.0] - 2026-04-22

### Added

- **`CheckboxGroup` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "CheckboxGroup"`. Props: `variableName` (string, optional —
  context key; selected values written as a JSON `string[]`), `items`
  (`Array<{ label: string; value: string }>`, required, min 1), `defaultValues`
  (`string[]`, optional — must reference valid item values), `gap` (number),
  `direction` (`"vertical"` | `"horizontal"`), per-item styling
  (`itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`,
  `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`, `itemColor`,
  `itemSelectedColor`, `itemFontSize`, `itemFontWeight`, `itemFontFamily`,
  `itemPadding`, `itemPaddingHorizontal`, `itemPaddingVertical`), plus all
  `BaseBoxProps`. Validated by `CheckboxGroupElementPropsSchema` (Zod); includes
  `superRefine` checks for unique item values and valid `defaultValues` entries
  (per-index error paths).

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `CheckboxGroup` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `CheckboxGroupElementPropsSchema` in the backend validation layer and add `CheckboxGroup`
> to the CMS element-type picker.

---

## [1.8.1] - 2026-04-22

### Added

- **`alignSelf` prop on `BaseBoxProps`** — available on all elements that extend `BaseBoxProps` (`Input`, `RadioGroup`, `Image`, `Lottie`, `Rive`, `Icon`, `Video`). Accepts `"auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline"`.

### Changed

- **`alignSelf` on `StackElement`** — `StackElementProps` and `StackElementPropsSchema` now include `alignSelf` (same enum) in addition to the existing `alignItems`.

---

## [1.8.0] - 2026-04-21

### Added

- **`Button` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Button"`. Props: `label` (string, **required**, non-empty),
  `action` (`"continue"`, optional — defaults to calling `onContinue`), `variant`
  (`"filled"` | `"outlined"` | `"ghost"`), `backgroundColor`, `color`, `fontSize`,
  `fontWeight`, `fontFamily`, `textAlign`, `alignSelf`, plus all `BaseBoxProps`.
  Validated by `ButtonElementPropsSchema` (Zod).
- **`RadioGroup` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "RadioGroup"`. Renders a group of radio options from an inline
  `items: Array<{ label: string; value: string }>` array. Props: `variableName`
  (string, optional — context key), `defaultValue`, `gap`, `direction`
  (`"vertical"` | `"horizontal"`), all `BaseBoxProps`, and per-item styling
  (`itemBackgroundColor`, `itemSelectedBackgroundColor`, `itemBorderColor`,
  `itemSelectedBorderColor`, `itemBorderRadius`, `itemBorderWidth`, `itemColor`,
  `itemSelectedColor`, `itemFontSize`, `itemFontWeight`, `itemFontFamily`,
  `itemPadding`, `itemPaddingHorizontal`, `itemPaddingVertical`). Validated by
  `RadioGroupElementPropsSchema` (Zod).
- **Structured variable entries** — `ComposableVariableEntry` type introduced:
  `{ value: string; label?: string }`. The `composableVariables` context map is now
  `Record<string, ComposableVariableEntry>` instead of `Record<string, string>`.
  `RadioGroup` writes both `value` (raw) and `label` (human-readable) when an item
  is selected. Expression interpolation in `Text` elements resolves `label` first,
  falling back to `value`.

> **Note on semver:** The `composableVariables` type changed from
> `Record<string, string>` to `Record<string, ComposableVariableEntry>`. This is
> published as a minor bump (not major) because `composableVariables` is an internal
> context value not part of the public API contract. Existing consumers remain
> unaffected — access `.value` on the entry for the same string result.

### Changed (internal)

- `ComposableScreen` element types and Zod schemas split into `elements/` subfolder —
  one file per element type. `types.ts` now assembles the `UIElement` union and
  `UIElementSchema` by importing individual schemas.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `RadioGroup` `UIElement` variant in `ComposableScreen` payloads. Mirror
> `RadioGroupElementPropsSchema` in the backend validation layer and add `RadioGroup`
> to the CMS element-type picker.

---

## [1.7.0] - 2026-04-21

### Added

- **`fontFamily` prop on `Text` UIElement** — optional `fontFamily?: string` added
  to the `Text` variant of `UIElement` and to `TextElementPropsSchema` (Zod).
  Pass any font family name loaded via `expo-font` (or a system font) to apply a
  custom typeface to a text node.

> **Backend note:** The `onboarding-studio` server should be updated to accept
> and emit `fontFamily` on `Text` UIElement props, and to expose a font-family
> input in the CMS text-element editor.

---

## [1.6.0] - 2026-04-21

### Added

- **`Input` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Input"`. Renders a `<TextInput>` that writes its value
  into shared context via `variableName`. Props: `variableName` (string, optional
  — context key), `placeholder`, `placeholderColor`, `defaultValue`,
  `keyboardType`, `returnKeyType`, `autoCapitalize`, `secureTextEntry`,
  `maxLength`, `multiline`, `numberOfLines`, `editable`, plus typography and
  layout props (`color`, `fontSize`, `textAlign`, `padding*`) and all
  `BaseBoxProps` (`backgroundColor`, `borderWidth`, `borderRadius`, `borderColor`,
  `width`, `height`, `opacity`, `margin*`). Validated by
  `InputElementPropsSchema` (Zod).
- **Variable context** — `OnboardingProgressContext` now holds
  `composableVariables: Record<string, string>` and `setComposableVariable`.
  Values written by `Input` elements survive navigation between
  `ComposableScreen` steps.
- **Expression mode for `Text` elements** — `mode?: "plain" | "expression"`
  prop added to `TextElementPropsSchema`. When `"expression"`, `{{variableName}}`
  patterns in `content` are interpolated from `composableVariables` at render
  time. Default (`"plain"`) is unchanged.

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit the `Input` `UIElement` variant in `ComposableScreen` payloads, and to
> support the `mode` prop on `Text` elements. Mirror `InputElementPropsSchema`
> and the updated `TextElementPropsSchema` in the backend validation layer and
> add `Input` to the CMS element-type picker.

---

## [1.5.0] - 2026-04-21

### Added

- **`Icon` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Icon"`. Props: `name` (string, **required** — Lucide icon
  name), `size` (number), `color` (string), `strokeWidth` (number), plus all
  `BaseBoxProps`. Validated by `IconElementPropsSchema` (Zod).
- **`Video` UIElement schema** for `ComposableScreen` — new discriminated-union
  variant with `type: "Video"`. Props: `url` (string, **required**), `autoPlay`
  (boolean), `loop` (boolean), `muted` (boolean), `controls` (boolean), plus all
  `BaseBoxProps`. Validated by `VideoElementPropsSchema` (Zod).

> **Backend note:** The `onboarding-studio` server must be updated to accept and
> emit `Icon` and `Video` `UIElement` variants in `ComposableScreen` payloads.
> Mirror `IconElementPropsSchema` and `VideoElementPropsSchema` in the backend
> validation layer and add both types to the CMS element-type picker.

---

## [1.4.0] - 2026-04-21

### Added

- **`Lottie` UIElement** for `ComposableScreen` — renders a Lottie animation
  from a remote JSON URL via `lottie-react-native` (optional peer dep). Supports
  `source` (required), `autoPlay`, `loop`, `speed`, and all `BaseBoxProps`
  (`width`, `height`, `opacity`, `margin*`, `padding*`, `border*`).
- **`Rive` UIElement** for `ComposableScreen` — renders a Rive animation from a
  remote `.riv` URL via `rive-react-native` (optional peer dep). Supports `url`
  (required), `autoplay`, `fit`, `alignment`, `artboardName`,
  `stateMachineName`, and all `BaseBoxProps`.

### Changed

- **`BaseBoxProps` refactor** — `width`, `height`, `opacity`, `margin*`,
  `padding*`, `borderWidth`, `borderRadius`, and `borderColor` are now defined
  once in a shared `BaseBoxProps` type and `BaseBoxPropsSchema`, then extended by
  `Image`, `Lottie`, and `Rive` element schemas. Stack and Text schemas are
  unchanged.

---

## [1.3.0] - 2026-04-17

### Added

- **`Image` UIElement** for `ComposableScreen` — renders a remote image via
  React Native `<Image>`. Supports `url` (required), `width`, `height`,
  `aspectRatio`, `resizeMode` (`cover` | `contain` | `stretch` | `center`),
  `borderRadius`, `borderWidth`, `borderColor`, `opacity`, and all margin /
  padding shorthand props.
- `aspectRatio` prop on `Image` elements — applied as a size fallback when
  `height` is omitted; defaults to `16/9` so images never collapse to zero
  height.

---

## [1.2.0]

### Added

- **ComposableScreen** _(under development)_ — new step type that defines a
  declarative UI element tree (`YStack`, `XStack`, `Text`) driven entirely from
  the CMS. The `UIElement` type and its Zod schema now support the following
  props on stack elements: `borderWidth`, `borderRadius`, `borderColor`,
  `overflow`, `opacity`, `margin`, `marginHorizontal`, `marginVertical`,
  `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`. Text
  elements gain `margin`, `marginHorizontal`, `marginVertical`, `borderWidth`,
  `borderRadius`, `borderColor`, and `opacity`.

> **Note:** `ComposableScreen` is under active development. The schema may
> change before it is considered stable.
