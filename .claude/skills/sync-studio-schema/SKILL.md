---
name: sync-studio-schema
description: Generate the onboarding-studio schema-mirror prompt from staged/recent changes to ComposableScreen types. Use after editing UIElement schemas, e.g. "draft studio sync prompt", "what do I tell studio".
user-invocable: true
argument-hint: ""
---

Reads recent changes to ComposableScreen `types.ts` files and emits the prompt to paste into the `onboarding-studio` repo.

## Step 1 — Detect scope of change

```bash
git diff HEAD -- \
  packages/onboarding/src/steps/ComposableScreen/types.ts \
  packages/onboarding-ui/src/UI/Pages/ComposableScreen/types.ts \
  'packages/onboarding/src/steps/ComposableScreen/elements/*.ts' \
  'packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/*.tsx'
```

If empty, also check staged + last commit:
```bash
git diff --cached -- packages/onboarding/src/steps/ComposableScreen/
git show HEAD --stat
```

## Step 2 — Classify each change

For each modified element file, determine:
- **New element** — file added (`A` in diff status)
- **Modified element** — props added/removed/renamed/retyped
- **Deleted element** — file removed (breaking)

Inspect the diff for:
- Added Zod field → new optional/required prop
- Removed Zod field → removed prop (breaking)
- `.default(X)` change → behavior change
- Renamed type literal in `z.literal("X")` → breaking rename

## Step 3 — Emit prompt

Format:

```text
ComposableScreen UIElement schema updated in @rocapine/react-native-onboarding.
Mirror these changes in onboarding-studio.

Summary:
<one line per element changed — what changed>

Breaking: <yes/no — list specific breaks>

Files changed in SDK:
<paste from git diff --name-only>

In onboarding-studio, update:
- UIElement discriminated union / Zod schema
- CMS editor forms (prop inputs, type pickers)
- Stored payload migration (if breaking)
- Preview renderer (if visual behavior changed)

Reference SDK commit / branch: <git rev-parse --short HEAD or branch>
```

## Step 4 — Offer to copy to clipboard (mac)

```bash
echo "<prompt>" | pbcopy
```

Ask user before piping — don't auto-copy.
