---
name: bump-version
description: Bump version of both SDK packages (headless + UI), update both CHANGELOGs, and commit. Use when the user wants to release a new version, bump the SDK, or cut a release.
user-invocable: true
argument-hint: "[patch|minor|major]"
---

Bump both `@rocapine/react-native-onboarding` and `@rocapine/react-native-onboarding-ui` to a new version, write changelog entries for both, and create a commit.

Both packages always share the same version number — **and so does the Claude Code
plugin manifest.** Five files carry that number and all five move together:

```
packages/onboarding/package.json              ← the version is computed from here
packages/onboarding-ui/package.json
claude-plugin/.claude-plugin/plugin.json      ← historically the one that got left behind
packages/onboarding/CHANGELOG.md
packages/onboarding-ui/CHANGELOG.md
```

`npm run check:versions` asserts all five agree and runs in CI, so a half-done
release fails the build rather than shipping a plugin that advertises a version it
was never tested against.

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

## Step 1b — Pre-flight: did this release change how a host wires the SDK?

Look at the diff for anything that changes what an integrating app must write —
provider props, the client constructor, a new required peer dep, a renamed export,
a new hook that replaces an old one.

**If yes, both setup skills must say so before this release ships:**
`claude-plugin/skills/setup-headless-sdk/SKILL.md` and
`claude-plugin/skills/setup-ui-sdk/SKILL.md`.

This is one line in a checklist because its absence cost real correctness: the
provider surface added across 1.54–1.59 never reached either skill, so the two
skills whose entire job is wiring the SDK both wired it the old way, and kept doing
so for five minor versions. Nothing in CI can catch that — a skill can describe a
provider that no longer exists and still be valid markdown. Check it here or it does
not get checked.

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

## Step 4 — Update package.json + plugin.json files

Edit **all three** files — only the `"version"` field:
- `packages/onboarding/package.json`
- `packages/onboarding-ui/package.json`
- `claude-plugin/.claude-plugin/plugin.json`

Set `"version": "<NEW_VERSION>"` in each. The Claude Code plugin always tracks the SDK version it was tested against.

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

The plugin has no CHANGELOG. It had one; it sat fourteen minor versions behind and
was deleted, because a changelog that stops at 1.45.0 actively asserts that nothing
in the plugin changed since — while four plugin PRs landed in a single week. Plugin
changes belong in whichever package CHANGELOG the release touches, or in the PR
history. Do not recreate the file.

---

## Step 6 — Verify, then commit

Prove the five agree before committing. This is not ceremony: the previous version
of this skill edited `plugin.json` in step 4 and then staged four files that did
not include it, so the edit was made and dropped on every release, which is how the
plugin came to advertise a version it had never been tested against.

```bash
npm run check:versions
```

Stage all **five** files:
```bash
git add packages/onboarding/package.json packages/onboarding-ui/package.json \
        claude-plugin/.claude-plugin/plugin.json \
        packages/onboarding/CHANGELOG.md packages/onboarding-ui/CHANGELOG.md
```

Commit message format (gitmoji conventional):
```
📦 chore(release): bump to <NEW_VERSION>, update changelogs and docs
```

Show the user the proposed commit message before running — confirm then commit.

Do **not** push. Do **not** run `npm publish`. The user handles publishing separately.

---

## Step 7 — Hand off the marketplace mirror

The `rocapine-marketplace` entry states this version too, and it lives in another
repo, so it cannot ride along in this commit. `npm run check:versions` prints the
exact value it should carry. Offer to open that PR — one field, plus the description
if the plugin gained or lost a skill:

```
Rocapine/rocapine-marketplace → .claude-plugin/marketplace.json
  the "react-native-onboarding" entry: "version": "<NEW_VERSION>"
```

Say plainly that it is **not** a release blocker: installs resolve the plugin from
this repo's default branch by commit sha, so the field is advertising, not routing.
Publish without it if the user prefers; just don't leave it silently stale.

---

## Step 8 — Summary

Print:

```
Bumped: x.y.z → NEW_VERSION (BUMP_TYPE)
Files:  5 staged (2 packages, plugin manifest, 2 changelogs)
Checks: npm run check:versions ✓
Commit: <sha or "done">
Next:   npm run publish:all  (when ready to publish)
        marketplace PR for <NEW_VERSION>  (optional, not a blocker)
```
