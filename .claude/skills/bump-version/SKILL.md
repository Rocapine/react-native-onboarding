---
name: bump-version
description: Bump version of both SDK packages (headless + UI), update both CHANGELOGs, and commit. Use when the user wants to release a new version, bump the SDK, or cut a release.
user-invocable: true
argument-hint: "[patch|minor|major]"
---

Bump both `@rocapine/react-native-onboarding` and `@rocapine/react-native-onboarding-ui` to a new version, write changelog entries for both, and create a commit.

Both packages always share the same version number.

---

## Step 1 — Analyze the diff

Run:
```bash
git diff main...HEAD -- packages/
```

Also run:
```bash
git log main...HEAD --oneline
```

Read the diff carefully. Classify each change:

| Signal | Bump |
|--------|------|
| Breaking API change, removed export, type narrowing that breaks callers | **MAJOR** |
| New feature, new UIElement, new prop, new hook, new export | **MINOR** |
| Bug fix, style tweak, internal refactor, doc update, example update only | **PATCH** |

Use the highest applicable level across all changes.

---

## Step 2 — Ask the user

Show a compact summary:

```
Changes on this branch:
• <bullet per logical change>

Recommendation: MINOR — new feature added (no breaking changes)

Bump type? [PATCH / MINOR / MAJOR]
```

If the user passed an argument (`/bump-version patch`), skip asking and use that directly.

Wait for confirmation before proceeding.

---

## Step 3 — Compute new version

Read current version from `packages/onboarding/package.json` (field `"version"`).

Apply the bump:
- PATCH: `x.y.Z+1`
- MINOR: `x.Y+1.0`
- MAJOR: `X+1.0.0`

Call this `NEW_VERSION`.

---

## Step 4 — Update package.json files

Edit **both** files — only the `"version"` field:
- `packages/onboarding/package.json`
- `packages/onboarding-ui/package.json`

Set `"version": "<NEW_VERSION>"` in each.

---

## Step 5 — Write changelog entries

Read the diff again (already done in Step 1). Write a changelog entry for **each package separately** — the headless SDK entry describes schema/type/hook changes; the UI entry describes renderer/component/theme changes. Be specific and useful; follow the existing entry style in each file.

**Format to prepend** (insert after the `---` separator line at the top, before the previous `## [x.y.z]` entry):

```markdown
## [NEW_VERSION] - YYYY-MM-DD

### Added
- **X** — description.

### Changed
- **Y** — description.

### Fixed
- **Z** — description.

---
```

Only include sections that apply. Today's date: read from the environment or use the date in the conversation context.

Files to update:
- `packages/onboarding/CHANGELOG.md`
- `packages/onboarding-ui/CHANGELOG.md`

---

## Step 6 — Commit

Stage only the four files:
```bash
git add packages/onboarding/package.json packages/onboarding-ui/package.json packages/onboarding/CHANGELOG.md packages/onboarding-ui/CHANGELOG.md
```

Commit message format (gitmoji conventional):
```
📦 chore(release): bump to <NEW_VERSION>, update changelogs and docs
```

Show the user the proposed commit message before running — confirm then commit.

Do **not** push. Do **not** run `npm publish`. The user handles publishing separately.

---

## Step 7 — Summary

Print:

```
Bumped: x.y.z → NEW_VERSION (BUMP_TYPE)
Commit: <sha or "done">
Next: npm run publish:all  (when ready to publish)
```
