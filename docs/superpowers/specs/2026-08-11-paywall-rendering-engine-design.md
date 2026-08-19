# Paywalls in Onboarding Studio — Design

Date: 2026-08-11
Status: Approved design, ready for implementation planning
Repos: `react-native-onboarding` (SDK: `packages/onboarding`, `packages/onboarding-ui`),
`onboarding-studio` (CMS: Expo app + Supabase edge functions + Postgres)

---

## 1. Goal

Onboarding Studio today authors **onboarding flows**. This design adds **paywalls**
as a first-class thing the studio authors and the SDK renders, reusing the
existing ComposableScreen rendering engine rather than building a second one.

Three deliverables, in dependency order:

1. Extract the rendering engine so it serves both onboarding steps and paywall
   screens.
2. A studio API for paywalls + linked products, and an SDK client for it.
3. Product metadata (price, currency, period, trial) resolved from the stores at
   runtime, never from the CMS.

## 2. Decisions

These were settled during design and are not open questions:

| Decision | Choice | Consequence |
|---|---|---|
| Domain model | Paywalls are a **standalone entity, addressed by `placement`** | Own table, own publish path, own audience targeting. Not nested inside an onboarding. |
| Runtime purchase source | **Vendor-neutral `ProductProvider`, with a RevenueCat adapter shipped** | No hard peer dep. Mirrors the existing `OnboardingNavigationAdapter` DI precedent. |
| Studio product catalog | **Manual product IDs in v1**; Publishing Platform sync later | `project_products.source` column is the seam. No schema churn when sync lands. |
| Engine extraction | **Generalize in place**, no new npm packages | Internal `Runtime/` boundary inside the existing two packages. |
| Product → pixels | **Products injected as variables, consumed by interpolation** | Zero new element types. |
| Paywall targeting / A/B | **Reuse the existing audiences waterfall** | New `audiences_paywalls` join, same `pickWeighted` helper. |
| Catalog fetch | **Prefetch every placement at launch**, cached | A paywall renders instantly on tap; no network round-trip at the moment of intent. |

### 2.1 Relationship to `harmony-plans/ws-b-actions.md`

That (unimplemented) studio-side plan specced `presentPaywall` as a
**vendor-delegating** action — the SDK hands off to Superwall. This design
supersedes that arm: `presentPaywall { placement }` now opens a
Rocapine-authored paywall. The rest of ws-b's action catalog
(`requestHealthSync`, `restorePurchase`, `openURL`, …) is unaffected and
compatible; `restorePurchase` is absorbed here as `restore`.

### 2.2 Why runtime prices, always

App Review rejects paywalls whose displayed price differs from what StoreKit
charges. Prices are per-territory, change without notice, and vary by offer
eligibility. Therefore **no code path in this design renders a price that came
from the CMS.** The studio stores product *identifiers* and display *roles*; the
device resolves everything else. `project_products.indicative_price` exists
solely to make the studio's editor preview non-empty and is never shipped to a
device.

---

## 3. Part 1 — Engine extraction (SDK)

### 3.1 Current coupling

`packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx` is the only
onboarding-aware part of the engine. It depends on exactly four things:

1. `useOnboardingHeaderHeight()` (headless) — keyboard offset.
2. `OnboardingProgressContext` (headless) — `setVariable`, `customActions`.
3. `OnboardingProgressContext` (UI provider) — `composableVariables`,
   `setComposableVariable`.
4. `OnboardingTemplate` — safe area + progress-header top inset.

Plus one semantic coupling inside the engine: `runActions`' `"continue"` arm
calls `ctx.onContinue`, meaning "advance the onboarding".

Everything else — all ~26 element renderers, `renderElement.tsx`,
`expression.ts`, `evaluateCondition`, `collectDefaults.ts`, `buildAnimation.ts`
— is already screen-agnostic.

### 3.2 The seam: `ScreenHost`

A single injected interface replaces all four couplings.

```ts
// packages/onboarding-ui/src/UI/Runtime/ScreenHost.ts
export type ScreenHost = {
  /** Advance / finish. Onboarding → next step. Paywall → resolve the placement. */
  complete: (result?: unknown) => void;
  /** Variable bag, owned by the host. */
  variables: Record<string, ComposableVariableEntry>;
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  /** Top inset the host reserves (measured progress bar | 0 for a paywall). */
  topInset: number;
  customActions: CustomActions;
  /** Present only on paywall hosts. Undefined inside an onboarding step. */
  products?: ProductRuntime;
};

export const ScreenHostContext = React.createContext<ScreenHost>(noopHost);
```

`RenderContext` (in `elements/shared.ts`) gains `host: ScreenHost` and loses
`onContinue`. `runActions`' `"continue"` arm calls `ctx.host.complete()` —
semantically identical for onboarding.

### 3.3 File moves

**Headless (`packages/onboarding/src/`)**

| From | To |
|---|---|
| `steps/ComposableScreen/elements/*` | `screens/elements/*` |
| `steps/ComposableScreen/types.ts` (UIElement union + schemas) | `screens/types.ts` |

`steps/ComposableScreen/types.ts` remains, now thin: it composes
`BaseStepTypeSchema` with `payload.elements` and **re-exports everything from
`screens/`** so every current import path keeps working.

**UI (`packages/onboarding-ui/src/`)**

| From | To |
|---|---|
| `UI/Pages/ComposableScreen/elements/*` | `UI/Runtime/elements/*` |
| — (new) | `UI/Runtime/ScreenRenderer.tsx` |
| — (new) | `UI/Runtime/ScreenHost.ts` |
| — (new) | `UI/Paywall/PaywallRenderer.tsx` |

`UI/Pages/ComposableScreen/Renderer.tsx` shrinks to an adapter: build a
`ScreenHost` from the onboarding contexts, wrap in `OnboardingTemplate`, render
`<ScreenRenderer elements={...} host={...} />`.

`UI/Paywall/PaywallRenderer.tsx` is the sibling adapter: build a `ScreenHost`
from the paywall contexts (including `products`), no `OnboardingTemplate`,
render the same `<ScreenRenderer>`.

### 3.4 Back-compat contract

Every moved module is re-exported from its old path. `packages/*/src/index.ts`
public exports are unchanged and additive only. No host app and no studio import
breaks. This is a non-breaking minor release of both packages.

### 3.5 Documentation to update in the same change

`.claude/rules/composable-screen-runtime.md` and `.claude/rules/page-renderers.md`
reference `Pages/ComposableScreen/elements/*` paths throughout. Both must be
rewritten to the `Runtime/elements/*` paths as part of the move, or every future
agent session is routed to files that no longer exist. Same for the four
`claude-plugin/skills/*/SKILL.md` files and `website/docs/page-types.mdx`.

---

## 4. Part 2 — Product runtime (SDK headless)

### 4.1 Types

```ts
export type ProductRef = {
  key: string;        // author-chosen slot name, e.g. "yearly"
  ios?: string;       // "com.app.yearly"
  android?: string;   // "com.app.yearly:p1y"  (productId:basePlanId)
};

export type ResolvedProduct = {
  key: string;
  productId: string;                 // resolved for THIS platform
  store: "app_store" | "play_store";
  title: string;
  description: string;
  price: string;                     // store-localized, e.g. "$59.99"
  priceAmount: number;               // 59.99
  currencyCode: string;              // "USD"
  period: "week" | "month" | "year" | "lifetime" | null;
  periodCount: number;               // 1
  periodIso: string | null;          // "P1Y"
  introOffer?: {
    price: string; priceAmount: number;
    period: string; periodCount: number; cycles: number;
  };
  trial?: { period: string; periodCount: number; days: number };
};

export type PurchaseResult =
  | { status: "purchased"; productKey: string; entitlements?: string[] }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error"; error: Error };

export type RestoreResult =
  | { status: "restored"; entitlements: string[] }
  | { status: "nothing_to_restore" }
  | { status: "error"; error: Error };

export interface ProductProvider {
  getProducts(refs: ProductRef[]): Promise<ResolvedProduct[]>;
  purchase(product: ResolvedProduct): Promise<PurchaseResult>;
  restore(): Promise<RestoreResult>;
}
```

### 4.2 Shipped adapters

Both optional, loaded with the `try { require() } catch` no-op helper pattern
already established by `elements/haptics.ts`. Neither becomes a peer dependency.

- `revenueCatProductProvider(Purchases)` — maps RC `StoreProduct` /
  `SubscriptionOption`. Default for Rocapine apps, where
  `rocapine setup revenuecat` has already installed and keyed RC.
- `expoIapProductProvider()` — direct StoreKit / Play Billing.
- Hosts may pass any object satisfying `ProductProvider`.

### 4.3 Derived fields are the SDK's job, not the adapter's

`pricePerWeek`, `pricePerMonth`, `pricePerYear`, `savingsPct`, `trialDays`, and
`totalPrice` are computed centrally from `priceAmount` + `periodIso` +
`currencyCode`, so every provider produces identical semantics and formatting.

`savingsPct` requires a declared comparison: a product slot may carry
`compareTo: "<otherKey>"`, and savings is computed against that slot's
normalized per-period price. Without `compareTo`, `savingsPct` is absent (and
any `{{...savingsPct}}` interpolates to empty, per existing `interpolate`
semantics).

Currency formatting uses `Intl.NumberFormat` with the product's `currencyCode`
and the device locale. Derived prices are **computed, not quoted** — they are
never presented as the charged amount, only as "$1.15/week" style framing, which
is standard and accepted.

### 4.4 Variable injection

Products are flattened into the existing variable bag as **flat dotted keys**:

```
product.yearly.price           "$59.99"
product.yearly.priceAmount     "59.99"
product.yearly.currencyCode    "USD"
product.yearly.period          "year"
product.yearly.pricePerWeek    "$1.15"
product.yearly.savingsPct      "58"
product.yearly.trialDays       "7"
products.loaded                "true" | "false"
products.error                 ""     | "<message>"
products.purchasing            "true" | "false"    // set during an in-flight purchase
```

**This requires no engine changes**, verified against the code:

- `interpolate()` (`elements/shared.ts`) resolves `{{key}}` via a flat
  `variables[key]?.label ?? variables[key]?.value` lookup — a dotted key is just
  a key.
- The expression tokenizer (`elements/expression.ts`) reads `{{...}}` as an
  opaque `.trim()`-ed name, so `{{product.yearly.priceAmount}} * 12` parses.
- `evaluateCondition` reads `ctx.flatVariables` by the same flat lookup, so
  `renderWhen: { "variable": "products.loaded", "operator": "eq", "value": "true" }`
  works.

**Correction (Phase 7):** every `renderWhen` example in this document originally
wrote the shorthand `{ "products.loaded": { "eq": "true" } }` — a map keyed by
variable name. That shape does not parse. The real wire shape, unchanged since
`common.types.ts` was written, is a leaf `{ variable, operator, value? }` (unary
operators — `is_empty`/`is_not_empty`/`is_null`/`is_not_null` — omit `value`) or
a group `{ logic: "and" | "or", conditions: [...] }` of leaves/groups. This has
been wrong in this spec since the original design; every example below is now
corrected to the real shape. The §4.6 `Button` example had a second,
independent bug alongside the shorthand: it nested `renderWhen` inside
`props`, but every element schema declares `renderWhen` as a top-level field
sibling to `type`/`props` — also fixed in place.

### 4.5 New ButtonActions

Added to headless `steps/common.types.ts` (type + Zod), mirrored in UI
`Runtime/elements/actions.ts`, dispatched in `Runtime/elements/runActions.ts`:

```ts
{ type: "purchase", product: string,          // "yearly" or "{{plan}}"
  onSuccess?: ButtonAction[], onCancel?: ButtonAction[], onError?: ButtonAction[] }
{ type: "restore",
  onSuccess?: ButtonAction[], onNothingToRestore?: ButtonAction[] }
{ type: "dismiss" }
{ type: "presentPaywall", placement: string }
```

`purchase` resolves `product` through `interpolateIdentifier` first, so a
RadioGroup writing `plan` drives it — the opposite precedence from `interpolate`
(`value ?? label`, not `label ?? value`), deliberately: `product` names an
IDENTIFIER (a product slot key), not display text, and a RadioGroup item's
`value`/`label` commonly differ (`{value:"yearly", label:"Yearly"}`).
`interpolate` would resolve the label instead and silently fail to find the
product. During an in-flight purchase the runtime sets `products.purchasing =
"true"` so authors can gate a spinner with `renderWhen`.

`dismiss` calls `host.complete({ status: "dismissed" })`.
`presentPaywall` is available in **both** hosts — that is how an onboarding step
opens a paywall.

### 4.6 Authoring shape

```jsonc
// paywall.products
[{ "key": "yearly",  "ios": "com.app.yr", "android": "com.app.yr:p1y", "compareTo": "monthly" },
 { "key": "monthly", "ios": "com.app.mo", "android": "com.app.mo:p1m" }]
```

```jsonc
// paywall.elements — all existing element types, unchanged
{ "type": "Text", "props": { "mode": "expression",
    "content": "Just {{product.yearly.pricePerWeek}}/week" } }
{ "type": "RadioGroup", "props": { "variableName": "plan", "defaultValue": "yearly",
    "items": [{ "value": "yearly",  "label": "{{product.yearly.price}} / year" },
              { "value": "monthly", "label": "{{product.monthly.price}} / month" }] } }
{ "type": "Button", "renderWhen": { "variable": "products.loaded", "operator": "eq", "value": "true" },
  "props": { "label": "Start free trial",
    "actions": [{ "type": "purchase", "product": "{{plan}}",
                  "onSuccess": [{ "type": "dismiss" }] }] } }
{ "type": "Button", "props": { "label": "Restore", "actions": [{ "type": "restore" }] } }
```

`Text.content` is the one prop that interpolates `{{...}}`, and only when
`mode: "expression"` is set — it has no default, so an authored `Text` that
omits it renders the literal `{{product.yearly.pricePerWeek}}/week` string
verbatim. This is pre-existing, correct-by-design engine behavior (opt-in
interpolation), not new for paywalls — the canonical shape above must set it
explicitly.

---

## 5. Part 3 — Studio data model

New tables, deliberately shaped to mirror the onboarding side so runtime code is
shared rather than duplicated.

```sql
paywalls (
  id uuid primary key, project_id uuid not null references projects(id),
  name text not null, placement text not null,
  elements jsonb not null default '[]',
  products jsonb not null default '[]',
  configuration jsonb, status text, edited_at timestamptz,
  archived_at timestamptz, created_at timestamptz
);

paywall_deployments (
  id bigint identity primary key, paywall_id uuid references paywalls(id),
  elements jsonb, products jsonb, configuration jsonb,
  elements_<locale> jsonb,          -- baked per-locale, mirrors deployments.steps_<locale>
  created_at timestamptz
);

paywalls_i18n / paywalls_assets_i18n      -- identical shape to onboardings_*

audiences_paywalls (
  audience_id bigint references audiences(id),
  paywall_id uuid references paywalls(id),
  weight int not null default 0,          -- must sum to 100 per (audience, placement)
  deployment_id bigint references paywall_deployments(id)
);

project_products (
  id bigint identity primary key, project_id uuid references projects(id),
  key text not null, ios_product_id text, android_product_id text,
  label text, kind text,                  -- 'subscription' | 'one_time'
  duration_iso text, indicative_price jsonb,
  source text not null default 'manual',  -- 'manual' | 'publishing_platform'
  external_ref text,                      -- publishing-platform id, null in v1
  created_at timestamptz, updated_at timestamptz,
  unique (project_id, key)
);
```

RLS on all tables follows the existing `user_has_access_to_project(project_id)`
pattern used by `project_assets` and `project_store_config`.

### 5.1 `project_products.source` is the Publishing Platform seam

v1 writes only `source = 'manual'` rows, created by hand in the studio. When the
Publishing Platform integration lands, a sync job upserts `source =
'publishing_platform'` rows keyed by `external_ref` into the **same table**.
Nothing downstream changes — not the paywall schema, not the edge function, not
the SDK, not the element forms. The editor's product picker gains a "synced"
badge and a refresh button; that is the whole delta.

Manual rows are never overwritten by sync (different `source`), so an author's
hand-entered product survives the integration.

### 5.2 Targeting and A/B

Paywall targeting reuses the existing audiences waterfall verbatim. Runtime
resolution for a placement is:

1. Match the audience — same first-match `jsonLogic` loop over
   `audiences` ordered by `order`, on the same `searchParams`.
2. Filter that audience's `audiences_paywalls` rows to the requested placement
   (via `paywalls.placement`).
3. Weighted pick among them using `pickWeighted` from
   `supabase/shared/audienceWeights.ts` — the same helper, with the same
   0-weight and boundary semantics that the onboarding path already relies on.
4. Resolve the pinned `deployment_id`, else the latest deployment.

A/B testing a paywall is therefore the same operation as A/B testing an
onboarding, with the same weights UI and the same "weights must sum to 100"
invariant.

---

## 6. Part 4 — Studio API

### 6.1 New edge function `get-paywalls`

```
GET /functions/v1/get-paywalls
  ?projectId=<uuid>
  &platform=ios|android
  &appVersion=<semver>
  &locale=<bcp47>
  [&placement=<key>]        // narrows to one; omitted → all placements
  [&draft=true]
  [&omitNulls=true]
  [...arbitrary audience params]

200 →
{
  "metadata": {
    "audienceId": 12, "audienceName": "FR users", "locale": "fr", "draft": false
  },
  "paywalls": {
    "onboarding_end": {
      "id": "...", "name": "Hard paywall v3", "placement": "onboarding_end",
      "elements": [ /* UIElement[] */ ],
      "products": [ { "key": "yearly", "ios": "...", "android": "...",
                      "compareTo": "monthly" } ],
      "configuration": { ... }
    },
    "settings_upgrade": { ... }
  },
  "fonts": { ... }
}

Headers: ONBS-Audience-Id, ONBS-Paywall-Ids
```

Returning **all placements by default** is deliberate: a paywall must render the
instant the user taps upgrade, and a network round-trip at that moment is a
conversion bug. The SDK fetches once at launch and caches in AsyncStorage,
exactly as the onboarding payload already does.

### 6.2 Shared-code extraction (required, not optional)

`get-paywalls` needs the audience waterfall, weighted pick, locale-fallback
chain, i18n resolution, font lifting, `omitNulls`, and the CORS/error envelope
**identically** to `get-onboarding-steps`. Copying ~200 lines would guarantee
drift — and locale fallback is precisely the area where a past drift bug was
already fixed once by consolidating into `supabase/shared/localeFallback.ts`.

Extract into `supabase/shared/`:

- `resolveAudience.ts` — the `getMatchingAudience` waterfall (currently inline in
  `get-onboarding-steps/index.ts`), parameterized by the join it walks.
- `serveEnvelope.ts` — `corsHeaders`, `parseBooleanQueryParam`, `omitNullsDeep`,
  and the `FunctionsHttpError`/`RelayError`/`FetchError` handling block.
- `deploymentLocale.ts` — the baked-column + legacy-table locale resolution,
  parameterized by table and column prefix.

`get-onboarding-steps` is refactored to call them in the same change, with its
existing behaviour held constant. It has a test file
(`get-onboarding-steps/test.ts`) that anchors this.

### 6.3 Studio-side write API

Follows the existing pattern exactly: React Query hooks against Supabase with
RLS, plus MCP tools for agent-driven authoring.

- `hooks/usePaywalls.ts`, `hooks/usePaywall.ts`, `hooks/useProjectProducts.ts`
  — mirroring `useOnboardings` / `useOnboarding` / `useAudiences`.
- Query keys: `["paywalls", projectId]`, `["paywall", id]`,
  `["paywall-deployments", id]`, `["project-products", projectId]`.
- MCP tools in `supabase/functions/mcp/tools/paywalls.ts`:
  `list_paywalls`, `get_paywall`, `create_paywall`, `update_paywall`,
  `publish_paywall`, `list_project_products`, `upsert_project_product`.

---

## 7. Part 5 — SDK client surface

```ts
// New method on the existing client
client.getPaywalls(opts?: { locale?: string }, userDefinedParams?)
  → { data: PaywallCatalog, headers: GetPaywallsResponseHeaders }
```

```tsx
<PaywallProvider
  client={client}
  productProvider={revenueCatProductProvider(Purchases)}
  customActions={{ ... }}
>
  <App />
  <PaywallHost />        {/* renders the active paywall in a fullScreen RN Modal */}
</PaywallProvider>
```

```ts
const { present, isReady, catalog } = usePaywall();
const result = await present("hard_paywall");
// → { status: "purchased" | "dismissed" | "cancelled" | "error" }
```

**`PaywallProvider` is a sibling of `OnboardingProvider`, not nested inside it**
— paywalls must work from Settings with no onboarding mounted.
`OnboardingProvider` gains an optional `productProvider` prop and mounts the
same catalog internally, so a `presentPaywall` ButtonAction works mid-flow.

Rendering into a Modal (rather than a route) means presenting a paywall never
couples to expo-router and works identically from an onboarding step, a settings
screen, or a push-notification handler.

Caching mirrors the onboarding path: `staleTime: Infinity`, AsyncStorage
persistence under a `rocapine-paywalls-*` key, `clearCache()` on the client, and
the same `cacheKey` option semantics.

---

## 8. Part 6 — Studio editor

Reused **unchanged**, because they already operate on `UIElement[]`:
`ComposableScreen.tree.tsx`, `ComposableScreen.palette.tsx`, every element form,
`materializeForPaste`, the template library, `utils/stepDiff.ts`.

New:

- Route `/projects/[projectId]/paywalls` (list) and
  `/projects/[projectId]/paywalls/[paywallId]` (editor).
- `PaywallProductsPanel` — manage the paywall's product slots (`key`, ios id,
  android id, `compareTo`), choosing from `project_products` or typing a raw ID.
- `ProjectProductsPanel` — project-level CRUD over `project_products`.
- Preview injection: the paywall preview seeds fake `ResolvedProduct`s from
  `project_products.indicative_price` (falling back to plausible defaults) so
  `{{product.yearly.price}}` renders a real-looking string in the editor rather
  than an empty string. Clearly badged as indicative.
- `scanElements` (`contexts/steps-context.tsx`) must surface `product.*` and
  `products.*` keys so condition pickers and the variables panel offer them.
- Publish gate: reuse `PublishDiffDialog`. `utils/stepDiff.ts` is id-keyed and
  JSON-equality based, so it generalizes from `steps[]` to `elements[]` with a
  parameterized label rather than a fork.

---

## 8.1 Paywall audience assignment

Part 6 shipped an editor but no way to make a paywall reachable: assignment ran
only through the `set_paywall_audience_weights` MCP tool. §8 never listed it.
This section records the surface that closes that gap, and the invariants a
later phase must not break.

**Where it lives.** The audiences screen, not the paywall editor —
`components/studio/pages/audiences/AudiencePaywallsSection.tsx`, mounted inside
the existing audience card beside the onboarding rollout. Studio Next only;
classic carries a static pointer to it. No new route: the audiences route is
already registered in `StudioShell`.

**Weights sum to 100 per (audience, placement), never per audience.** This is
the load-bearing invariant and the one real difference from onboardings.
`selectPaywallPerPlacement` groups an audience's assignments by the paywall's
placement and makes one *independent* weighted pick per placement, so a user can
be in the A variant of `onboarding_end` and the B variant of `settings_upgrade`.
The UI therefore renders one rollout block per placement, each with its own bar,
validation and allocation line. A total spanning placements is a defect.

**An all-zero group is not an off switch.** `pickWeighted` falls back to a
uniform random pick when a group's weights total zero, so zeroing a placement
randomises it rather than disabling it. Removing every paywall from the
placement is the only way to serve nothing there, and the UI says so explicitly
— an author cannot discover this from the interface otherwise, and the
consequence is live traffic going somewhere they believed was switched off.

Related asymmetry: an audience matching zero paywall assignments receives
nothing, whereas the onboarding path falls back to the most recent onboarding.
An unassigned placement is silently absent at runtime, which is why the paywalls
list carries a "Not assigned" badge — it is the only signal an author gets.

**The write is a full per-placement replacement.** One mutation handles add,
remove and re-weight: upsert the placement's whole desired set, then delete that
placement's omitted rows. A paywall omitted from a save is *unassigned*. This
mirrors `set_paywall_audience_weights`, including its non-transactional shape —
upsert and delete are separate statements, so a failed delete leaves the
placement temporarily over 100, and the error surfaces to the caller. The studio
matches the backend's guarantees rather than claiming better ones.

Two deliberate divergences from that tool: an empty desired set is **allowed**
in the UI and means "stop serving this placement" (the tool rejects it, because
`[]` from an agent is likelier a mistake); and `placement` is **verified rather
than derived**, since an empty set must still name the placement being cleared.
That verification is not optional — `audiences_paywalls` has no placement
column, so a mismatched row is not rejected by the database and would simply
surface in a group whose total nobody validated.

**The UI writes the tables directly under RLS**, re-implementing the tool's
replacement semantics rather than calling it: MCP tools are not reachable over
plain HTTP from the web client. The weight *rules* are not re-implemented —
`validateSplit` is imported from the same `supabase/shared/audienceWeights`
module the tool and the serve path use, so the two cannot drift on what a valid
split is.

**`deployment_id` is always written NULL.** Pinning exists nowhere in this API,
here or in `publish_paywall`; every assignment serves the latest deployment.

## 9. Non-goals for v1

Explicitly out of scope, to be revisited only with evidence:

- Entitlement / subscription state management in the SDK. RevenueCat owns it;
  the host reads it.
- Server-side receipt validation.
- Per-territory price preview in the studio (needs the console APIs).
- `ForEachProduct` iteration and scoped variables. With manually declared
  product slots the list is known at author time, so hand-authored plan cards
  suffice. Revisit if dynamic-length offerings become a real need.
- Paywall analytics beyond emitting the result to the host's handler.
- Migrating existing Superwall paywalls.

## 10. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | App Review rejects a paywall whose displayed price ≠ StoreKit | Structural: no code path renders a CMS price. Ship a documented "products failed to load" pattern and make `renderWhen: products.loaded` the default in every seeded paywall template. |
| 2 | Flash of unresolved prices while products resolve async | Prefetch at `PaywallProvider` mount, before any `present()`. Gate price-bearing subtrees on `products.loaded`. Document the skeleton pattern. |
| 3 | Play's product model doesn't fit one string | `android: "productId:basePlanId"` follows RevenueCat's own convention. If offer-level targeting is needed, add an optional `androidOfferId` — additive, non-breaking. |
| 4 | 4-way schema mirror (headless / UI / studio Zod / studio form) now covers paywalls | The `screens/` extraction is intended to hold the mirror count flat. The `sync-studio-schema` skill and the CLAUDE.md checklist must be updated to name the new paths in the same change. |
| 5 | Refactoring `get-onboarding-steps` risks the live onboarding path | Extract shared helpers with behaviour held constant, anchored by the existing `get-onboarding-steps/test.ts`. Ship the refactor as its own commit, before `get-paywalls` exists. |
| 6 | `purchase` action needs an in-flight state or users double-tap | Runtime sets `products.purchasing`; the Button element already supports `renderWhen`, and `disabled` gating is an existing prop. |

## 11. Build sequence

Each phase is independently shippable and leaves the repo green.

1. **Engine extraction, SDK only.** Move files, introduce `ScreenHost`, rewire
   `ComposableScreen/Renderer.tsx` as an adapter, re-export everything from old
   paths. Update `.claude/rules/*`, plugin skills, and website docs to the new
   paths. No behaviour change; the example app is the regression check.
2. **Shared edge-function helpers.** Extract `resolveAudience`, `serveEnvelope`,
   `deploymentLocale`; refactor `get-onboarding-steps` onto them. No new
   endpoint yet.
3. **Product runtime, SDK.** `ProductProvider` interface, derived-field
   computation, variable injection, the four new ButtonActions, the RevenueCat
   and expo-iap adapters. Testable without any studio work using a stub
   provider.
4. **Studio schema + API.** Migrations, `get-paywalls`, MCP tools, React Query
   hooks.
5. **SDK paywall client.** `getPaywalls`, `PaywallProvider`, `PaywallHost`,
   `usePaywall`, caching.
6. **Studio editor.** Routes, product panels, preview injection, publish gate,
   `scanElements` extension.
7. **Seeded paywall templates** demonstrating the products-failed and
   purchasing-in-flight patterns from §10.

Phases 1–3 are SDK-only and can proceed in parallel with 4. Phase 5 depends on
3 and 4; phase 6 depends on 4.

### 11.0 Known follow-ups surfaced by Phase 1 implementation

Phase 1 landed (see `docs/superpowers/plans/2026-08-11-screen-engine-extraction.md`).
Three findings came out of it that later phases must not lose.

**1. `customActions` default breaks the memoization contract (do before Phase 5).**
`customActions = {}` is a default *parameter* at
`packages/onboarding/src/infra/provider/OnboardingProvider.tsx:134`, so it is a
fresh object on every provider render — and the provider re-renders on every
variable write, because `setVariables(variablesRef.current)` (~`:154-157`) always
passes a newly-allocated object. `customActions` sits in `RenderContext`'s
dependency array, so **any host app that omits `customActions` gets a new `ctx`
identity per write** — the whole-tree re-render storm the memoization
architecture exists to prevent.

This predates the extraction and is not a regression: the pre-refactor `ctx` had
the identical dependency. It became load-bearing because `UI/Runtime/ScreenHost.ts`
now documents "Must be stable" as a contract the shipped provider violates. The
fix is one line — hoist a module-scope `EMPTY_CUSTOM_ACTIONS` and use it as the
default. Do it before Phase 5 adds a second host.

**2. The UI mirror did not get the headless split (Phase 5 will hit this).**
Headless moved the nested-KeyboardAvoidingView refinement onto a screen-agnostic
`ScreenElementsSchema` (`packages/onboarding/src/screens/types.ts`), on the
grounds that the constraint belongs to the element tree rather than to steps. The
UI mirror kept `ComposableScreenStepPayloadSchema = z.object({elements}).superRefine(...)`
in `packages/onboarding-ui/src/UI/Runtime/types.ts`. So the screen-agnostic engine
exports a schema named for an onboarding *step*, and a paywall UI adapter has no
`ScreenElementsSchema` to build on — it must either import the step-named export
or re-declare the KAV walk a third time. No behaviour impact today. Deliberately
deferred: Phase 5 should define the UI-side `ScreenElementsSchema` when it knows
its own payload shape, rather than adding an unused export speculatively.

**3. `update-uielement` skill has a wrong premise (pre-existing).**
`.claude/skills/update-uielement/SKILL.md` "Step 2 — Mirror in UI package types"
sends a prop-only change to the union `types.ts`, where it is a no-op, and never
tells the author to update the re-declared `{Element}ElementProps` + Zod schema in
the UI mirror `.tsx` — which is exactly where untypechecked drift actually
happens. Wrong before the extraction too; the file paths are now correct but the
procedure is not.

### 11.0.1 Follow-ups surfaced by Phase 6 (studio editor)

Phase 6 landed in `onboarding-studio` (plan:
`docs/superpowers/plans/2026-08-18-paywall-studio-editor.md` in that repo). The
editor is built in **Studio Next only** — it supplies the classic
`StepsContext` from paywall tables, presenting the paywall as one synthetic
`ComposableScreen` pseudo-step, so the layers tree, inspector, every per-element
form and the preview work unchanged. See `.claude/rules/paywalls.md` there.

**The gap between "Phase 6 done" and "an author ships a paywall from the web UI":**

- ~~**Audience assignment UI is unbuilt.**~~ **RESOLVED** — built as a
  follow-on to Phase 6 (plan:
  `docs/superpowers/plans/2026-08-19-paywall-audience-assignment.md` in
  `onboarding-studio`). Specified in §8.1 above. The existing weights UI turned
  out to be coupled to onboardings in every dimension at once — table name,
  column name, and the returned type — so it was mirrored as a sibling hook
  rather than generalised. The backend needed no work: the MCP tool and
  `get-paywalls` already implemented the whole write and read path; the gap was
  purely a web surface.

**Promised in the plan, not delivered:**

- **Client-side element validation never landed.** The plan's design decision
  said the studio would import the SDK's `ScreenElementsSchema` to validate an
  element tree before writing it; no task's steps required it, so no task did
  it, and `ScreenElementsSchema` is imported nowhere in the studio. Nothing
  regressed — there was no such validation before Phase 6 either — but a
  malformed tree still surfaces only at render time on device. Only *product
  derivation* (`dist/products/derive`, `dist/products/toVariables`) is imported
  from the SDK today.

**Schema and data-model debt:**

- **`paywalls_i18n."default"` is a vestigial `jsonb NOT NULL` column.**
  `onboardings_i18n` dropped its equivalent in migration `20260504160000`;
  `paywalls_i18n` (created 2026-08-14) copied the pre-drop shape. Nothing reads
  it — the resolver treats the literal `"default"` as a sentinel mapping to a
  *null column* — but every insert must pass `default: {}` or hit a not-null
  violation.
- **`paywalls.status` has no CHECK constraint.** The editor writes only
  `'draft'` and `'published'`; pinning the set is a migration.
- **`paywalls.edited_at` no longer means what its migration comment says.** It
  documents NULL as "never edited since creation", but opening an MCP-authored
  paywall now writes minted element ids, which stamps the column. No UI should
  treat NULL as meaningful.
- **`project_products` deletion exists only as a React hook** — no MCP tool
  wraps it, so the agent-facing surface cannot remove a stale catalog entry.

**Editor gaps:**

- **No paywall i18n *tab* is possible on the current provider.** Several i18n
  writers are deliberately **absent** rather than stubbed, so the element chips
  render their unavailable state instead of pretending a write worked. The
  element-level label/asset workflow is complete.
- **No locale picker**, so the editor's preview-locale behaviour is unreachable
  from the UI.
- **Paywall hooks have no realtime subscription** while `useOnboardings.ts` does,
  so a second editor's changes do not appear live.
- **A failed element-id write-back can deploy ids the row lacks.** No-rollback is
  deliberate (`retrySync` re-sends), but because the ids are random the
  divergence is not self-correcting the way restored user content is.

**Code-shape debt worth one cleanup pass:**

- `PaywallCanvasPanel` is a 211-line copy of `CanvasPanel`, zoom/perf machinery
  included. The right fix is a shared `ZoomableCanvas`; it was deferred because
  it means editing a live onboarding-editor component mid-phase.
- The identifier format `^[a-z][a-z0-9_]{0,63}$` now lives in **four** places —
  the migration CHECK, the MCP tool's `IDENTIFIER_FORMAT`, `utils/paywallPlacement.ts`
  and `utils/productKey.ts` — held in agreement by `fs`-based parity tests rather
  than imports, because a cross-file import cannot satisfy both `tsc` (rejects
  `.ts` extensions) and Node's test runner (requires them) for a file a test
  imports directly. A fifth copy needs a fifth parity test.
- `KIND_BG`/`KIND_FG` in `utils/diffEngine.ts` are Tamagui-only tokens living in
  a module its own docstring frames as algorithm-only. One Tailwind caller keeps
  a local class map; a second should trigger extracting `diffPresentation.ts`.
- `utils/i18nLocale.ts`'s `I18N_RESERVED_COLUMNS` omits `paywall_id` and
  `"default"`. Dead code today, but that is where the fix belongs.
- `hooks/useOnboarding.ts` carries a now-redundant `as any` on its
  `ensure_deployment_locale_column` RPC — the generated types have covered it
  since `651a181`. Left alone because it is the live onboarding publish path.

**Process finding, applicable beyond paywalls:**

- **`pnpm build` is not in CI**, and it is the only gate that catches an import
  which type-checks but does not bundle. Phase 6 ran it manually on every UI
  task. Adding it to `.github/workflows/static-checks.yml` would close the one
  verification gap this phase found in the existing gates.

### 11.0.2 Follow-ups surfaced by the audience-assignment work

- **"Weights must total 100" is encoded in three independent places**, only one
  of which is authoritative: `supabase/shared/audienceWeights.ts`'s
  `validateSplit` (complete rule set, imported by the MCP tools, the serve path
  and the paywall UI); `lib/audienceWeightValidation.ts` (a partial
  re-implementation used by the onboarding rollout, untested); and
  `supabase/functions/mcp/ui/audienceConsole.ts`, which re-implements both the
  distribution maths and the gate in plain JS inside a template string, because
  it runs in the viewer's browser and cannot import from `shared/`. The paywall
  path imports the shared module rather than adding a fourth.

  Worth noting how easily this was miscounted: the console copy lives inside a
  string, so a grep for the usual TypeScript spellings does not find it. Two
  separate passes here got the number wrong in opposite directions before anyone
  actually enumerated them. If a count matters, enumerate; do not grep.

- **`hooks/useAudiences.ts` keys its query `["audiences"]` with no project id**,
  so two projects share one cache entry. Pre-existing and unrelated to paywalls,
  but it is the kind of bug that produces "I saw the other project's data once"
  reports that never reproduce.

- **A grep for a field name cannot find a type-level dependency on it.**
  Reverting an embed broke two components that cast the query's result to a named
  type; neither file mentions the field anywhere, so the field-name grep used to
  check for consumers came back clean and was wrong. `tsc` found it immediately.
  Worth remembering whenever a select string changes: the type checker is the
  instrument, not grep.

- **`pnpm build` is still not in CI** (`static-checks.yml` runs type:check, lint,
  test, mcp:catalog:check and the Deno checks). It is the only gate that catches
  an import which type-checks but does not bundle, and this work depended on it
  twice. Adding it would close the one real hole in the existing gates.

  Related, and sharper: a build gate proves nothing unless the changed module is
  **reachable from an entry point**. A new hook that nothing imports yet bundles
  green while never being traversed. Both times this came up, the fix was to
  make the module reachable (or add a temporary probe import) and confirm the
  bundle actually grew.

### 11.0.3 Follow-ups surfaced by Phase 7 (seeded paywall templates)

Phase 7 authored the two paywall building-block templates referenced
throughout §4.4/§4.6 above (plan: `docs/superpowers/plans/2026-08-19-paywall-
seeded-templates.md` in `onboarding-studio`) — a pricing block with a
loading/ready/failed split, and a purchase button with an in-flight guard —
seeded into `composable_templates` via migration, plus the SDK's own example
app (`example/app/example/paywall.tsx`) now exercises both.

- **This spec's own `renderWhen` examples did not parse.** See the correction
  in §4.4/§4.6 above — recorded here too because it is the biggest single
  finding of this phase: anyone who learned the wire shape from this document
  before the correction wrote payloads that fail at render time on a device.

- **There is no way to retry loading products.** No `ButtonAction` variant for
  it, and nothing on `ProductRuntime` exposes a reload. "Spinner → error → tap
  retry → re-fetch in place" is ordinary paywall UX; the seeded failure
  template can only offer `dismiss` and hope the host re-presents, which is a
  real downgrade from what an author will expect. A `retryProducts`
  `ButtonAction` (or a `reload()` on `ProductRuntime`) is the fix. **Do not
  paper over this with a `{ type: "custom" }` action** naming a function no
  host implements — that ships a dead control to every project, the same
  failure mode Phase 6 had to fix elsewhere.

- **`composable_templates` has no `kind`/`category` column**, so the two
  seeded paywall templates appear in onboarding authors' template palette too
  — there is no schema-level way to scope a template to "paywall content
  only." The `"Paywall — …"` name prefix is the mitigation actually shipped;
  a `kind` column is the real fix.

- **`supabase/config.toml` declares `[db.seed] sql_paths = ["./seed.sql"]`
  for a file that does not exist.** Confirmed absent. A configured-but-absent
  seed hook is a trap for the next person who runs `supabase db reset`
  expecting it to do something. Either create the file or drop the setting.

- **Global templates are seeded by migration, so changing one is a migration,
  not an edit.** By design (RLS has no path for a non-migration writer to
  touch `scope = 'global'` rows) — if that becomes painful in practice, the
  answer is an admin surface, not loosening RLS.

- **`delete_composable_template` exists** (`supabase/functions/mcp/tools/
  composable-templates.ts`), but `onboarding-studio-plugin/skills/
  manage-templates/SKILL.md` still says MCP has no delete tool. Stale doc,
  unrelated to the seeding work itself but found while reading the same
  surface.

- **Phase 7 shipped entirely unverified against a running system** — no
  Docker, no `supabase` CLI, no render harness available in the environment
  it was built in. `docs/paywall-template-verification.md` (in
  `onboarding-studio`) is the hand-over: what to run and check once a real
  Supabase instance is reachable.

### 11.1 This spec is a program, not one implementation plan

Seven phases across two repos is too much for a single plan to hold usefully.
Each phase gets its own implementation plan, written when its predecessor lands
and the real constraints are known.

The first plan should cover **phases 1 and 2 only** — the two pure refactors.
They carry all the structural risk (file moves, re-export surface, a live edge
function), touch no new product surface, and are verifiable against existing
behaviour: the example app for phase 1, `get-onboarding-steps/test.ts` for
phase 2. Getting them landed and released de-risks everything after.
