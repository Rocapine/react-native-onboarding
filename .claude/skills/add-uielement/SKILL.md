---
name: add-uielement
description: Add a new UIElement type to the Rocapine Onboarding monorepo (both headless SDK and onboarding-ui). Use when the user wants to add a new element type to ComposableScreen, e.g. "add a Slider UIElement", "add a Checkbox element".
user-invocable: true
argument-hint: "<ElementName>"
---

Adds a new UIElement variant to the ComposableScreen system across both SDK packages and the example app.

## Step 0 — Confirm element name & props

Ask the user for:
- **Element name** (PascalCase, e.g. `Slider`) — becomes the `type` discriminator
- **Props** — what configurable properties does this element need?
- **Does it bind a variable?** (like Input/RadioGroup store user state via `variableName`) — yes/no
- **Does it need children?** (like YStack/XStack) — almost certainly no

If the user already provided these in their message, skip asking.

---

## Step 1 — Create the type definition (headless SDK)

**New file to create:**
```text
packages/onboarding/src/steps/ComposableScreen/elements/{ElementName}Element.ts
```

Pattern (copy from an existing element — e.g. `InputElement.ts` for stateful, `IconElement.ts` for simple):
```typescript
import { z } from "zod";
import { BaseBoxPropsSchema, type BaseBoxProps } from "./BaseBoxProps";

export type {ElementName}ElementProps = BaseBoxProps & {
  // element-specific props here
};

export const {ElementName}ElementPropsSchema = BaseBoxPropsSchema.extend({
  // zod schema for props here
});
```

**Then update `packages/onboarding/src/steps/ComposableScreen/types.ts`:**

1. Add import at top:
```typescript
import { type {ElementName}ElementProps, {ElementName}ElementPropsSchema } from "./elements/{ElementName}Element";
```

2. Add re-export below other re-exports:
```typescript
export type { {ElementName}ElementProps } from "./elements/{ElementName}Element";
```

3. Add variant to `type UIElement` union (before the closing semicolon):
```typescript
  | {
      id: string;
      name?: string;
      type: "{ElementName}";
      props: {ElementName}ElementProps;
    }
```

4. Add Zod schema variant inside `UIElementSchema` `z.union([...])` array:
```typescript
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("{ElementName}"),
      props: {ElementName}ElementPropsSchema,
    }),
```

---

## Step 2 — Create the renderer (onboarding-ui)

**New file to create:**
```text
packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/{ElementName}Element.tsx
```

Pattern (copy from a similar element; use `InputElement.tsx` if stateful, `IconElement.tsx` if simple):
```typescript
import React from "react";
import { /* RN components */ } from "react-native";
import { useTheme } from "../../../../Theme";
import type { RenderContext } from "./shared";
import type { {ElementName}ElementProps } from "@rocapine/react-native-onboarding";

interface Props {
  element: {
    id: string;
    type: "{ElementName}";
    props: {ElementName}ElementProps;
  };
  ctx: RenderContext;
}

export function {ElementName}ElementComponent({ element, ctx }: Props) {
  const { theme } = useTheme();
  const { props } = element;

  // Implement render logic here
  // Use props for styling, ctx.variables / ctx.setVariable for stateful elements

  return (/* JSX */);
}
```

**Then update `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/renderElement.tsx`:**

Add import:
```typescript
import { {ElementName}ElementComponent } from "./{ElementName}Element";
```

Add case in the switch statement:
```typescript
case "{ElementName}":
  return <{ElementName}ElementComponent element={element as any} ctx={ctx} />;
```

---

## Step 3 — Mirror types in onboarding-ui

**Update `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts`** — mirror every change from Step 1:

1. Add import of props type + schema from local `./elements/{ElementName}Element`
2. Add re-export of the props type
3. Add variant to `export type UIElement` union
4. Add Zod object to `UIElementSchema` `z.union([...])`

> Both `types.ts` files must stay in sync — same union, same schemas, same exports. The UI package version adds `export` to `UIElement` and `UIElementSchema`.

---

## Step 4 — Update example files

**`packages/onboarding/src/onboarding-example.ts`**

Add a usage of the new element inside the `ComposableScreen` step's `payload.elements` array. Include realistic values for all required props.

**`example/app/example/composable-screen.tsx`**

Add the element to the hardcoded payload in the example screen, in the same location as `onboarding-example.ts`.

---

## Step 5 — Build & verify

```bash
# From repo root
npm run build

# Then in example/
npm run type
```

Fix any TypeScript errors. The most common issues:
- Missing import in `renderElement.tsx`
- Type mismatch between headless and UI `types.ts`
- Forgetting to add the Zod schema variant (runtime parse will fail)

---

## Step 5b — Update the plugin's element docs

`tsc` cannot see the plugin's markdown, so this step is the one that keeps the AI
reference honest. Two parts:

```bash
npm run docs:element-props   # regenerate the prop inventory from the schemas
npm run check:element-docs   # then verify; CI runs this on every PR
```

The check will tell you exactly what to hand-write, which is the part it cannot do
for you:

- **The element table** in `claude-plugin/skills/compose-screen-builder/SKILL.md` —
  one row saying what the element is *for*. The check fails until it exists but it
  will not write your description.
- **Container enumerations**, if the new element has `children`. The check lists
  every file whose container list is now short. There are several, in skills and
  in agent files, and they have fallen behind twice.

Everything else in that skill — peer deps, degradation behaviour, right/wrong
props, archetypes — is prose that no generator can produce. Write it while the
element is fresh in your head.

---

## Step 6 — Notify onboarding-studio

After all changes are done, output this prompt for the `onboarding-studio` repo:

```text
The ComposableScreen UIElement schema in the React Native SDK has been updated.
Please mirror these schema changes in onboarding-studio.

Changes made:
- Added "{ElementName}" UIElement with props: <list props>

Files changed in the SDK:
- packages/onboarding/src/steps/ComposableScreen/elements/{ElementName}Element.ts  (new)
- packages/onboarding/src/steps/ComposableScreen/types.ts
- packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/{ElementName}Element.tsx  (new)
- packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/renderElement.tsx
- packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts

In onboarding-studio, update:
- The UIElement union type / discriminated union to include "{ElementName}"
- The Zod schema (or equivalent validation) for {ElementName}ElementProps
- Any CMS editor UI that lets users pick element types (add "{ElementName}" to the picker)
- Any JSON serialization/deserialization logic that handles UIElement variants
```

---

## File map summary

| Action | File |
|--------|------|
| **CREATE** | `packages/onboarding/src/steps/ComposableScreen/elements/{ElementName}Element.ts` |
| **MODIFY** | `packages/onboarding/src/steps/ComposableScreen/types.ts` |
| **CREATE** | `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/{ElementName}Element.tsx` |
| **MODIFY** | `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/renderElement.tsx` |
| **MODIFY** | `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts` |
| **MODIFY** | `packages/onboarding/src/onboarding-example.ts` |
| **MODIFY** | `example/app/example/composable-screen.tsx` |
| **REGENERATE** | `claude-plugin/skills/compose-screen-builder/references/element-props.md` — `npm run docs:element-props` |
| **MODIFY** | `claude-plugin/skills/compose-screen-builder/SKILL.md` — element table row, and the right/wrong row if the element has a tempting wrong shape |
| **MODIFY** | container enumerations, **if the element has `children`** — `npm run check:element-docs` names every file that needs it |

This map used to stop at the example app, which is why the plugin's element docs
fell behind the schemas twice: nothing in the workflow mentioned them and `tsc`
cannot check markdown. The last three rows are enforced by CI now, so the map and
the gate agree.
