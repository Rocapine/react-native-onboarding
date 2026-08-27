# User properties + `register()` — design

**Status:** approved 2026-08-27
**Scope:** `@rocapine/react-native-onboarding` (headless) only. No studio, edge-function,
migration or `-ui` change.

## 1. What this builds

Two things, one of which mostly exists already:

1. **A user-property store** — a mutable, persisted `key: value` map that feeds the
   `moments → audiences → paywalls` resolution. Today the same map exists as a *static
   prop* (`customAudienceParams`) passed separately to two providers.
2. **`register(moment, feature)`** — Superwall's `registerPlacement` shape, expressed in
   this SDK's vocabulary: call it at a feature entry point, and it either runs the feature
   or shows the moment's paywall and runs the feature only on a purchase.

Explicitly **out of scope**: entitlements. `register()` gates on the moment alone. A
subscriber is excluded by authoring an audience filter against a user property the host
sets (e.g. `plan: "pro"`), not by an SDK-held entitlement. This was considered and
deliberately dropped — see §9.

## 2. Why the store is not new plumbing

`customAudienceParams?: Record<string, any>` is already a prop on **both**
`PaywallProvider` and `OnboardingProvider`. It already becomes the querystring on
`get-paywalls` / `get-onboarding-steps`, and it already *is* the json-logic data the
audience waterfall evaluates (`buildAudienceData` → `matchAudience` in the studio's
`supabase/shared/resolveAudience.ts`).

So the delta is narrow and specific:

| Today | After |
|---|---|
| Static, fixed at provider mount | Mutable at any time, from anywhere |
| Two independent props, two sources of truth | One store both providers read |
| Lost on every cold launch | Persisted, hydrated before the first fetch |
| React-only (a prop) | Writable from non-React code |
| Any key name accepted | Reserved names rejected (§4) |

Nothing about the wire format, the edge functions, or audience authoring changes.

## 3. The store

`packages/onboarding/src/userProperties/`

```ts
export type UserPropertyValue = string | number | boolean;
export type UserProperties = Record<string, UserPropertyValue>;
/** What `set` accepts: `null`/`undefined` for a key means "delete it". */
export type UserPropertyPatch = Record<string, UserPropertyValue | null | undefined>;

userProperties.set({ plan: "free", daysSinceInstall: 3 });  // shallow MERGE
userProperties.set({ plan: null });                          // null deletes the key
userProperties.remove("plan");
userProperties.reset();                                      // clears memory + disk
userProperties.get(): UserProperties;
userProperties.subscribe(listener): () => void;
userProperties.ensureHydrated(): Promise<void>;              // idempotent
useUserProperties(): { properties: UserProperties; status: "hydrating" | "ready" };
```

### 3.1 A module singleton, not a context

The store is created once at module scope and exported as `userProperties`, with
`useUserProperties()` subscribing through `useSyncExternalStore`.

This is the one place the design deliberately departs from how everything else in this
package is wired (provider + context). The reason is the ergonomics the feature exists
for: properties are set from a login handler, an analytics service, a push-token
callback — code that is not a React component and has no access to a hook. Superwall's
own API is a singleton (`Superwall.shared.setUserAttributes`) for exactly this reason.

The secondary reason is that a singleton *removes* a source of truth rather than adding
one: with two providers each holding their own `customAudienceParams` prop, an onboarding
audience and a paywall audience can silently disagree about the same user. One store
makes that impossible by construction.

### 3.2 Merge, not replace

`set` merges shallowly. Replacing wholesale is the wrong default here because the writers
are independent: an auth handler that knows `plan` must not clobber the analytics
handler's `daysSinceInstall`. `null` (or `undefined`) as a value deletes that key, which
is how Superwall's attribute API behaves and what a caller reaching for "unset this"
naturally writes. `reset()` exists for logout.

### 3.3 Values, and what happens to them on the wire

`UserPropertyValue` is `string | number | boolean` — deliberately not `any`, which is what
`customAudienceParams` is typed as today.

Everything crosses the wire as a **string**: `OnboardingStudioClient` builds a
`URLSearchParams`, and the edge function reads
`Object.fromEntries(url.searchParams.entries())`, a `Record<string, string>`. Serialization
is therefore explicit and total:

- `string` → as-is
- `number` → `String(n)`; a non-finite number (`NaN`, `Infinity`) is rejected with a warning
  rather than serialized as `"NaN"`, which would silently match nothing
- `boolean` → `"true"` / `"false"`

**How this behaves in a json-logic filter.** The studio authors the comparison literal, and
in the normal authoring shape that literal is a number:
`{">=": [{"var": "daysSinceInstall"}, 3]}`. `json-logic-js` applies JS `>=`, so `"3" >= 3`
coerces numerically and is `true`. The case to be aware of is a filter whose literal is
itself a *string* — `{">": [{"var": "day"}, "9"]}` compares lexicographically, so `"10"` is
not greater than `"9"`. That is a pre-existing property of the wire format, not something
this change introduces, but it is now much easier to hit because numbers are now a
first-class value type. Documented in the README and in the store's module doc.

The existing server-side `convertVersionsInObject` continues to handle
version-shaped strings (`"1.2.3"`) untouched.

### 3.4 Persistence

Every mutation writes the whole map to AsyncStorage (coalesced into one write per tick, so
a burst of `set` calls costs one write). Hydration happens once, lazily, on the first
`ensureHydrated()` — never at module import, so importing the SDK has no I/O side effect.

**Storage key: the single constant `"rocapine-user-properties"`.** It is deliberately *not*
namespaced by `client.options.cacheKey`, unlike the payload caches. `cacheKey` exists to
pin a *payload version*; user properties describe the *user*, which has nothing to do with
which payload version the host wants pinned. Deriving the key from `cacheKey` would also
force the store to learn about a client before it could hydrate, reintroducing exactly the
ordering problem §3.5 exists to remove.

### 3.5 The cold-launch race, and how hydration closes it

The problem: `PaywallProvider`'s query fires on mount. If the host has not set properties
yet, that request carries an empty map, matches the catch-all audience, and — because the
catalog is cached with `staleTime: Infinity` — that wrong answer is what the session uses.

The fix: both providers `await userProperties.ensureHydrated()` before their query is
enabled (`enabled: status === "ready"`). A returning user's very first fetch of the launch
already carries their properties, with no host code at all.

What this does **not** fix, stated plainly: a first-ever install has nothing on disk, so its
first fetch is genuinely empty and matches the catch-all. A `set()` immediately afterwards
changes the query key and react-query refetches, so the user is targeted correctly within
that same launch — one wasted request, no wrong-audience session. A host that needs
first-install correctness sets properties before mounting the provider.

Cost of the gate: one AsyncStorage read (single-digit ms) before the first fetch.
`OnboardingProvider` renders `fontsFallback` during it — the state it already renders while
its payload loads — so nothing new appears on screen.

## 4. Reserved keys

`set` drops these names with a `console.warn` naming the key:

```
projectId, platform, appVersion, draft, locale, omitNulls, moment, now
```

`moment` and `now` mirror the server's existing `RESERVED_AUDIENCE_VARS`, which strips them
because they are server-owned (a client supplying `now` is self-selecting into a time-gated
audience).

The other six close a collision that is **live today and currently unreachable only because
nobody hand-writes these key names into `customAudienceParams`**. `OnboardingStudioClient`
appends user params *first*, then its own:

```ts
Object.entries(userDefinedParams).forEach(([k, v]) => urlParams.append(k, v));
urlParams.append("projectId", this.projectId);
urlParams.append("platform", Platform.OS);
// ... appVersion, draft, locale, moment
```

`URLSearchParams.append` permits duplicates, and the two readers disagree about which wins:

- `url.searchParams.get("projectId")` returns the **first** occurrence — the user's value.
  The edge function resolves the wrong project, or 400s.
- `Object.fromEntries(url.searchParams.entries())` is **last-wins** — so the json-logic data
  still contains the real `projectId`.

The result is a request that fails or resolves against another project, with no diagnostic
pointing at the property that caused it. A store whose whole purpose is to let a host name
keys freely makes this a plausible accident, so the store is where it gets refused.

Rejecting (rather than prefixing or escaping) keeps the wire format unchanged and the
failure loud at the call site that caused it.

## 5. Wiring into the providers

Both `PaywallProvider` and `OnboardingProvider`:

1. call `userProperties.ensureHydrated()` and subscribe via `useUserProperties()`
2. resolve the effective params as `{ ...customAudienceParams, ...storeProperties }`
3. pass that merged map where they pass `customAudienceParams` today
4. gate their query on `status === "ready"`

**Precedence: the store wins per key.** `customAudienceParams` becomes a *static baseline* —
build-time facts (`onboardingId`, a build channel) that a host sets once as a prop — and the
store carries what changes at runtime. A runtime value losing to a mount-time prop would
make the store useless for the case it exists for.

`customAudienceParams` is **not deprecated and not removed**: every existing host keeps
working with no change, which is the point of merging rather than replacing.

## 6. The disk-cache scoping fix

This is not optional polish; the feature is unsafe without it.

`getPaywallsCacheKey` / `getOnboardingCacheKey` derive an AsyncStorage key from
`cacheKey` alone. The react-query key *is* scoped by params; the disk key is a bare
constant. So in production the cache-first read can serve a catalog resolved under
**different** params, non-null and therefore indistinguishable from a correct one, with a
fresh fetch in flight behind it.

This has already been observed: an audience gated on `hoursSinceOnboardingPaywall >= 44`
was served the pre-threshold catalog on the launch where the user first became eligible —
the arm under test lost exactly the launch that mattered. Today that needs volatile params
to trigger, which is rare. **Mutable properties make volatile params the normal case.**

The fix: both key helpers take the resolved params and append a stable hash.

```ts
getPaywallsCacheKey(customKey?: string, paramsHash?: string): string
// "rocapine-paywalls-studio"            -> unchanged when no params
// "rocapine-paywalls-studio-7f3a1c92"   -> params present
```

The hash is computed over `key=value` pairs **sorted by key**, joined, then djb2 — so
`{a:1,b:2}` and `{b:2,a:1}` produce the same key. (Insertion order differing between a
persisted map and a freshly-merged one is otherwise a guaranteed spurious cache miss.)

Two consequences to handle rather than discover:

- **Pre-existing unscoped keys are orphaned.** They are never read again and never written
  again. Not deleted eagerly — a migration sweep would cost a `getAllKeys()` on every cold
  launch to reclaim a few KB once. Left to `clearCache()`.
- **`clearCache()` can no longer name its keys.** It becomes `getAllKeys()` filtered by the
  `rocapine-paywalls-*` / `rocapine-onboarding-*` prefixes, so it clears every params
  variant plus the orphans. This is a behaviour *improvement*: today it misses any key but
  the current one.

`"revalidating"` becomes trustworthy as a result. Before this fix, a revalidating catalog
might be a *wrong-params* catalog; after it, a served catalog always matches the current
params and a revalidation is a genuine freshness refresh. §7 relies on that.

## 7. `register(moment, feature)`

```ts
const { register } = usePaywall();

await register("unlock_stats", () => router.push("/stats"));
```

### 7.1 Decision

A pure function, extracted the way `resolvePresentDecision` and
`shouldAdvanceOnComplete` already are in this package, so every branch is covered by an
importable test rather than by inspection:

```ts
export type RegisterDecision =
  | { type: "run"; reason: "no-paywall" | "catalog-unavailable" }
  | { type: "present"; paywall: Paywall }
  | { type: "wait" };

resolveRegisterDecision(
  catalog: PaywallCatalog | null,
  catalogStatus: CatalogStatus,
  moment: string,
): RegisterDecision;
```

| State | Decision | Why |
|---|---|---|
| catalog has `moment` | `present` | the normal path |
| catalog resolved, no `moment` | `run` / `no-paywall` | the moment is not monetised (or is not authored yet) — the feature is free |
| catalog `null`, status `"error"` | `run` / `catalog-unavailable` | fail open, §7.3 |
| catalog `null`, status `"loading"` | `wait` | §7.2 — the caller awaits the catalog settling, then calls this again |
| status `"revalidating"` | treated as usable (`present` / `no-paywall`) | safe only because of §6 |

`wait` is a decision rather than something the caller infers from `catalogStatus` itself, so
"when may `register` block?" has exactly one answer, in one tested function. The caller
re-invokes after the wait and is guaranteed a non-`wait` decision the second time: the wait
resolves only on `"ready"` / `"error"`, and on timeout the caller treats it as
`catalog-unavailable` without asking again.

### 7.2 Waiting

`register` is called on a user tap, so it cannot simply fail when the catalog has not
landed yet. It awaits the catalog settling (`"ready"` / `"error"`) up to
`registerTimeoutMs` — a `PaywallProvider` prop defaulting to **3000 ms** — then decides
against whatever state it has. In practice a returning user's catalog is already on disk,
so this rarely elapses at all.

### 7.3 Failing open

When the verdict is genuinely unavailable — no catalog and the fetch failed, or the wait
timed out — `register` **runs the feature** and emits a `console.warn` naming the moment.

The alternative locks every gated feature behind a network call: an offline launch would
make the app's features silently dead, with no paywall on screen to explain why, which is
indistinguishable from a broken app. Superwall's own default is the same. The accepted cost
is stated plainly: some sessions get a paid feature for free.

### 7.4 Running the feature

`register` delegates to the existing `present()` — it does not reimplement presentation.
That means the wedge recovery (`shouldBreakPresentationWedge`), the purchase-generation
race guard (`shouldRecordPurchaseOutcome`) and outcome reconciliation
(`resolvePresentedOutcome`) all apply unchanged.

The feature runs iff the resolved outcome is `"purchased"`:

```ts
export const shouldRunFeature = (outcome: PresentResult): boolean =>
  outcome.status === "purchased";
```

This is correct *because* `resolvePresentedOutcome` already upgrades the generic
`{status:"dismissed"}` that a `{type:"purchase", onSuccess:[{type:"dismiss"}]}` action
list produces into `"purchased"` when the store actually charged. Without that upgrade this
one-liner would refuse the feature to every user who bought through the canonical authoring
shape.

**A `"pending"` outcome does not run the feature**, which is the same trap the `Paywall`
onboarding step carries: a Stripe paywall resolves `pending`, never `purchased`, because the
entitlement arrives out-of-band through RevenueCat. So `register()` against a Stripe-billed
moment never runs its feature on the strength of the purchase alone. Called out in the
README and warned about at runtime when a presented paywall has `billing: "stripe"`.

### 7.5 Result

```ts
export type RegisterResult =
  | { ran: true;  presented: false; reason: "no-paywall" | "catalog-unavailable" }
  | { ran: true;  presented: true;  reason: "purchased";     outcome: PresentResult }
  | { ran: false; presented: true;  reason: "not-purchased"; outcome: PresentResult };
```

Returned rather than fire-and-forget so a host can log how often it ran ungated —
`reason: "catalog-unavailable"` is the rate at which §7.3 is giving features away, and a
host that cannot measure that cannot decide whether the default is right for them.

`already-presenting` needs no branch of its own: `present()` resolves
`{status:"error", reason:"already-presenting"}`, which is `not-purchased`, so the feature
does not run and the in-flight paywall is untouched.

## 8. Testing

vitest, in-repo. No new harness.

- **store**: merge semantics; `null` deletes; `remove`/`reset`; each reserved key rejected
  with the value left absent; non-finite number rejected; subscribers notified once per
  mutation batch
- **serialization**: `string`/`number`/`boolean` → expected strings
- **params hash**: stable under key reordering; differs when any value differs; absent
  params leave the legacy key byte-identical (so existing installs are not invalidated
  gratuitously)
- **hydration ordering**: query stays disabled until hydration resolves; a mutation during
  hydration is not lost
- **`resolveRegisterDecision`**: all five rows of §7.1's table
- **`shouldRunFeature`**: `purchased` true; `dismissed` / `cancelled` / `pending` / `error`
  false
- **`clearCache`**: removes every prefixed key including an orphaned unscoped one

## 9. Rejected alternatives

- **Entitlement gating in `register()`** (Superwall's actual semantics). Designed, then
  dropped on the user's call. It needs an entitlement source the SDK does not have —
  entitlements exist here only as a transient `string[]` inside a `purchase()`/`restore()`
  result, never stored — so it meant a new `PaywallProvider` prop and a "status unknown yet"
  state on a monetisation path. Excluding subscribers via an audience filter on a user
  property covers the common case with machinery that already exists. Revisit when a real
  host needs per-tier gating.
- **A `required_entitlement` column on `moments`.** Puts the gate where the non-engineer
  works, but is a migration + studio UI + wire change + types sync — outside "in the SDK".
- **An explicit `markPropertiesReady()` gate** instead of persistence. Correct on a first
  install too, but a host that forgets the call never fetches a catalog at all: paywalls
  stop appearing, silently, forever. This repo has been bitten by that class of failure
  repeatedly.
- **Store replaces `customAudienceParams`.** Breaking, for no gain — merging with the store
  winning per key subsumes it.
- **Store as a provider prop / context.** Keeps the package's existing pattern but defeats
  the purpose: the writers are mostly not components.
