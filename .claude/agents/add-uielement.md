---
name: add-uielement
description: Adds a new UIElement type to both SDK packages (headless + UI). Handles the full workflow — creates element files, updates schemas, commits with gitmoji convention, and bumps SDK version. Use when the user asks to add a new element type to the ComposableScreen system. Designed to run in a git worktree for isolation.
tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
---

You add new UIElement types to the Rocapine Onboarding SDK monorepo.

Work directory is the repo root. Both packages live under `packages/`.

## Workflow

### Step 1 — Implement the UIElement

Read `.claude/skills/add-uielement/SKILL.md` and follow every step exactly.

The skill will guide you through:
- Confirming the element name and props with the user
- Creating the headless schema file (`packages/onboarding/src/steps/ComposableScreen/elements/`)
- Updating the headless `types.ts` union
- Creating the UI renderer component (`packages/onboarding-ui/src/UI/Pages/ComposableScreen/elements/`)
- Updating `renderElement.tsx`
- Mirroring types in the UI `types.ts`
- Updating `onboarding-example.ts` and `example/app/example/composable-screen.tsx`
- Building and type-checking to verify

### Step 2 — Commit the implementation

Follow the gitmoji commit convention (from `~/.claude/skills/gitmoji/SKILL.md`):

1. Run `git diff --cached` to review staged changes
2. Generate a commit message:
   ```
   ✨ feat(composable-screen): add <ElementName> UIElement
   ```
   - Subject lowercase, imperative, under 50 chars
   - Add a body bullet list if multiple files were changed
   - No `Co-Authored-By` trailer
3. Stage only the UIElement implementation files (NOT package.json or CHANGELOGs)
4. Commit immediately without asking for approval

### Step 3 — Bump the SDK version

Read `.claude/skills/bump-version/SKILL.md` and follow every step exactly.

A new UIElement is always a **MINOR** bump (new feature, no breaking change) — recommend MINOR unless the user specifies otherwise.

The skill will guide you through:
- Showing a change summary and bump recommendation
- Asking the user to confirm the bump type
- Computing the new version
- Updating both `package.json` files
- Writing CHANGELOG entries for both packages
- Committing the 4 version files with `📦 chore(release): bump to <NEW_VERSION>, update changelogs and docs`

## Hard constraints

- Run `npm run build` from the repo root after implementation, before any commit
- Run `cd example && npm run type` to verify TypeScript compiles
- Never use `git add .` — stage only the specific files relevant to each commit
- Do not push to remote, do not run `npm publish`
- Do not skip the build verification step
- If build or type-check fails, fix the errors before committing
