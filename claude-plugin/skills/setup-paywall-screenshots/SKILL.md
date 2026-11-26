---
name: setup-paywall-screenshots
description: Wires `@rocapine/react-native-onboarding-devtools` into an Expo or React Native app so every paywall a DEBUG build shows is captured and uploaded to Onboarding Studio as that paywall's screenshot (the image on the Studio's paywall card and detail page). Use when the user says "paywall screenshots", "show my paywalls in the Studio", "the Studio has no preview of my custom paywall", "set up paywall capture", "dev token", or asks why a paywall has no thumbnail.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: [project-id?]
---

# Setup Paywall Screenshots

Most paywalls are **custom screens rendered by the host app**, so the Studio has nothing to draw for them. This devtools package closes that gap: when a paywall appears in a **debug build**, it captures the paywall view and uploads it to the Studio. Product managers then recognise paywalls by sight.

Nothing of this ships in a release build. It is a devDependency, registered behind `__DEV__`.

## Prerequisites

1. **Paywalls already work** in the app (`PaywallProvider` + `PaywallHost`, or a `Paywall` onboarding step). If not, run `setup-paywalls` first.
2. **Run `check-sdk-version`.** Capture needs `@rocapine/react-native-onboarding` (and `-ui`) **>= 1.79.0**; older versions have no paywall dev hook and silently capture nothing. Propose the upgrade and wait for the user's decision.
3. **A dev token** for the project. Only a person can mint it: Studio → project → **Settings → Dev tokens → Create token**. It is shown once and looks like `onbs_dev_…`. Tokens are personal (the Studio shows "by <creator>" under each screenshot), never expire, and are revoked from the same card. Do not try to create one yourself; ask the user.

## When invoked

1. **Inspect the target app** with the probe in `../onboarding-best-practices/references/inspect-target-app.md`: entry file (`app/_layout.tsx` for expo-router, else `App.tsx`/`index.js`), package manager, Expo or bare.
2. **Install**, both as dev dependencies:
   ```sh
   npx expo install react-native-view-shot -- --save-dev   # bare RN: npm i -D react-native-view-shot
   npm install --save-dev @rocapine/react-native-onboarding-devtools
   ```
   `react-native-view-shot` is a native module: the app needs a **new native build** (`npx expo run:ios` / `run:android`, or a new dev-client build). A JS reload is not enough.
3. **Register at module scope in the entry file**, before anything can present a paywall:
   ```ts
   if (__DEV__) {
     require("@rocapine/react-native-onboarding-devtools").enablePaywallCapture({
       token: process.env.EXPO_PUBLIC_ONBS_DEV_TOKEN,
     });
   }
   ```
   - **`require` inside `if (__DEV__)`, never a top-level `import`.** Release builds fold the branch away, so neither the package nor the token reaches the bundle. A top-level import ships both.
   - **Reference `EXPO_PUBLIC_ONBS_DEV_TOKEN` only inside that block.** Expo inlines every `process.env.EXPO_PUBLIC_*` it sees into the bundle, release included; anywhere else, the token ships.
4. **Token in a gitignored env file.** Add `EXPO_PUBLIC_ONBS_DEV_TOKEN=onbs_dev_…` to `.env.local` (or the app's equivalent) and check it is gitignored (`git check-ignore -q .env.local`). Restart Metro with `--clear` so the variable is inlined. Each developer uses their own token.
5. **Verify** (below), then tell the user where to look in the Studio.

## How it behaves (explain this to the user)

- **Trigger:** the paywall actually appearing: the Modal's `onShow` for `present()`, or mount for an inline `Paywall` step. Waits 1 s for images and animations, then captures **only the paywall view** (no status bar) as a JPEG, ≈390 px wide, quality 0.7.
- **Once per paywall and platform per app session.** Showing it again does not re-upload. Restart (or reload) the app to refresh a screenshot after changing the screen. The Studio keeps one image per paywall and platform and replaces it on each upload.
- **Retries:** a failed capture (paywall dismissed within the 1 s), a 5xx, 408 or 429 retries on the next show; a 413 retries once at lower quality. Other 4xx (bad or revoked token, paywall from another project) stop for the session.
- **Never affects the paywall.** Every failure is one `console.warn`; `present()` resolves as usual.
- **Products may be wrong in the image** (debug builds often show placeholder prices). That is expected: the screenshot is for recognising the design.
- **Variants:** each paywall id has its own screenshot. The list card shows the parent's; each variant's detail page shows its own.

## Verify

1. Present a paywall in the debug build and keep it on screen for ~2 s.
2. The Metro log shows **no** `[onboarding-devtools]` warning on success (it only logs failures). A warning names the paywall and the HTTP status: 401 = token unknown, revoked, or its creator left the team; 403 = that paywall is not in the token's project (wrong `projectId` on the client, or wrong token); 413 = image too large even at lower quality.
3. In the Studio, the paywall's card shows the thumbnail with `iOS · v<appVersion> · <age> · by <creator>`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Nothing uploads, no warning | SDK < 1.79.0; `enablePaywallCapture` not reached (not at module scope, or only registered after the first paywall); release build (`__DEV__` false) |
| `enablePaywallCapture` warns "no token" | Env var missing, or Metro not restarted with `--clear` after editing the env file |
| Metro: "Unable to resolve react-native-view-shot" | Not installed in the app itself |
| Capture fails with a native error | No native rebuild after installing `react-native-view-shot` |
| Screenshot never refreshes | Expected within a session; restart the app |
| iOS 27 SDK: app fails to launch ("UIScene life cycle is required") | Unrelated to this package: the host's AppDelegate must adopt the UIScene lifecycle to build against the iOS 27 SDK |
