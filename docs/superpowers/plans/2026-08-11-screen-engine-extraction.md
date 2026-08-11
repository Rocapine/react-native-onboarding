# Screen Rendering Engine Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the ComposableScreen rendering engine from the onboarding page layer into a screen-agnostic `Runtime` module behind a single injected `ScreenHost` seam, so a paywall renderer can reuse it without touching onboarding code.

**Architecture:** Pure refactor, no behaviour change. Headless element schemas move from `src/steps/ComposableScreen/` to `src/screens/`; the step schema stays behind as a thin wrapper that re-exports everything. In the UI package the 40 element files move from `src/UI/Pages/ComposableScreen/elements/` to `src/UI/Runtime/elements/`, and the body of `Renderer.tsx` becomes a generic `ScreenRenderer` that takes `{ elements, host }`. The existing `Renderer.tsx` shrinks to a ~40-line adapter that builds a `ScreenHost` from the onboarding contexts and wraps the result in `OnboardingTemplate`.

**Tech Stack:** TypeScript, Zod v4, React Native 0.85, React 19, react-native-reanimated 4, vitest (headless only today — this plan adds it to the UI package).

## Global Constraints

Every task's requirements implicitly include these.

- **No behaviour change.** This is a refactor. If a test or the example app behaves differently, the change is wrong.
- **Every existing import path must keep working.** Both packages ship `src` **and** `dist` (`"files": ["dist","src","README.md"]`), and `onboarding-studio` pins a published version and imports from the package root. Old paths stay as re-export files.
- **`dist/steps/ComposableScreen/types.js` must keep exporting `ComposableScreenStepTypeSchema`.** The root `CLAUDE.md` debugging recipe validates CMS payloads with `require('./packages/onboarding/dist/steps/ComposableScreen/types.js')`. Breaking it breaks a documented workflow.
- **Preserve the element memoization architecture exactly.** `RenderContext` must stay referentially stable across variable writes (it changes only on theme switch); volatile variable maps travel through `VariablesContext`. Getting this wrong silently reintroduces the whole-tree re-render storm that v1.59 fixed and no type error will catch it.
- **No new npm packages. No new peer dependencies.** vitest is added to `packages/onboarding-ui` as a **devDependency** only.
- **Both packages share one version number**, enforced by `scripts/check-versions.mjs` on every publish path. Do not bump versions inside these tasks — version bump belongs to the release, via the `bump-version` skill.
- **Run all commands from the repo root** unless a task says otherwise.

## Scope

This plan covers **Phase 1 only** of `docs/superpowers/specs/2026-08-11-paywall-rendering-engine-design.md`.

Phase 2 (extracting `resolveAudience` / `serveEnvelope` / `deploymentLocale` from `get-onboarding-steps` in the `onboarding-studio` repo) is an independent subsystem in a different repo with no code dependency on this one. It gets its own plan. Do not start it here.

## Baseline warning

Plan against `origin/main` (v1.59.2). The branch `perf/composable-screen-memo-rerender` is **behind** main and has a materially different `RenderContext` (it still carries `variables`/`flatVariables`; main replaced those with a ref-backed `getVariables()` plus `VariablesContext`). Do not copy shapes from that branch.

Note also that `.claude/rules/composable-screen-runtime.md` currently documents the **old** `ctx.flatVariables` shape and is stale against main. Task 5 fixes it.

---

## File Structure

**Headless — `packages/onboarding/src/`**

| Path | Responsibility |
|---|---|
| `screens/elements/*.ts` (26 files, moved) | Per-element prop types + Zod schemas. Screen-agnostic. |
| `screens/types.ts` (new, from split) | `UIElement` union, `UIElementSchema`, `ScreenElementsSchema` (array + nested-KAV refinement), `ComposableVariableEntry`/`Kind`, all element re-exports. |
| `steps/ComposableScreen/types.ts` (rewritten, thin) | `ComposableScreenStepPayloadSchema`, `ComposableScreenStepTypeSchema`, plus `export * from "../../screens/types"` for back-compat. |

**UI — `packages/onboarding-ui/src/UI/`**

| Path | Responsibility |
|---|---|
| `Runtime/elements/*` (40 files, moved) | Element renderers, `renderElement` dispatcher, `shared.ts`, contexts, `runActions`, `expression`, `collectDefaults`. |
| `Runtime/types.ts` (moved) | UI mirror of the `UIElement` union. |
| `Runtime/variables.ts` (new) | Pure `mergeVariables` + `flattenVariables`. Unit-tested. |
| `Runtime/ScreenHost.ts` (new) | The `ScreenHost` seam type + `noopScreenHost`. |
| `Runtime/ScreenRenderer.tsx` (new) | Generic engine: `{ elements, host }` → rendered tree. No onboarding imports. |
| `Runtime/index.ts` (new) | Public surface of the runtime module. |
| `Pages/ComposableScreen/Renderer.tsx` (rewritten) | ~40-line onboarding adapter: contexts → `ScreenHost`, wraps in `OnboardingTemplate`. |
| `Pages/ComposableScreen/types.ts` (rewritten, thin) | `export * from "../../Runtime/types"`. |

**Why `Runtime/` sits directly under `UI/` and not under `Pages/`:** `Pages/` means "a thing `OnboardingPage` can switch to". The runtime is not a page — it is what pages are built from — and a paywall will consume it without being a page at all.

---

### Task 1: Headless — split element schemas into `src/screens/`

**Files:**
- Move: `packages/onboarding/src/steps/ComposableScreen/elements/` → `packages/onboarding/src/screens/elements/` (26 files)
- Create: `packages/onboarding/src/screens/types.ts`
- Modify: `packages/onboarding/src/steps/ComposableScreen/types.ts` (539 lines → ~45)
- Test: `packages/onboarding/src/__tests__/screenTypesBackCompat.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (first task).
- Produces: `packages/onboarding/src/screens/types.ts` exporting `UIElement`, `UIElementSchema`, `ScreenElementsSchema`, `ComposableVariableEntry`, `ComposableVariableKind`, and every element prop type/schema that `steps/ComposableScreen/types.ts` exports today. `steps/ComposableScreen/types.ts` keeps exporting `ComposableScreenStepType`, `ComposableScreenStepTypeSchema`, `ComposableScreenStepPayloadSchema` plus everything above via `export *`.

**Heads-up — `UIElement` and `UIElementSchema` are currently module-private in headless.** At `steps/ComposableScreen/types.ts:115` and `:310` they are declared as bare `type` / `const` with no `export`, because until now the only consumer was the step payload schema in the same file. (The UI package re-declares its own mirror where both *are* exported — `Pages/ComposableScreen/types.ts:93,288`.)

Making them public is a deliberate, additive part of this task: once the elements array is a first-class screen concept rather than an internal detail of a step payload, a paywall payload schema and a paywall renderer both need them. Nothing breaks — these are new exports, not changed ones.

- [ ] **Step 1: Write the failing back-compat test**

Create `packages/onboarding/src/__tests__/screenTypesBackCompat.test.ts`:

```ts
import { describe, it, expect } from "vitest";
// Old path — must keep working for onboarding-studio and every host app.
import {
  ComposableScreenStepTypeSchema,
  UIElementSchema,
} from "../steps/ComposableScreen/types";
// New path — the screen-agnostic home.
import {
  UIElementSchema as ScreenUIElementSchema,
  ScreenElementsSchema,
} from "../screens/types";

const textElement = {
  id: "t1",
  type: "Text",
  props: { content: "Hello" },
};

const step = {
  id: "s1",
  name: "Step 1",
  type: "ComposableScreen",
  displayProgressHeader: true,
  payload: { elements: [textElement] },
};

describe("screen types back-compat", () => {
  it("parses a UIElement from the old path", () => {
    expect(UIElementSchema.safeParse(textElement).success).toBe(true);
  });

  it("parses a UIElement from the new path", () => {
    expect(ScreenUIElementSchema.safeParse(textElement).success).toBe(true);
  });

  it("both paths expose the same schema object", () => {
    expect(UIElementSchema).toBe(ScreenUIElementSchema);
  });

  it("still parses a full ComposableScreen step from the old path", () => {
    const result = ComposableScreenStepTypeSchema.safeParse(step);
    expect(result.success).toBe(true);
  });

  it("ScreenElementsSchema rejects a KeyboardAvoidingView nested in another", () => {
    const nested = [
      {
        id: "kav1",
        type: "KeyboardAvoidingView",
        props: {},
        children: [
          { id: "kav2", type: "KeyboardAvoidingView", props: {}, children: [] },
        ],
      },
    ];
    expect(ScreenElementsSchema.safeParse(nested).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/onboarding -- screenTypesBackCompat
```

Expected: FAIL — `Cannot find module '../screens/types'`.

- [ ] **Step 3: Move the element files with git mv**

```bash
cd packages/onboarding/src
mkdir -p screens
git mv steps/ComposableScreen/elements screens/elements
```

The element files import only from `zod`, each other, and `../../common.types`. That last path was `steps/ComposableScreen/elements/*` → `src/steps/common.types`; it is now `screens/elements/*` → needs `../../steps/common.types`. Fix them:

```bash
cd packages/onboarding/src/screens/elements
grep -rl '"\.\./\.\./common.types"' . | xargs sed -i '' 's|"\.\./\.\./common.types"|"../../steps/common.types"|g'
grep -rn "common.types" .   # verify: every hit is now ../../steps/common.types
```

- [ ] **Step 4: Create `screens/types.ts` from the top of the old file**

`packages/onboarding/src/screens/types.ts` is the old `steps/ComposableScreen/types.ts` with the step-specific tail removed and one schema added. Concretely:

1. Copy `steps/ComposableScreen/types.ts` to `screens/types.ts`.
2. The `./elements/*` import paths need **no change** — the elements directory moved alongside this file in Step 3, so the relative paths still resolve.
3. Change the `common.types` import at the top from `"../common.types"` to `"../steps/common.types"` (this file went from `src/steps/ComposableScreen/` to `src/screens/`, so it no longer sits under `steps/`).
4. Add `export` to the two currently-private declarations, per the Interfaces note above:
   - line ~115: `type UIElement =` → `export type UIElement =`
   - line ~310: `const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>` → `export const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>`
   Leave `TextUIElementSchema` private — it is an internal building block of the union, and the UI mirror keeps it private too.
5. Delete `ComposableScreenStepPayloadSchema`, `ComposableScreenStepTypeSchema`, and the `ComposableScreenStepType` type alias (the last ~20 lines) — they move to the step wrapper in Step 5.
6. Keep `collectNestedKeyboardAvoidingViews` (still private) and add this in their place:

```ts
/**
 * The elements array of any composable screen — an onboarding step payload, a
 * paywall, or anything else built on this engine. Carries the nested-
 * KeyboardAvoidingView refinement that used to live on the step payload schema,
 * because the constraint is a property of the element tree, not of steps.
 */
export const ScreenElementsSchema = z
  .array(UIElementSchema)
  .superRefine((elements, ctx) => {
    const offenders: string[] = [];
    collectNestedKeyboardAvoidingViews(elements, false, offenders);
    for (const id of offenders) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: `KeyboardAvoidingView (id="${id}") cannot be nested inside another KeyboardAvoidingView.`,
      });
    }
  });
```

- [ ] **Step 5: Rewrite `steps/ComposableScreen/types.ts` as the thin step wrapper**

Replace the entire file with:

```ts
import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";
import { ScreenElementsSchema } from "../../screens/types";

// Everything screen-agnostic now lives in src/screens/types.ts. Re-exported here
// so every existing import path — including host apps, onboarding-studio, and the
// documented `dist/steps/ComposableScreen/types.js` validation recipe in
// CLAUDE.md — keeps resolving.
export * from "../../screens/types";

export const ComposableScreenStepPayloadSchema = z.object({
  elements: ScreenElementsSchema,
});

export const ComposableScreenStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("ComposableScreen"),
  payload: ComposableScreenStepPayloadSchema,
});

export type ComposableScreenStepType = z.infer<typeof ComposableScreenStepTypeSchema>;
```

Note the `import { ScreenElementsSchema }` alongside `export *` is legal — `export *` re-exports it, and the local `import` binds it for use in this file. (Contrast with the `import { X } … export { X } from "…"` duplicate-export trap noted in the root `CLAUDE.md`.)

- [ ] **Step 6: Verify the error path moved correctly**

The nested-KAV issue `path` changed from `["elements"]` (on the payload object) to `[]` (on the array) — and the step schema nests the array under `elements`, so the final path a caller sees is still `payload.elements`. Confirm:

```bash
npm test --workspace=packages/onboarding -- screenTypesBackCompat
```

Expected: PASS, all 5 tests.

- [ ] **Step 7: Run the full headless suite and build**

```bash
npm test --workspace=packages/onboarding
npm run build:headless
ls packages/onboarding/dist/steps/ComposableScreen/types.js packages/onboarding/dist/screens/types.js
```

Expected: all tests pass; both dist files exist.

- [ ] **Step 8: Verify the documented CMS-validation recipe still works**

```bash
node -e "
const m = require('./packages/onboarding/dist/steps/ComposableScreen/types.js');
if (typeof m.ComposableScreenStepTypeSchema?.safeParse !== 'function') throw new Error('recipe broken');
console.log('OK: ComposableScreenStepTypeSchema still exported from the old dist path');
"
```

Expected: `OK: ...`.

- [ ] **Step 9: Commit**

```bash
git add packages/onboarding/src packages/onboarding/src/__tests__
git commit -m "♻️ refactor(headless): move element schemas to src/screens, keep step wrapper"
```

---

### Task 2: UI — move the element runtime to `UI/Runtime/`

**Files:**
- Move: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/` → `packages/onboarding-ui/src/UI/Runtime/elements/` (40 files)
- Move: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts` → `packages/onboarding-ui/src/UI/Runtime/types.ts`
- Create: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts` (thin re-export)
- Modify: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx` (import paths only)

**Interfaces:**
- Consumes: Task 1's `@rocapine/react-native-onboarding` export of `ComposableVariableEntry` (already exported today — no new export needed).
- Produces: `UI/Runtime/elements/*` and `UI/Runtime/types.ts` at their new paths, with `renderElement`, `RenderContext`, `areElementPropsEqual`, `VariablesContext`, `useVariables`, `AnimatedVariablesContext`, `useAnimatedVariablesRegistry`, `collectElementDefaults`, `runActions`, `interpolate` all unchanged in signature.

This task is deliberately mechanical: **move files and fix import depth only.** No logic changes. Task 4 does the rewiring.

- [ ] **Step 1: Move the directory and the types mirror**

```bash
cd packages/onboarding-ui/src/UI
mkdir -p Runtime
git mv Pages/ComposableScreen/elements Runtime/elements
git mv Pages/ComposableScreen/types.ts Runtime/types.ts
```

- [ ] **Step 2: Fix the four Theme imports (depth drops by one)**

Moving from `UI/Pages/ComposableScreen/elements/` to `UI/Runtime/elements/` removes one directory level, so `../../../` becomes `../../`. There are exactly four such imports:

```bash
cd packages/onboarding-ui/src/UI/Runtime/elements
sed -i '' 's|"\.\./\.\./\.\./Theme/helpers"|"../../Theme/helpers"|g' LottieElement.tsx VideoElement.tsx RiveElement.tsx
sed -i '' 's|"\.\./\.\./\.\./Theme/types"|"../../Theme/types"|g' shared.ts
grep -rn '\.\./\.\./\.\./' . || echo "OK: no 3-level imports remain"
```

Expected: `OK: no 3-level imports remain`.

- [ ] **Step 3: Cut the runtime's dependency on the onboarding provider**

Four files import `ComposableVariableEntry` from `../../../Provider/OnboardingProgressProvider`. That provider merely re-exports the type from the headless package (`OnboardingProgressProvider.tsx:3,7`). Importing it from headless instead removes the runtime's last structural tie to the onboarding UI provider — which is the point of this whole phase, not just a path fix.

```bash
cd packages/onboarding-ui/src/UI/Runtime/elements
sed -i '' \
  -e 's|import { ComposableVariableEntry } from "\.\./\.\./\.\./Provider/OnboardingProgressProvider";|import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";|' \
  -e 's|import type { ComposableVariableEntry } from "\.\./\.\./\.\./Provider/OnboardingProgressProvider";|import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";|' \
  collectDefaults.ts shared.ts VariablesContext.tsx TextElement.tsx
grep -rn "OnboardingProgressProvider" . || echo "OK: runtime no longer imports the onboarding provider"
```

Expected: `OK: runtime no longer imports the onboarding provider`.

- [ ] **Step 4: Leave a back-compat types re-export at the old path**

Create `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts`:

```ts
// The UIElement mirror moved to UI/Runtime/types.ts when the rendering engine was
// generalized to serve paywalls as well as onboarding steps. Re-exported here so
// existing deep imports keep resolving.
export * from "../../Runtime/types";
```

- [ ] **Step 5: Repoint `Renderer.tsx` imports at the new locations**

In `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx`, change these five import paths (nothing else in the file yet):

```ts
import { RenderContext } from "../../Runtime/elements/shared";
import { renderElement } from "../../Runtime/elements/renderElement";
import { VariablesContext } from "../../Runtime/elements/VariablesContext";
import { AnimatedVariablesContext, useAnimatedVariablesRegistry } from "../../Runtime/elements/AnimatedVariablesContext";
import { collectElementDefaults } from "../../Runtime/elements/collectDefaults";
```

Leave `import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";` as-is — the new `./types` re-export file resolves it.

- [ ] **Step 6: Type-check and build**

```bash
npm run build --workspace=packages/onboarding-ui
```

Expected: clean build, no errors. If `tsc` reports an unresolved relative import, a file was missed — re-run the greps from steps 2 and 3.

- [ ] **Step 7: Confirm no behaviour changed**

```bash
git diff --stat HEAD~1 -- packages/onboarding-ui/src/UI/Runtime/
```

Expected: every changed line is an import path. If any hunk touches a function body, revert it — logic changes belong to Task 4.

- [ ] **Step 8: Commit**

```bash
git add packages/onboarding-ui/src
git commit -m "♻️ refactor(ui): move element runtime to UI/Runtime, drop onboarding provider import"
```

---

### Task 3: UI — test infrastructure + pure variable helpers

**Files:**
- Create: `packages/onboarding-ui/vitest.config.ts`
- Modify: `packages/onboarding-ui/package.json` (add `test` script + vitest devDep)
- Create: `packages/onboarding-ui/src/UI/Runtime/variables.ts`
- Test: `packages/onboarding-ui/src/UI/Runtime/__tests__/variables.test.ts`
- Test: `packages/onboarding-ui/src/UI/Runtime/__tests__/runActions.test.ts`

**Interfaces:**
- Consumes: `UI/Runtime/elements/runActions.ts` (`runActions(actions, ctx)`) and `UI/Runtime/elements/shared.ts` (`RenderContext`), both at their Task 2 paths.
- Produces: `UI/Runtime/variables.ts` exporting
  `mergeVariables(defaults: Record<string, ComposableVariableEntry>, hostVariables: Record<string, ComposableVariableEntry>): Record<string, ComposableVariableEntry>`
  and `flattenVariables(variables: Record<string, ComposableVariableEntry>): Record<string, unknown>`.
  Task 4 calls both.

The UI package has **no test infrastructure today**. This task adds the minimum: vitest in node environment, testing pure modules only (no React rendering). That is enough to lock the two behaviours this refactor is most likely to silently break — variable merge order, and `"continue"` being terminal — and it pays forward into Phase 3, which adds `purchase`/`restore`/`dismiss` arms to `runActions`.

- [ ] **Step 1: Add vitest to the UI package**

```bash
npm install --save-dev --workspace=packages/onboarding-ui vitest@^4.1.5
```

Then add to `packages/onboarding-ui/package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Add the vitest config**

Create `packages/onboarding-ui/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

// Node environment on purpose: these tests cover pure modules (variable merging,
// action dispatch), not React Native rendering. Element renderers are verified by
// tsc and the example app.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing variables test**

Create `packages/onboarding-ui/src/UI/Runtime/__tests__/variables.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeVariables, flattenVariables } from "../variables";

describe("mergeVariables", () => {
  it("overlays host values on top of element defaults", () => {
    const defaults = { plan: { value: "monthly" }, seen: { value: "no" } };
    const host = { plan: { value: "yearly", label: "Yearly" } };
    expect(mergeVariables(defaults, host)).toEqual({
      plan: { value: "yearly", label: "Yearly" },
      seen: { value: "no" },
    });
  });

  it("keeps defaults the host has not overridden", () => {
    expect(mergeVariables({ a: { value: "1" } }, {})).toEqual({ a: { value: "1" } });
  });

  // Inverting this spread is the classic regression: user-driven writes get
  // clobbered by element defaults on every render.
  it("never lets a default win over a host value", () => {
    const merged = mergeVariables({ k: { value: "default" } }, { k: { value: "user" } });
    expect(merged.k.value).toBe("user");
  });
});

describe("flattenVariables", () => {
  it("unwraps each entry to its primitive value", () => {
    expect(flattenVariables({ a: { value: "1" }, b: { value: "x", label: "X" } }))
      .toEqual({ a: "1", b: "x" });
  });

  it("tolerates an undefined entry", () => {
    const input = { a: undefined } as unknown as Record<string, { value: string }>;
    expect(flattenVariables(input)).toEqual({ a: undefined });
  });

  it("returns an empty object for no variables", () => {
    expect(flattenVariables({})).toEqual({});
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

```bash
npm test --workspace=packages/onboarding-ui -- variables
```

Expected: FAIL — `Cannot find module '../variables'`.

- [ ] **Step 5: Write `variables.ts`**

Create `packages/onboarding-ui/src/UI/Runtime/variables.ts`:

```ts
import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";

/**
 * Element-declared defaults (Carousel.defaultIndex, RadioGroup.defaultValue, …)
 * overlaid by the host-owned variable store. The host ALWAYS wins — inverting
 * this spread clobbers user-driven writes with defaults on every render.
 */
export const mergeVariables = (
  defaults: Record<string, ComposableVariableEntry>,
  hostVariables: Record<string, ComposableVariableEntry>
): Record<string, ComposableVariableEntry> => ({ ...defaults, ...hostVariables });

/**
 * Entry map → primitive map, for `evaluateCondition` / `renderWhen`, which want
 * `Record<string, unknown>` rather than `{value, label}` entries. Skipping this
 * makes every `eq`/`neq` compare against the entry object and silently mis-evaluate.
 */
export const flattenVariables = (
  variables: Record<string, ComposableVariableEntry>
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, v?.value]));
```

- [ ] **Step 6: Run to verify it passes**

```bash
npm test --workspace=packages/onboarding-ui -- variables
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Write the runActions seam test**

This locks the behaviour Task 4 depends on: `"continue"` invokes the host callback and stops the loop. Create `packages/onboarding-ui/src/UI/Runtime/__tests__/runActions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runActions } from "../elements/runActions";
import type { RenderContext } from "../elements/shared";

const makeCtx = (overrides: Partial<RenderContext> = {}): RenderContext => {
  const variables: Record<string, { value: string; label?: string }> = {};
  return {
    theme: {} as RenderContext["theme"],
    getVariables: () => variables,
    setVariable: (key, entry) => {
      variables[key] = entry;
    },
    onContinue: vi.fn(),
    customActions: {},
    renderChildren: () => null,
    ...overrides,
  } as RenderContext;
};

describe("runActions", () => {
  it("invokes the host continue callback for the 'continue' action", async () => {
    const onContinue = vi.fn();
    await runActions(["continue"], makeCtx({ onContinue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // 'continue' is terminal — this is what lets a paywall map it to "dismiss"
  // without later actions leaking through after the screen is gone.
  it("stops the loop after 'continue'", async () => {
    const ctx = makeCtx();
    await runActions(
      ["continue", { type: "setVariable", name: "after", value: "written" }],
      ctx
    );
    expect(ctx.getVariables().after).toBeUndefined();
  });

  it("writes a variable for the setVariable action", async () => {
    const ctx = makeCtx();
    await runActions([{ type: "setVariable", name: "plan", value: "yearly" }], ctx);
    expect(ctx.getVariables().plan.value).toBe("yearly");
  });

  it("invokes a registered custom action", async () => {
    const handler = vi.fn();
    const ctx = makeCtx({ customActions: { doThing: handler } });
    await runActions([{ type: "custom", function: "doThing" }], ctx);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 8: Run it**

```bash
npm test --workspace=packages/onboarding-ui -- runActions
```

Expected: PASS, 4 tests.

If it fails to import with a `react-native` resolution error, add a module stub at the top of the test file — the headless suite uses the same technique in `packages/onboarding/src/__tests__/resolveFontFamily.test.ts`:

```ts
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, StyleSheet: { create: (s: unknown) => s } }));
```

- [ ] **Step 9: Run the whole UI suite and commit**

```bash
npm test --workspace=packages/onboarding-ui
git add packages/onboarding-ui
git commit -m "✅ test(ui): add vitest, extract pure variable helpers, cover runActions"
```

---

### Task 4: UI — `ScreenHost` seam and generic `ScreenRenderer`

**Files:**
- Create: `packages/onboarding-ui/src/UI/Runtime/ScreenHost.ts`
- Create: `packages/onboarding-ui/src/UI/Runtime/ScreenRenderer.tsx`
- Create: `packages/onboarding-ui/src/UI/Runtime/index.ts`
- Modify: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx` (rewrite as adapter)
- Modify: `packages/onboarding-ui/src/index.ts` (export the runtime module)

**Interfaces:**
- Consumes: `mergeVariables` / `flattenVariables` from Task 3's `UI/Runtime/variables.ts`; `renderElement`, `RenderContext`, `VariablesContext`, `AnimatedVariablesContext`, `useAnimatedVariablesRegistry`, `collectElementDefaults` from Task 2's `UI/Runtime/elements/*`.
- Produces: `ScreenHost` type, `noopScreenHost`, and `ScreenRenderer({ elements, host }: ScreenRendererProps)`. Phase 5's `PaywallRenderer` consumes exactly these.

**Deviations from spec §3.2 (deliberate — the spec was written before reading the merged renderer):**

| Spec §3.2 | This plan | Why |
|---|---|---|
| `topInset: number` | `keyboardVerticalOffset: number` | The real renderer uses this value for exactly one thing: `KeyboardAvoidingView`'s `keyboardVerticalOffset`. `OnboardingTemplate` handles the actual top padding and stays in the adapter. Naming it `topInset` would imply the engine does layout it does not do. |
| `products?: ProductRuntime` | omitted | Phase 3 adds it. Declaring a field with no type behind it now would be a placeholder. It is an optional field, so adding it later is non-breaking. |
| `variables` not listed | `variables` + `setVariable` | The spec's sketch omitted the store itself. The engine cannot render without it — the onboarding renderer reads `composableVariables` from context today. |

Update the spec's §3.2 snippet to match this table when this task lands, so the two documents do not drift.

**Naming note — `host.complete` vs `ctx.onContinue`:** the `ScreenHost` seam exposes `complete`, because "finish this screen" is what a *host* does. Inside the engine, `RenderContext` keeps `onContinue`, because "the continue action fired" is what an *element* dispatches. `ScreenRenderer` maps one to the other in one place. This is deliberate: it keeps the engine diff to zero files (only `shared.ts` and `runActions.ts` mention `onContinue`, and neither changes), while the paywall host is free to interpret `complete` as "dismiss".

- [ ] **Step 1: Create the `ScreenHost` seam**

Create `packages/onboarding-ui/src/UI/Runtime/ScreenHost.ts`:

```ts
import type { ComposableVariableEntry, CustomActions } from "@rocapine/react-native-onboarding";

/**
 * Everything the rendering engine needs from whatever is hosting the screen.
 * The onboarding step renderer and the paywall renderer each build one of these;
 * the engine itself knows about neither.
 */
export type ScreenHost = {
  /** Host-owned variable store. Element defaults are overlaid beneath it. */
  variables: Record<string, ComposableVariableEntry>;
  /** Write a variable back into the host store. Must be referentially stable. */
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  /**
   * Finish this screen. Onboarding → advance to the next step. Paywall → resolve
   * the placement. Reached from a `"continue"` press action.
   */
  complete: () => void;
  /** Host-registered handlers for `{ type: "custom" }` actions. Must be stable. */
  customActions: CustomActions;
  /** Offset for keyboard avoidance — the measured progress header, or 0. */
  keyboardVerticalOffset: number;
};

export const noopScreenHost: ScreenHost = {
  variables: {},
  setVariable: () => {},
  complete: () => {},
  customActions: {},
  keyboardVerticalOffset: 0,
};
```

- [ ] **Step 2: Create the generic `ScreenRenderer`**

This is the current `Renderer.tsx` body with the onboarding contexts replaced by `host` and the `OnboardingTemplate` wrapper removed. **Every `useRef`/`useCallback`/`useMemo` below is load-bearing for the memoization architecture — do not simplify any of them.**

Create `packages/onboarding-ui/src/UI/Runtime/ScreenRenderer.tsx`:

```tsx
import { useCallback, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import type { UIElement } from "./types";
import type { ScreenHost } from "./ScreenHost";
import { useTheme } from "../Theme/useTheme";
import { RenderContext } from "./elements/shared";
import { renderElement } from "./elements/renderElement";
import { VariablesContext } from "./elements/VariablesContext";
import { AnimatedVariablesContext, useAnimatedVariablesRegistry } from "./elements/AnimatedVariablesContext";
import { collectElementDefaults } from "./elements/collectDefaults";
import { mergeVariables, flattenVariables } from "./variables";

export type ScreenRendererProps = {
  elements: UIElement[];
  host: ScreenHost;
};

type ParentType = "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";

/**
 * The screen-agnostic rendering engine. Renders a UIElement tree against an
 * injected ScreenHost. Knows nothing about onboarding steps or paywalls — the
 * caller supplies the host and any surrounding chrome.
 */
export const ScreenRenderer = ({ elements, host }: ScreenRendererProps) => {
  const { theme } = useTheme();
  const { variables: hostVariables, setVariable, complete, customActions, keyboardVerticalOffset } = host;

  // Defaults declared inline on UIElements are overlaid BENEATH the host store so
  // renderWhen / {{var}} interpolation see them on first render, before per-element
  // seeding effects run. Host values always win.
  const elementDefaults = useMemo(() => collectElementDefaults(elements), [elements]);
  const effectiveVariables = useMemo(
    () => mergeVariables(elementDefaults, hostVariables),
    [elementDefaults, hostVariables]
  );
  const flatVariables = useMemo(() => flattenVariables(effectiveVariables), [effectiveVariables]);

  // Live snapshot for press-time action evaluation (runActions). A ref so
  // `getVariables` keeps a stable identity — which keeps `ctx` stable across
  // variable writes — while always returning the latest map.
  const effectiveVariablesRef = useRef(effectiveVariables);
  effectiveVariablesRef.current = effectiveVariables;
  const getVariables = useCallback(() => effectiveVariablesRef.current, []);

  // `complete` comes from the host and may be a fresh closure on every host
  // render. Ref-stash it so `ctx` keeps a stable identity — a new ctx would fail
  // every ElementHost identity check and bring back the full-tree re-render.
  const completeRef = useRef(complete);
  completeRef.current = complete;
  const stableOnContinue = useCallback(() => completeRef.current(), []);

  // `renderChildren` must stay referentially stable, so it reads the current ctx
  // from a ref to break the ctx ⇄ renderChildren cycle.
  const ctxRef = useRef<RenderContext>(undefined as unknown as RenderContext);
  const renderChildren = useCallback(
    (children: UIElement[], parentType: ParentType) =>
      children.map((child) => renderElement(child, ctxRef.current, parentType)),
    []
  );

  // Stable across variable writes; changes only on a theme switch.
  const ctx: RenderContext = useMemo(
    () => ({
      theme,
      getVariables,
      setVariable,
      onContinue: stableOnContinue,
      customActions,
      renderChildren,
    }),
    [theme, getVariables, setVariable, stableOnContinue, customActions, renderChildren]
  );
  ctxRef.current = ctx;

  // The volatile slice: a write re-renders only its consumers.
  const variablesValue = useMemo(
    () => ({ variables: effectiveVariables, flatVariables }),
    [effectiveVariables, flatVariables]
  );

  // The root KeyboardAvoidingView has no background, so the padding it inserts when
  // the keyboard opens exposes whatever is behind it as a coloured band. Paint that
  // region with the screen's own root background — but only when the first element
  // is a full-bleed, unconditional root that actually covers the screen.
  const rootElement = elements[0];
  const rootIsFullBleed =
    !!rootElement &&
    !rootElement.renderWhen &&
    (rootElement.props.flex != null || rootElement.props.height === "100%");
  const rootBackgroundColor = rootIsFullBleed ? rootElement.props.backgroundColor : undefined;
  const keyboardAvoidingStyle = useMemo(
    () => (rootBackgroundColor ? [styles.flex, { backgroundColor: rootBackgroundColor }] : styles.flex),
    [rootBackgroundColor]
  );

  // Stable per-screen registry of animated variables (autoplay ProgressIndicator
  // sweeps). Its identity never changes, so this provider never re-renders consumers.
  const animatedVariables = useAnimatedVariablesRegistry();

  return (
    <KeyboardAvoidingView
      style={keyboardAvoidingStyle}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={styles.flex}>
        <AnimatedVariablesContext.Provider value={animatedVariables}>
          <VariablesContext.Provider value={variablesValue}>
            {elements.map((element) => renderElement(element, ctx))}
          </VariablesContext.Provider>
        </AnimatedVariablesContext.Provider>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
```

- [ ] **Step 3: Create the runtime module index**

Create `packages/onboarding-ui/src/UI/Runtime/index.ts`:

```ts
export { ScreenRenderer } from "./ScreenRenderer";
export type { ScreenRendererProps } from "./ScreenRenderer";
export type { ScreenHost } from "./ScreenHost";
export { noopScreenHost } from "./ScreenHost";
export { mergeVariables, flattenVariables } from "./variables";
export { renderElement } from "./elements/renderElement";
export type { RenderContext } from "./elements/shared";
export * from "./types";
```

- [ ] **Step 4: Rewrite the ComposableScreen renderer as an adapter**

Replace the whole of `packages/onboarding-ui/src/UI/Pages/ComposableScreen/Renderer.tsx` with:

```tsx
import { useCallback, useContext, useMemo } from "react";
import {
  OnboardingProgressContext as HeadlessProgressContext,
  useOnboardingHeaderHeight,
} from "@rocapine/react-native-onboarding";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema } from "./types";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext, ComposableVariableEntry } from "../../Provider/OnboardingProgressProvider";
import { useTheme } from "../../Theme/useTheme";
import { ScreenRenderer } from "../../Runtime/ScreenRenderer";
import type { ScreenHost } from "../../Runtime/ScreenHost";

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
  /** Distance between the top of the screen and this page's top (e.g. a fixed host header). */
  keyboardVerticalOffset?: number;
};

/**
 * Onboarding adapter over the generic ScreenRenderer: turns the onboarding
 * contexts into a ScreenHost and supplies the onboarding chrome. All rendering
 * lives in UI/Runtime and is shared with the paywall renderer.
 */
const ComposableScreenRendererBase = ({ step, onContinue, keyboardVerticalOffset }: ContentProps) => {
  const { theme } = useTheme();
  const { headerHeight } = useOnboardingHeaderHeight();
  const validatedData = useMemo(() => ComposableScreenStepTypeSchema.parse(step), [step]);
  const { elements } = validatedData.payload;
  const { composableVariables, setComposableVariable } = useContext(OnboardingProgressContext);
  const { setVariable: setHeadlessVariable, customActions } = useContext(HeadlessProgressContext);

  // Writes go to both stores: the UI store drives rendering, the headless store
  // drives step branching (resolveNextStepNumber).
  const setVariableAndSync = useCallback(
    (key: string, entry: ComposableVariableEntry) => {
      setComposableVariable(key, entry);
      setHeadlessVariable(key, entry.value);
    },
    [setComposableVariable, setHeadlessVariable]
  );

  const host: ScreenHost = useMemo(
    () => ({
      variables: composableVariables,
      setVariable: setVariableAndSync,
      complete: onContinue,
      customActions,
      keyboardVerticalOffset: keyboardVerticalOffset ?? headerHeight,
    }),
    [composableVariables, setVariableAndSync, onContinue, customActions, keyboardVerticalOffset, headerHeight]
  );

  return (
    <OnboardingTemplate step={validatedData} onContinue={onContinue} theme={theme} disableTopPadding>
      <ScreenRenderer elements={elements} host={host} />
    </OnboardingTemplate>
  );
};

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
```

- [ ] **Step 5: Export the runtime from the package root**

In `packages/onboarding-ui/src/index.ts`, add after the `export * from "./UI/Pages";` line:

```ts
// Screen rendering engine — shared by onboarding steps and paywalls.
// Named exports, not `export *`: the root already surfaces UIElement /
// UIElementSchema through `./UI/Pages` → ComposableScreen → types, which now
// re-exports Runtime/types. A second star export of the same module would be
// legal (both resolve to the same declaration, so it is not an ambiguous star
// export) but it makes the public surface accidental. List what is public.
export { ScreenRenderer, noopScreenHost } from "./UI/Runtime";
export type { ScreenRendererProps, ScreenHost } from "./UI/Runtime";
```

`mergeVariables` / `flattenVariables` / `renderElement` stay package-internal — the paywall renderer added in Phase 5 lives in this same package and imports them from `../Runtime` directly.

- [ ] **Step 6: Build both packages**

```bash
npm run build
```

Expected: both packages build clean. (A trailing `Missing script: build` for the `example` workspace is expected and not a failure.)

- [ ] **Step 7: Run every test**

```bash
npm test --workspace=packages/onboarding
npm test --workspace=packages/onboarding-ui
```

Expected: all pass.

- [ ] **Step 8: Verify in the example app — this is the real regression gate**

The memoization architecture cannot be verified by tsc. Run the example app and exercise a ComposableScreen step:

```bash
npm run build && cd example && npx expo start --clear
```

Check, on `example/app/example/composable-screen.tsx`:
1. The screen renders identically to before the refactor.
2. A `RadioGroup` / `Input` write updates dependent `{{var}}` text and `renderWhen` gates.
3. A `Button` with `"continue"` advances the step.
4. Keyboard avoidance still works on an `Input` (iOS).
5. An autoplay `ProgressIndicator` sweep does not visibly reset other running animations — this is the specific symptom if `ctx` stability was broken.

- [ ] **Step 9: Commit**

```bash
git add packages/onboarding-ui/src
git commit -m "♻️ refactor(ui): ScreenHost seam + generic ScreenRenderer, ComposableScreen becomes an adapter"
```

---

### Task 5: Sync the path-scoped docs to the new structure

**Files:**
- Modify: `.claude/rules/composable-screen-runtime.md`
- Modify: `.claude/rules/page-renderers.md`
- Modify: `CLAUDE.md`
- Modify: `claude-plugin/skills/compose-screen-builder/SKILL.md`
- Modify: `claude-plugin/skills/validate-step-json/SKILL.md`
- Modify: `claude-plugin/skills/customize-onboarding-components/SKILL.md`
- Modify: `claude-plugin/skills/create-step-json/references/composable-archetypes.md`
- Modify: `website/docs/page-types.mdx`

**Interfaces:**
- Consumes: the final paths established in Tasks 1–4.
- Produces: documentation that resolves. Nothing consumes this task.

These files are how future agent sessions navigate this codebase. Leaving them pointing at `Pages/ComposableScreen/elements/*` after the move sends every future session to files that do not exist — a silent, compounding cost. Spec §3.5 calls this out as part of the same change.

- [ ] **Step 1: Find every stale path reference**

```bash
grep -rn "Pages/ComposableScreen/elements\|steps/ComposableScreen/elements" \
  --include="*.md" --include="*.mdx" . | grep -v node_modules | grep -v "^./docs/superpowers/"
```

Record the list — every hit needs updating.

- [ ] **Step 2: Rewrite the path references**

Apply these mappings across the files found in Step 1:

| Old | New |
|---|---|
| `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/` | `packages/onboarding-ui/src/UI/Runtime/elements/` |
| `Pages/ComposableScreen/elements/` | `Runtime/elements/` |
| `packages/onboarding/src/steps/ComposableScreen/elements/` | `packages/onboarding/src/screens/elements/` |
| `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts` | `packages/onboarding-ui/src/UI/Runtime/types.ts` |

Do **not** rewrite references to `packages/onboarding/src/steps/ComposableScreen/types.ts` — that file still exists and is still the step schema's home.

- [ ] **Step 3: Fix the stale `ctx.flatVariables` section**

`.claude/rules/composable-screen-runtime.md` has a section titled "RenderContext variables → primitive flattening" describing `ctx.flatVariables`, which **no longer exists on main** — `RenderContext` carries `getVariables()` and the flattened map travels through `VariablesContext`. Replace that section's body with:

```markdown
`RenderContext` carries `getVariables()` — a **ref-backed, referentially stable**
live read of the merged variable map, for press-time action evaluation
(`runActions`). It is NOT reactive: reading it during render will not re-render on
a write.

Reactive reads go through `useVariables()` (`Runtime/elements/VariablesContext.tsx`),
which yields `{ variables, flatVariables }`. `flatVariables` is the entry map
flattened to primitives — that is what `evaluateCondition` / `renderWhen` want.
Skip the flatten and every `eq`/`neq` compares against the `{value,label}` entry
object and silently mis-evaluates.

The split is the whole point of the memoization architecture: `ctx` is stable so
memoized `ElementHost`s skip re-render on a write, while the volatile variable maps
re-render only their actual consumers through context. Adding a volatile field back
onto `RenderContext` reintroduces the full-tree re-render storm, and no type error
will catch it.

The merge and flatten helpers are pure and unit-tested in
`Runtime/variables.ts` (`mergeVariables`, `flattenVariables`).
```

- [ ] **Step 4: Document the ScreenHost seam**

Add a new section to `.claude/rules/composable-screen-runtime.md`:

```markdown
## ScreenHost: the onboarding ⇄ paywall seam

The rendering engine lives in `packages/onboarding-ui/src/UI/Runtime/` and knows
nothing about onboarding. `ScreenRenderer({ elements, host })` renders a UIElement
tree against an injected `ScreenHost` (`Runtime/ScreenHost.ts`): variable store,
`setVariable`, `complete`, `customActions`, `keyboardVerticalOffset`.

`Pages/ComposableScreen/Renderer.tsx` is the onboarding adapter — it builds a host
from the onboarding contexts and adds `OnboardingTemplate`. A paywall renderer is
the sibling adapter. **Put new engine behaviour in `Runtime/`, not in the adapter**,
or paywalls silently miss it.

Naming: the host exposes `complete` ("finish this screen"); `RenderContext` keeps
`onContinue` ("the continue action fired"). `ScreenRenderer` maps one to the other
in exactly one place. A paywall host interprets `complete` as dismiss.
```

- [ ] **Step 5: Update the root CLAUDE.md**

In `CLAUDE.md`, the "Updating ComposableScreen UIElement Schema" section lists mirror paths. Update the two element paths per the Step 2 table, and add this note under that heading:

```markdown
**Element schemas live in `packages/onboarding/src/screens/elements/` (headless)
and `packages/onboarding-ui/src/UI/Runtime/elements/` (UI mirror).** The
`steps/ComposableScreen/types.ts` file is now only the *step wrapper*
(`BaseStepType` + `payload.elements`); it re-exports everything screen-agnostic
from `src/screens/types.ts`, so existing import paths — and the
`dist/steps/ComposableScreen/types.js` validation recipe below — still resolve.
```

- [ ] **Step 6: Verify no stale paths remain**

```bash
grep -rn "Pages/ComposableScreen/elements\|steps/ComposableScreen/elements" \
  --include="*.md" --include="*.mdx" . | grep -v node_modules | grep -v "^./docs/superpowers/" \
  || echo "OK: no stale element paths in docs"
```

Expected: `OK: no stale element paths in docs`.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md .claude/rules claude-plugin website
git commit -m "📝 docs: point path-scoped rules at UI/Runtime and src/screens"
```

---

## Definition of done

- [ ] `npm run build` succeeds for both packages.
- [ ] `npm test` passes in both packages (headless suite plus the new UI suite).
- [ ] `node -e "require('./packages/onboarding/dist/steps/ComposableScreen/types.js').ComposableScreenStepTypeSchema"` resolves.
- [ ] `packages/onboarding-ui/src/UI/Runtime/` contains no import of `Pages/`, `Templates/`, or `Provider/OnboardingProgressProvider`.
- [ ] The example app's ComposableScreen demo renders and behaves identically, including the animation-stability check in Task 4 Step 8.
- [ ] No `.md` / `.mdx` file outside `docs/superpowers/` references the old element paths.
- [ ] No package version was bumped by these tasks.

## Follow-on

Phase 3 (`ProductProvider`, derived price fields, `purchase`/`restore`/`dismiss`/`presentPaywall` actions) builds directly on `ScreenHost` — it adds an optional `products?: ProductRuntime` field and new arms to `runActions`, both already covered by the Task 3 test harness. Phase 2 (studio edge-function helpers) is independent and needs its own plan.
