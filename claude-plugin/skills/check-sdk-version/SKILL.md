---
name: check-sdk-version
description: Detects version mismatch between this Rocapine plugin and the installed `@rocapine/react-native-onboarding` / `@rocapine/react-native-onboarding-ui` SDKs in the target app. Proposes upgrade if mismatched. Auto-triggers at the start of setup-headless-sdk, setup-ui-sdk, and sdk-integration-verifier flows, and whenever the user says "check sdk version", "is my onboarding sdk up to date", "do I need to upgrade", or "match plugin version".
allowed-tools: Read, Bash, Glob, Grep
---

# Check SDK Version

Plugin version mirrors the SDK version it was tested against. Mismatch with the consuming app's installed SDKs means the plugin's schema knowledge may not match runtime behavior.

## Process

### 1. Read plugin version

Read `.claude-plugin/plugin.json` from this plugin's install location. Field: `version`. Call this `PLUGIN_VERSION`.

### 2. Read installed SDK versions in target app

From the target app's working directory:

```bash
node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).dependencies['@rocapine/react-native-onboarding']" 2>/dev/null
node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).dependencies['@rocapine/react-native-onboarding-ui']" 2>/dev/null
```

Or read `package.json` directly. Normalize: strip `^` / `~` / `>=` prefixes. Call these `HEADLESS_VERSION` and `UI_VERSION`.

Also check `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` for the resolved version — the lockfile is the truth, not the manifest range.

### 3. Compare

| Case | Action |
|------|--------|
| `HEADLESS_VERSION === UI_VERSION === PLUGIN_VERSION` | ✅ Aligned. Print one-line confirmation and exit. |
| `HEADLESS_VERSION !== UI_VERSION` | ⚠ Internal SDK split — flag separately. Both packages should always share a version. |
| `HEADLESS_VERSION < PLUGIN_VERSION` (semver) | Installed SDK older than plugin. Propose upgrade. |
| `HEADLESS_VERSION > PLUGIN_VERSION` | Plugin older than installed SDK. Suggest plugin update (user runs `/plugin install` again) or accept that some plugin schemas may be stale. |
| SDK not installed | This skill is a no-op — let `setup-headless-sdk` handle the install. |

### 4. Propose upgrade (don't run it)

If installed SDK older than plugin:

```
Plugin version: 1.22.0
Installed SDK: 1.18.0 (@rocapine/react-native-onboarding + @rocapine/react-native-onboarding-ui)

The plugin assumes schema features from versions newer than what's installed. Upgrade?

  npm install @rocapine/react-native-onboarding@1.22.0 @rocapine/react-native-onboarding-ui@1.22.0

Proceed? [y/N]
```

**Always wait for explicit user consent before running the install command.** The user may refuse — that's fine, exit with a one-liner:

```
ok — skipping upgrade. Note: plugin output may use schema features unavailable at SDK 1.18.0.
```

### 5. Refusal is fine

Never auto-upgrade. Never modify package.json without consent. If the user says no, continue with whatever workflow invoked this skill — the parent skill (`setup-headless-sdk`, etc.) should proceed regardless. Note the version gap in the parent skill's output so the user can attribute later issues.

## When the target app is a monorepo

If `@rocapine/react-native-onboarding` is declared in multiple workspaces, check each. Report the lowest. Upgrade command should target the specific workspace(s) using the package.

## Lockfile drift

If `package.json` declares `^1.22.0` but lockfile resolves `1.18.0`, flag the lockfile lag as a separate finding. Suggest `npm install` (no version arg) to refresh.

## Non-blocking

This skill never blocks. It reports + proposes. Always returns control to the caller.
