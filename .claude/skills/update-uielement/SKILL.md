---
name: update-uielement
description: Update an existing UIElement type in the Rocapine Onboarding monorepo (props, schema, or renderer changes). Use when modifying an existing ComposableScreen element, e.g. "add fontSize to TextElement", "change CarouselElement props", "update RadioGroup schema".
user-invocable: true
argument-hint: "<ElementName> <change description>"
---

Targeted edits to an existing UIElement variant. Propagates change across both SDK packages, example payloads, and emits the studio mirror prompt.

## Step 0 — Identify scope

Confirm with user:
- **Element name** (PascalCase, must match existing `type` discriminator)
- **What changes**: prop added/removed/renamed, default changed, schema validation tweak, renderer behavior fix
- **Breaking?** removed/renamed prop = breaking; new optional prop = non-breaking

If breaking, suggest bumping minor (or major) version after.

---

## Step 1 — Update headless schema

File: `packages/onboarding/src/steps/ComposableScreen/elements/{ElementName}Element.ts`

- Update `{ElementName}ElementProps` TS type
- Update `{ElementName}ElementPropsSchema` Zod (keep defaults consistent with TS optionals)
- Verify `BaseBoxPropsSchema.extend({...})` still extends — don't accidentally replace base

If new prop has runtime default, add `.optional().default(X)` in Zod AND keep it optional in TS type.

---

## Step 2 — Mirror in UI package types

File: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts`

Both `types.ts` files must stay byte-equivalent for UIElement union + schema. Apply same edits.

---

## Step 3 — Update renderer

File: `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/{ElementName}Element.tsx`

- Use new prop in JSX
- Sizing-sensitive elements (Carousel, Video, Lottie, Rive): if changing width/height behavior, prefer `onLayout` measurement over raw `props.width/height`. Don't pass `"50%"` strings to libraries expecting numbers.
- Respect `containerStyle` pattern: alignSelf, flex, flex(Shrink|Grow), width/height via `dim()`, min/max, margin*, padding*, border*, opacity, overflow, backgroundColor (only if no `backgroundGradient`).

---

## Step 4 — Update example payloads

- `packages/onboarding/src/onboarding-example.ts` — bump example to exercise new prop
- `example/app/example/composable-screen.tsx` — same

---

## Step 5 — Build & typecheck

```bash
npm run build
cd example && npm run type
```

---

## Step 6 — Notify onboarding-studio

Output diff-aware prompt:

```text
ComposableScreen "{ElementName}" UIElement schema updated in React Native SDK.

Change:
<concise summary — added X, removed Y, renamed Z>

Breaking: <yes/no>

Files changed:
- packages/onboarding/src/steps/ComposableScreen/elements/{ElementName}Element.ts
- packages/onboarding/src/steps/ComposableScreen/types.ts
- packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts
- packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/{ElementName}Element.tsx

In onboarding-studio:
- Update UIElement Zod schema for "{ElementName}"
- Update CMS editor form fields
- If breaking: write migration for stored payloads
```

---

## File map summary

| Action | File |
|--------|------|
| **MODIFY** | `packages/onboarding/src/steps/ComposableScreen/elements/{ElementName}Element.ts` |
| **MODIFY** | `packages/onboarding/src/steps/ComposableScreen/types.ts` |
| **MODIFY** | `packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts` |
| **MODIFY** | `packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/{ElementName}Element.tsx` |
| **MODIFY** | `packages/onboarding/src/onboarding-example.ts` |
| **MODIFY** | `example/app/example/composable-screen.tsx` |
