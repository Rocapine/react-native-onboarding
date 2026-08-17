# SDK Paywall Client Implementation Plan (Paywall Phase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a host app present a studio-authored paywall — `client.getPaywalls()`, a `PaywallProvider`, a `PaywallHost` that renders into a fullScreen Modal, and `usePaywall().present(placement)` resolving to a purchase outcome — plus the two §11.0 follow-ups the spec assigns to this phase.

**Architecture:** The rendering engine already exists behind `ScreenHost` (Phase 1) and the product runtime already exists (Phase 3); this phase is a *second host* plus the client that feeds it. Nothing in `Runtime/` changes. The catalog is fetched once at launch and cached, so `present()` performs no network call — neither to the studio nor to the store.

**Tech Stack:** React Native, React Query, AsyncStorage, Zod, vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-paywall-rendering-engine-design.md` §4.5, §7, §11.0. Phase 5 in the build sequence (§11).

**Predecessors, all merged:** Phase 1 (#131, engine extraction), Phase 3 (#132, product runtime), Phase 4a-c (studio schema, `get-paywalls`, write API — sibling repo `onboarding-studio`, PRs #190/#193/#195).

**Branch:** `phase5-sdk-paywall-client`, off `origin/main` at `511fc7f`.

---

## PREREQUISITE

Verified environment facts — do not rediscover:

- Monorepo. `npm run build` builds both packages; `npm test --workspace=packages/onboarding` runs headless vitest.
- **Current test counts: headless 159/159, UI 26/26.** Both must stay green and the counts only go up.
- **Zero Phase 5 code exists.** `grep` for `PaywallProvider`, `getPaywalls`, `presentPaywall`, `usePaywall` across `packages/` returns nothing. This is greenfield, not a refactor.
- **There is no `Modal` anywhere in either package.** `grep -rn "\bModal\b"` returns zero hits — no fullScreen-presentation, safe-area-inside-Modal, or Android-back-button precedent exists to copy.
- After changing `packages/`, run `npm run build` before reloading the example app (it references packages via `file:../packages/*`).

## Global Constraints

- **No new dependencies, and no new peer dependencies.** RN's own `Modal` is used, not a library.
- **The rendering engine does not change.** `renderElement.tsx` and `ScreenRenderer.tsx` are host-agnostic already; a paywall is a second caller, not a modification. A task that finds itself editing either has taken a wrong turn — stop and report.

  **Exceptions, all owned by Task 4**, because the seam's *contract* genuinely widens for a second host:

  - `Runtime/ScreenHost.ts` — `complete` gains an optional outcome argument; an optional `presentPaywall` field is added. This is the seam, not the engine.
  - `Runtime/elements/actions.ts`, `Runtime/elements/runActions.ts`, `Runtime/elements/shared.ts` — the action layer and the `RenderContext` type, not the renderer.
  - **`Runtime/ScreenRenderer.tsx`, but ONLY its `ScreenHost` → `RenderContext` assembly.** This was originally excluded and that was a mistake: `ScreenRenderer` is the *translator* between the two, so a new host capability cannot reach an element without a line here — the exclusion made Task 4 undeliverable end-to-end and produced a dispatched-but-unwired action. Two changes only, both shaped exactly like the existing `products` wiring: `stableOnContinue` must **forward its argument** to `host.complete` (it is currently a zero-arg wrapper at `:72` that silently drops the outcome), and `presentPaywall` must be carried from host into `ctx` and added to the memo dependency array at `:98`.

  Everything else in `ScreenRenderer.tsx`, and all of `renderElement.tsx`, stays untouched. If a change is not one of the two named above, stop and report.
- **Schema changes are mirrored.** A `ButtonAction` variant added to headless `steps/common.types.ts` (type + Zod) must be mirrored in UI `Runtime/elements/actions.ts`. **Drift runs both ways**: a variant added only to the UI mirror still fails parsing, because the headless schema validates the payload — the renderer handles it and the parse throws `invalid_union` anyway.
- **Three `ScreenHost` fields are contractually referentially stable** — `setVariable`, `customActions`, `products`. Violating this silently defeats `React.memo`/`areElementPropsEqual` with no type error. The paywall host must memoize them exactly as the onboarding adapter does.
- **Do not reuse `OnboardingProgressContext`.** It carries `activeStep`/`totalSteps`/`headerHeight`/`onboarding` — onboarding-flow state, not screen-agnostic. `PaywallProvider` gets its own context.
- Run all commands from the worktree root: `/Users/paulbriand/Developer/react-native-onboarding/.claude/worktrees/paywall-engine-spec`.

---

## Design decisions this plan makes

**1. `PaywallProvider` is an ancestor of `OnboardingProvider`, and owns the product runtime.**

The spec says `PaywallProvider` is "a sibling of `OnboardingProvider`, **not nested inside it** — paywalls must work from Settings with no onboarding mounted." Read alone that suggests two unrelated roots. But the spec's own example wraps the whole app:

```tsx
<PaywallProvider client={client} productProvider={…}>
  <App />           {/* OnboardingProvider lives in here */}
  <PaywallHost />
</PaywallProvider>
```

So "not nested inside it" means *not inside `OnboardingProvider`* — which an app-level ancestor satisfies, while still working from Settings with no onboarding mounted.

This matters because it is the only arrangement that solves a real problem. `useProducts` has **no cross-mount sharing mechanism**: two independently-mounted providers each call `getProducts()` against the billing SDK and each keep their own `purchasing` flag. Since the spec wants a mid-flow `presentPaywall`, both providers are mounted simultaneously in the normal case, not an edge case. React context flows to descendants, so an ancestor `PaywallProvider` gives exactly one catalog, one store round-trip, one `purchasing` flag.

`OnboardingProvider` therefore **consumes** the product runtime from context when it is present, and mounts its own only when standalone — which is what its existing optional `productProvider` prop becomes: the onboarding-only-with-products case.

**2. Product refs are the union across the whole catalog, resolved once at load.**

§6.1 returns all placements by default and justifies it: "a paywall must render the instant the user taps upgrade, and a network round-trip at that moment is a conversion bug." **A store round-trip is also a network round-trip.** Re-keying `useProducts` per *presented* paywall would reintroduce exactly the latency §6.1 exists to avoid, at exactly the moment it is most expensive.

So: flatten every `paywall.products[]` in the catalog into one deduplicated `ProductRef[]` and resolve that once. `useProducts` already keys on refs *content* (a joined string, `useProducts.ts:42-45`) rather than array identity, so a stable union produces exactly one resolution and no refetch storm.

Cost: an app with many paywalls resolves products it may never show. That is one store call at launch versus a spinner on the buy button, and the trade goes the way §6.1 already decided it.

**3. `present()` returns a promise the host resolves.**

`present(placement)` stores the placement in state (causing `PaywallHost`'s Modal to become visible) and returns a promise. The host's `complete({status})` resolves it. `dismiss` maps to `complete({status: "dismissed"})` per §4.5; a hardware back press and a Modal `onRequestClose` map to the same. `purchase`'s `onSuccess` chain reaching `dismiss` is what produces `"purchased"` — so the runtime records the last purchase outcome and `complete` reports it.

**4. The `customActions` fix follows the precedent already in the file.**

`OnboardingProvider.tsx:27-33` already hoists `EMPTY_PRODUCT_RUNTIME` at module scope for exactly this reason. `EMPTY_CUSTOM_ACTIONS` goes next to it. The `customActions: {}` at `:279` is a `createContext` **default value** — allocated once at module load, never per render — and is *not* part of the bug. Do not "fix" it.

**5. The UI-side `ScreenElementsSchema` is extracted, with the step-named export kept.**

`Runtime/types.ts` exports `ComposableScreenStepPayloadSchema` — a screen-agnostic engine exporting a schema named for an onboarding *step*. Phase 5 is the first consumer that needs the screen-agnostic form. Extract `ScreenElementsSchema` and re-define the step-named export in terms of it, rather than renaming: the old name is public API and is what `Pages/ComposableScreen/Renderer.tsx` parses with today.

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/onboarding/src/infra/provider/OnboardingProvider.tsx` (modify) | `EMPTY_CUSTOM_ACTIONS`; consume product runtime from context when present. |
| `packages/onboarding-ui/src/UI/Runtime/types.ts` (modify) | Extract `ScreenElementsSchema`; keep `ComposableScreenStepPayloadSchema` as a derived export. |
| `packages/onboarding/src/OnboardingStudioClient.ts` (modify) | `getPaywalls()`. |
| `packages/onboarding/src/paywalls/types.ts` (new) | `PaywallCatalog`, `Paywall`, `GetPaywallsResponseHeaders`, Zod schemas. |
| `packages/onboarding/src/paywalls/getPaywalls.query.ts` (new) | React Query options + cache key, mirroring `getOnboarding.query.ts`. |
| `packages/onboarding/src/steps/common.types.ts` (modify) | `dismiss` + `presentPaywall` ButtonAction (type + Zod). |
| `packages/onboarding-ui/src/UI/Runtime/elements/actions.ts` (modify) | UI mirror of both variants. |
| `packages/onboarding-ui/src/UI/Runtime/elements/runActions.ts` (modify) | Dispatch cases for both. |
| `packages/onboarding/src/products/ProductRuntimeContext.tsx` (new) | Context so one product runtime serves both providers. |
| `packages/onboarding/src/paywalls/PaywallProvider.tsx` (new) | Catalog fetch, product runtime mount, `present()` plumbing, context. |
| `packages/onboarding/src/paywalls/usePaywall.ts` (new) | `{ present, isReady, catalog }`. |
| `packages/onboarding-ui/src/UI/Paywall/PaywallHost.tsx` (new) | fullScreen `Modal` + `ScreenHost` adapter. |
| `example/app/example/paywall.tsx` (new) | Exercises the whole path. |

---

### Task 1: Clear the §11.0 debt in the headless provider

**Files:**
- Modify: `packages/onboarding/src/infra/provider/OnboardingProvider.tsx`

**Interfaces:**
- Produces: a stable `customActions` default, which every later task's memoization assumes.

- [ ] **Step 1: Read the precedent**

`OnboardingProvider.tsx:27-33` already declares `EMPTY_PRODUCT_RUNTIME` at module scope, with a comment explaining why. Read it — your fix is the same shape and should read like its sibling, not like a new idea.

- [ ] **Step 2: Do NOT write a unit test for this — here is why, and do not work around it**

This is deliberate and was checked before the task was written. The bug is an *identity* bug observable only across two renders of a React component, and this package has **no rendering harness**: `packages/onboarding` runs vitest alone, with no `@testing-library/react-native`, no `react-test-renderer`, no jsdom, and every one of its existing tests is a pure-function test. The three ways to get a test here are all worse than none:

- adding a harness — forbidden by this plan's no-new-dependencies constraint, and a large change to smuggle in under a one-line fix;
- exporting `EMPTY_CUSTOM_ACTIONS` purely so a test can import it — public API pollution to serve a test, and it would assert `X === X`, which is a JavaScript language fact rather than a fact about this code;
- grepping the source file for the old text — this repo's guard-test style is import-and-assert-behaviour (see `screenTypesBackCompat.test.ts`, which imports both module paths and parses real fixtures), not reading source as a string.

The precedent settles it: `EMPTY_PRODUCT_RUNTIME` is the identical fix in the identical file and has **no test**. Match it.

**In your report, state plainly that this change is verified by inspection and by the existing suite staying green — do not describe it as tested.** An honest gap is worth more than a test that asserts nothing, and this phase treats an unbacked verification claim as unverified.

- [ ] **Step 3: Fix it**

Hoist a module-scope constant next to `EMPTY_PRODUCT_RUNTIME` and use it as the default at `:156`:

```ts
// Frozen at module scope, not `= {}` inline: a default PARAMETER re-allocates on
// every render, and `customActions` is a RenderContext dependency, so a host that
// omits the prop would get a fresh `ctx` on every variable write and re-render the
// whole tree. Same reason EMPTY_PRODUCT_RUNTIME above is hoisted.
const EMPTY_CUSTOM_ACTIONS: CustomActions = Object.freeze({});
```

**Do not touch `:279`** — `customActions: {}` inside `createContext({...})` is a default *value*, evaluated once at module load. It is not part of this bug.

- [ ] **Step 4: Run tests, then commit**

```bash
npm test --workspace=packages/onboarding
git add packages/onboarding/src/infra/provider/
git commit -m "🐛 fix(headless): hoist the customActions default so ctx identity survives a variable write"
```

---

### Task 2: Give the UI runtime a screen-agnostic elements schema

**Files:**
- Modify: `packages/onboarding-ui/src/UI/Runtime/types.ts`

**Interfaces:**
- Produces: `ScreenElementsSchema`, which Task 7's paywall adapter parses with.

- [ ] **Step 1: Read both current declarations**

Headless has the screen-agnostic form at `packages/onboarding/src/screens/types.ts:517-535` (`ScreenElementsSchema`). The UI mirror at `Runtime/types.ts:494-508` has `ComposableScreenStepPayloadSchema = z.object({ elements }).superRefine(...)` with its own re-declared nested-KeyboardAvoidingView walk. Read both; the refinement logic must not change.

- [ ] **Step 2: Extract, keeping the old export**

Define `ScreenElementsSchema` carrying the refinement, then re-express the step-named export in terms of it:

```ts
// The engine is screen-agnostic; this schema is the screen-agnostic form of it.
// `ComposableScreenStepPayloadSchema` stays exported and unchanged in behaviour —
// it is public API, and Pages/ComposableScreen/Renderer.tsx parses with it.
export const ScreenElementsSchema = z.object({ elements: … }).superRefine(…);
export const ComposableScreenStepPayloadSchema = ScreenElementsSchema;
```

Do not rename the existing export, and do not re-declare the KAV walk a second time — that would be a third copy of it in the repo.

- [ ] **Step 3: Verify nothing changed for the existing caller**

```bash
npm run build
npm test --workspace=packages/onboarding-ui
```

Both must pass with the UI count still at 26.

- [ ] **Step 4: Commit**

```bash
git add packages/onboarding-ui/src/UI/Runtime/types.ts
git commit -m "♻️ refactor(ui): extract ScreenElementsSchema from the step-named payload schema"
```

---

### Task 3: `getPaywalls` on the client

**Files:**
- Create: `packages/onboarding/src/paywalls/types.ts`
- Create: `packages/onboarding/src/paywalls/getPaywalls.query.ts`
- Modify: `packages/onboarding/src/OnboardingStudioClient.ts`
- Test: `packages/onboarding/src/paywalls/__tests__/getPaywalls.test.ts` (new)

**Interfaces:**
- Produces: `client.getPaywalls(opts?, userDefinedParams?)` → `{ data: PaywallCatalog, headers: GetPaywallsResponseHeaders }`; `getPaywallsQuery(...)`; `PaywallCatalog`.

- [ ] **Step 1: Read the onboarding equivalents whole**

`OnboardingStudioClient.ts` and `getOnboarding.query.ts`. **The query module is hand-written against one client method, not a generic factory** — there is nothing to parameterize, so this is copy-and-adapt into a new file, and should be budgeted as real new code. Match its cache-first / background-revalidate / custom-key behaviour exactly; a paywall that revalidates differently from an onboarding is a bug nobody will find for months.

- [ ] **Step 2: Define the response types against the real contract**

The endpoint is live; this is its actual shape (spec §6.1, confirmed against the deployed function):

```ts
export type Paywall = {
  id: string; name: string; placement: string;
  elements: unknown[];                       // UIElement[]; parsed by the UI adapter, not here
  products: Array<{ key: string; ios?: string; android?: string; compareTo?: string }>;
  configuration: Record<string, unknown> | null;
};
export type PaywallCatalog = {
  metadata: { audienceId: number | null; audienceName: string | null; locale: string | null; draft: boolean };
  paywalls: Record<string, Paywall>;         // keyed by placement
  fonts: Record<string, unknown> | null;
};
```

Response headers are `ONBS-Audience-Id` and `ONBS-Paywall-Ids` (note: **not** the onboarding trio — do not copy that header list).

- [ ] **Step 3: Write the client method**

Same URL-building and error-surfacing as the onboarding method, against `get-paywalls`, with query params `projectId`, `platform`, `appVersion`, `locale`, optional `placement`, optional `draft`, plus arbitrary audience params. Omit `placement` by default — §6.1 returns all placements deliberately.

- [ ] **Step 4: Cache key + query module**

AsyncStorage namespace is **`rocapine-paywalls-*`**, distinct from the onboarding key. `staleTime: Infinity`. `clearCache()` must clear both namespaces — check what it does today and extend it rather than adding a second parallel method.

- [ ] **Step 5: Tests**

Cover: URL/param construction (including `placement` omitted by default), header extraction, an error response surfacing rather than resolving, and cache-key distinctness from the onboarding key. Assert on real values — a test that only asserts "did not throw" is not a test.

- [ ] **Step 6: Commit**

```bash
git add packages/onboarding/src/paywalls packages/onboarding/src/OnboardingStudioClient.ts
git commit -m "✨ feat(headless): add client.getPaywalls and its cached query"
```

---

### Task 4: `dismiss` and `presentPaywall` ButtonActions

**Files:**
- Modify: `packages/onboarding/src/steps/common.types.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/elements/actions.ts`
- Modify: `packages/onboarding-ui/src/UI/Runtime/elements/runActions.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: two dispatchable actions Task 7's host relies on.

- [ ] **Step 1: Confirm the gap**

`grep -rn "presentPaywall" packages/` returns nothing today; `runActions.ts:95-149` dispatches `continue`, `setVariable`, `custom`, `purchase`, `restore` only. The spec assumes `presentPaywall` exists; it does not. Both variants are new work.

- [ ] **Step 2: Headless schema**

Per §4.5, exactly:

```ts
{ type: "dismiss" }
{ type: "presentPaywall", placement: string }
```

Add the type members and the Zod variants together — they are the source of truth.

- [ ] **Step 3: UI mirror**

Mirror both in `Runtime/elements/actions.ts`. **The mirror is re-declared, not imported**, so TypeScript will not catch drift; the field sets must match by inspection.

- [ ] **Step 4: Dispatch**

- `dismiss` → `ctx.complete({ status: "dismissed" })`. §4.5 specifies that shape; `ScreenHost.complete` is currently `() => void`, so **widening it to take an optional outcome is part of this task**. Keep the argument optional so the onboarding adapter compiles untouched and simply ignores it.
- `presentPaywall` → **an optional `presentPaywall?: (placement: string) => void` field on `ScreenHost`**, dispatched as `ctx.presentPaywall?.(placement)`.

**Why a host field and not the paywall context.** It has to work in *both* hosts — that is how an onboarding step opens a paywall — which makes reaching into `PaywallProvider`'s context from `runActions.ts` tempting. Don't: it would make the UI action layer import headless paywall internals, and it would make this task depend on Task 6 having landed first. A `ScreenHost` field inverts that — each host supplies the capability it has, exactly as `products` already works, and Task 4 stays independent of Tasks 5-7.

When the field is absent, warn and no-op — the same behaviour `purchase`/`restore` already have when `ctx.products` is missing. Do not throw: an authoring mistake must not crash a host app mid-flow.

- [ ] **Step 5: Tests, then commit**

Add cases to the existing runActions tests: `dismiss` calls `complete`, `presentPaywall` no-ops with a warning when no provider is mounted.

```bash
git add packages/onboarding/src/steps/common.types.ts packages/onboarding-ui/src/UI/Runtime/elements/
git commit -m "✨ feat(runtime): add dismiss and presentPaywall button actions"
```

---

### Task 5: One product runtime, shared by both providers

**Files:**
- Create: `packages/onboarding/src/products/ProductRuntimeContext.tsx`
- Modify: `packages/onboarding/src/infra/provider/OnboardingProvider.tsx`

**Interfaces:**
- Consumes: `useProducts` (unchanged).
- Produces: `ProductRuntimeContext`, `useProductRuntime()` — Task 6 provides the value, `OnboardingProvider` consumes it.

- [ ] **Step 1: The context**

A React context carrying a `ProductRuntime | null`. `useProductRuntime()` returns the context value, or `null` when no provider is above.

- [ ] **Step 2: `OnboardingProvider` consumes-or-mounts**

Today `OnboardingProvider.tsx:204` unconditionally calls `useProducts(productRefs, productProvider, locale)`. Change it to: if a `ProductRuntime` is available from context, use that; otherwise mount its own exactly as now.

**Hooks rules matter here** — you cannot call `useProducts` conditionally. Call it unconditionally with a ref set that is empty when the context supplies a runtime, then pick which value to use. Note in a comment why the call is unconditional; a future reader will otherwise "simplify" it into a rules-of-hooks violation.

The standalone path must keep working unchanged: an app that mounts only `OnboardingProvider` with a `productProvider` behaves exactly as it does today.

- [ ] **Step 3: Test both arrangements**

Two tests: provider-above (one runtime, and it is the ancestor's instance), and standalone (mounts its own). Assert on instance identity, since "there is exactly one catalog" is the property that matters and a shape assertion cannot see it.

- [ ] **Step 4: Commit**

```bash
git add packages/onboarding/src/products/ packages/onboarding/src/infra/provider/OnboardingProvider.tsx
git commit -m "✨ feat(headless): share one product runtime across onboarding and paywall providers"
```

---

### Task 6: `PaywallProvider` and `usePaywall`

**Files:**
- Create: `packages/onboarding/src/paywalls/PaywallProvider.tsx`
- Create: `packages/onboarding/src/paywalls/usePaywall.ts`
- Modify: `packages/onboarding/src/index.ts`

**Interfaces:**
- Consumes: `getPaywallsQuery` (Task 3), `ProductRuntimeContext` (Task 5).
- Produces: `PaywallProvider`, `usePaywall()` → `{ present, isReady, catalog }`.

- [ ] **Step 1: The provider**

Own `QueryClient` (module-scope singleton in its own file, mirroring `OnboardingProvider.tsx:16-22` — the onboarding one is private and cannot be reused). Fetch the catalog, mount `useProducts` over the **union** of every `paywall.products[]` in the catalog, deduplicated, and publish that runtime through `ProductRuntimeContext` so descendants — including `OnboardingProvider` — share it.

Flattening the union is the decision from "Design decisions" §2: resolving per-presented-paywall would put a store round-trip on the buy tap, which is the latency §6.1 exists to avoid.

- [ ] **Step 2: `present()`**

```ts
present(placement: string): Promise<{ status: "purchased" | "dismissed" | "cancelled" | "error" }>
```

Sets the active placement (making the Modal visible) and returns a promise resolved by the host's `complete`. Decide and document what happens when: the placement is absent from the catalog (resolve `"error"`, do not throw — a missing placement must not crash a host app mid-flow), and `present` is called while another paywall is showing.

- [ ] **Step 3: `usePaywall`**

`{ present, isReady, catalog }`. `isReady` means the catalog resolved **and** products resolved — the whole point is that `present()` is instant, so a caller needs one flag that means "presenting now will not show a spinner".

- [ ] **Step 4: Tests**

`present()` resolves with what `complete` reports; an unknown placement resolves `"error"` rather than throwing; `isReady` is false until both catalog and products are ready.

- [ ] **Step 5: Export and commit**

Export `PaywallProvider`, `usePaywall`, and the paywall types from the package root.

```bash
git add packages/onboarding/src/paywalls/ packages/onboarding/src/index.ts
git commit -m "✨ feat(headless): add PaywallProvider and usePaywall"
```

---

### Task 7: `PaywallHost` — the second `ScreenHost`

**Files:**
- Create: `packages/onboarding-ui/src/UI/Paywall/PaywallHost.tsx`
- Modify: `packages/onboarding-ui/src/index.ts`
- Modify: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx` — **added after the plan was written.** `presentPaywall` must work in *both* hosts (§4.5, §7): that is how an onboarding step opens a paywall. Grep confirmed the onboarding adapter never supplies the field, so after Task 4 the capability exists, is wired through ctx, and is reachable from **zero** hosts — the same failure shape as Ruling 7, one layer up. This task supplies it in the adapter's existing `useMemo`'d host object, sourced from `usePaywall().present`. An onboarding app with no `PaywallProvider` above it must keep working unchanged: the field is optional and `runActions` already warns-and-no-ops when absent.

**Interfaces:**
- Consumes: `usePaywall` (Task 6), `ScreenElementsSchema` (Task 2), `ScreenRenderer` (unchanged).
- Produces: `PaywallHost`.

- [ ] **Step 1: Read the existing adapter**

`Pages/ComposableScreen/Renderer.tsx` (64 lines) is the only existing `ScreenHost` implementation. Yours is structurally identical but simpler: **no dual-write** (paywalls do not branch on steps, so there is no second variable store to sync) and **no `OnboardingTemplate`** (a paywall is a root, not a step with progress chrome).

- [ ] **Step 2: The Modal**

**This is the first `Modal` in the codebase** — there is no precedent to copy, so decide and document each of: `presentationStyle`/`transparent`, safe-area handling *inside* the modal, and Android hardware back. Back must resolve the same way `dismiss` does (`onRequestClose` → `complete({status:"dismissed"})`), or Android users get a paywall they cannot leave.

- [ ] **Step 3: Build the host**

Memoize `setVariable`, `customActions` and `products` — all three are contractually referentially stable and an unstable one silently defeats `React.memo` with no type error. Parse elements with `ScreenElementsSchema` from Task 2.

- [ ] **Step 4: Verify in the example app**

```bash
npm run build
```

Then run the example app and actually present a paywall. **Say what you observed** — a build passing is not evidence the Modal renders.

Observe and report each of these. The last two are **carried over from Task 4**, which wired both capabilities but could not assert on them: `packages/onboarding-ui/vitest.config.ts` documents its Node environment as deliberate — *"Element renderers are verified by tsc and the example app"* — so this run is the prescribed verification for them, not a nice-to-have.

1. Variable writes update dependent text and `renderWhen` gates.
2. A `purchase` action drives `products.purchasing` (a spinner gated on it appears).
3. An authored `SafeAreaView` element gets **non-zero** insets inside the Modal — this is the `SafeAreaProvider`-inside-Modal hazard; zero insets means the provider is missing and every paywall lays out under the notch.
4. Android hardware back resolves the same as `dismiss`, so a user is never trapped in a paywall.
5. **A `dismiss` action resolves `present()` with `{ status: "dismissed" }`** — proving the outcome survives `stableOnContinue`'s forwarding rather than being dropped.
6. **A `presentPaywall` action fired from an onboarding step actually opens a paywall** — proving the ctx field reaches a real host, in the host that is not the paywall's own.

- [ ] **Step 5: Commit**

```bash
git add packages/onboarding-ui/src/UI/Paywall/ packages/onboarding-ui/src/index.ts
git commit -m "✨ feat(ui): add PaywallHost rendering a paywall in a fullScreen modal"
```

---

### Task 8: Example app, docs, version bump

**Files:**
- Create: `example/app/example/paywall.tsx`
- Modify: `packages/onboarding/src/onboarding-example.ts`
- Modify: `.claude/rules/composable-screen-runtime.md`, `website/docs/` as applicable

- [ ] **Step 1: Example screen** exercising `PaywallProvider` + `PaywallHost` + `present()`, with the stub product provider so it runs with no billing SDK.
- [ ] **Step 2: Document** the two new ButtonActions and the provider arrangement — specifically that `PaywallProvider` goes *above* `OnboardingProvider`, and why.
- [ ] **Step 3: `/bump-version minor`** — new features, no breaking changes. It edits and stages all five files; `npm run check:versions` gates the publish.
- [ ] **Step 4: Commit.**

---

## Definition of done

- [ ] `npm run build` clean for both packages.
- [ ] `npm test --workspace=packages/onboarding` — **≥159 passing**, no failures.
- [ ] `npm test --workspace=packages/onboarding-ui` — **≥26 passing**, no failures.
- [ ] `customActions` defaults to a module-scope constant, matching `EMPTY_PRODUCT_RUNTIME`. **Verified by inspection, not by a test** — see Task 1 Step 2 for why a test here would be worse than none, and do not let a reviewer talk this into a rendering harness.
- [ ] `ScreenElementsSchema` exported from the UI runtime; `ComposableScreenStepPayloadSchema` still exported and behaviourally unchanged.
- [ ] `client.getPaywalls()` returns catalog + headers, cached under `rocapine-paywalls-*`.
- [ ] `dismiss` and `presentPaywall` exist in headless schema, UI mirror, and dispatch.
- [ ] Exactly one product runtime when both providers are mounted, proven by instance identity.
- [ ] `present()` resolves with a real outcome; an unknown placement resolves `"error"` rather than throwing.
- [ ] A paywall renders in the example app and was **observed doing so**, not merely built.
- [ ] `packages/onboarding-ui/src/UI/Runtime/` is unchanged.

## Follow-ups this plan does NOT do

- **Phase 6:** studio editor routes, product panels, preview injection, publish gate, `scanElements` extension.
- **Phase 7:** seeded paywall templates for the products-failed and purchasing-in-flight patterns.
- **§11.0 item 3** — the `update-uielement` skill's wrong premise. Pre-existing and unrelated to the runtime; its own change.
- **Per-placement `metadata.locale`** — the studio returns one locale for the whole catalog; if placements ever resolve locales independently this needs settling before the SDK's types harden.
