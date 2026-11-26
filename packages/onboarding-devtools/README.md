# @rocapine/react-native-onboarding-devtools

Debug-build devtools for Rocapine Onboarding Studio. Today it does one thing:
**screen capture**. Each paywall, and each custom onboarding step, the SDK shows
on a debug build is captured (`react-native-view-shot`) and uploaded to the
Studio, where it becomes that paywall's or step's screenshot.

Requires `@rocapine/react-native-onboarding` **>= 1.79.0** (the release that
added the paywall dev hook this package registers).

## Install

```sh
npx expo install react-native-view-shot
npm install --save-dev @rocapine/react-native-onboarding-devtools
```

`react-native-view-shot` must be installed in the app itself; without it Metro
fails to resolve it in dev.

Both can be devDependencies — see [Native linking](#native-linking-react-native-view-shot)
for why that works and what it does not change.

## Register — debug builds only

```ts
// e.g. app/_layout.tsx, at module scope
if (__DEV__) {
  require("@rocapine/react-native-onboarding-devtools").enableScreenCapture({
    token: process.env.EXPO_PUBLIC_ONBS_DEV_TOKEN,
  });
}
```

Use a `require` inside `if (__DEV__)`, **never a top-level `import`**. In a
release bundle `__DEV__` is `false`, Metro folds the branch away before it
collects dependencies, and neither this package nor the token reaches the
bundle. A top-level `import` would ship both.

`EXPO_PUBLIC_ONBS_DEV_TOKEN` is the project dev token (`onbs_dev_…`) minted in
the Studio. Keep it in a local `.env`, not in source control. Without a token
`enableScreenCapture` warns once and registers nothing. `enablePaywallCapture`
is the same function under its original name: a host already calling it gets
step capture too, with no code change.

**Reference the token only inside the `if (__DEV__)` block.** Expo inlines every
`process.env.EXPO_PUBLIC_*` it finds into the JS bundle, release builds
included. Inside the folded `__DEV__` branch the reference disappears with the
branch; anywhere else (a config module, a constant, a log) the token ships in
the release bundle. A leaked token can upload screenshots to that one project
and nothing else; revoke it in Studio Settings if it leaks.

Register it at app start, before the first paywall renders. The paywall wrapper
view is collapsed away on Android when no hook is registered, so a hook added
while a paywall is already on screen cannot capture that showing (one warning;
the next show is captured).

### Options

| Option     | Default | Meaning                                              |
| ---------- | ------- | ---------------------------------------------------- |
| `token`    | —       | Project dev token. Required.                         |
| `delayMs`  | `1000`  | Wait after the paywall is shown before capturing.    |
| `maxWidth` | `390`   | Max width in px; scaled down, aspect ratio kept.     |
| `quality`  | `0.7`   | JPEG quality, 0–1.                                   |
| `steps`    | `true`  | Also capture custom onboarding steps (see Steps).    |

`enableScreenCapture` returns a function that unregisters the hooks it registered.

### Behaviour

- One upload per paywall and platform per app session.
- Dismissed before `delayMs`, or a 5xx / network error: one warning, and the
  next time that paywall is shown it is tried again.
- A 408 or 429: retried on the next show, like a 5xx.
- A 413 (image over the server's 1 MiB limit): recaptured at once at quality
  0.5 and uploaded again; if that is still refused, the rule below applies.
- The view is measured first so the capture is at most `maxWidth` px wide
  (view-shot resizes only when given both width and height). If it cannot be
  measured, it is captured at full device resolution.
- Any other 4xx (bad or revoked token, paywall from another project, image still too large after the lower-quality retry):
  one warning, not retried this session.
- Never throws into the paywall. Every failure is a `console.warn`.

Wire contract: `POST <functionsBaseUrl>/upload-paywall-screenshot` with
`Authorization: Bearer <token>` and a JSON body
`{ paywallId, platform, appVersion, sdkVersion, image }` (`image` is base64 JPEG,
no `data:` prefix).

## Steps

Custom-screen steps (`customScreenId`) are captured too, unless `steps: false`.
Same options, same retry rules and warnings as paywalls (warnings name
`step "<stepName>"`), with these differences:

- **Automatic** for steps rendered through the SDK's `useOnboardingStep`: the
  whole screen is captured (`captureScreen`, sized from the screen), once the
  step has been on screen for `delayMs`.
- **Hosts that run their own flow** call `useReportStepShown` from
  `@rocapine/react-native-onboarding` in the step component and put the ref it
  returns on the step's root view (`<View ref={ref} collapsable={false}>`).
  Only that view is captured. A ref attached to no view is not captured and
  warns once; the whole screen is never captured in its place.
- One upload per onboarding, step and platform per app session. The locale and
  draft flag are sent, but a step shown again in another locale is not
  re-captured.
- A step that loses focus before `delayMs` ends, or between the capture and the
  upload, is not uploaded, silently, and is captured the next time it is shown.
- Apps without expo-router use the SDK's fallback focus adapter, which only
  marks a step inactive when it unmounts. A stack that keeps the previous screen
  mounted can then let a late whole-screen capture store the next step under
  this one. Such apps should use `useReportStepShown` with a ref instead.
- Requires an SDK version that reports steps (`setStepDevHook`). On an older
  SDK, `enableScreenCapture` warns once and captures paywalls only.

Wire contract: `POST <functionsBaseUrl>/upload-step-screenshot` with
`Authorization: Bearer <token>` and a JSON body
`{ onboardingId, stepId, platform, customScreenId, locale, draft, appVersion, sdkVersion, image }`.

## Native linking (`react-native-view-shot`)

**Finding: a top-level devDependency of the app is autolinked.** Settled by
reading the installed autolinker, not by a native build (medium-high
confidence):

- Expo's autolinker also resolves React Native community modules (the
  `expo-modules-autolinking react-native-config` command the iOS Podfile and the
  Android settings plugin call); `@react-native-community/cli-config` is not
  installed, so it is the only resolver in play.
- `expo-modules-autolinking/build/dependencies/resolution.js:40-45` (56.0.23)
  merges `devDependencies` into the scan **at depth 0 only** — the app's own
  `package.json`.
- `expo-modules-autolinking/build/reactNativeConfig/reactNativeConfig.js:132`
  runs that recursive scan from the app root.

The devtools package declares `react-native-view-shot` as a non-optional peer,
and `resolution.js:46-56` resolves non-optional peers at depth >= 1 — so once
view-shot is installed, the scan finds it through this package too. Still
install it yourself with `npx expo install react-native-view-shot`: the peer
range is `*`, and npm's peer auto-install would pick npm `latest`, not the
version your Expo SDK expects (5.1.0 on SDK 56).

Two caveats:

1. Release builds strip this package's JS (the `if (__DEV__)` branch is folded
   away). The `react-native-view-shot` native module may still be autolinked
   into release binaries — any binary built with devDependencies installed, and
   EAS installs them. That is harmless: nothing calls it.
2. If your build installs production dependencies only, add
   `react-native-view-shot` as a regular dependency instead.

## Publishing

This package is published by the repo's `publish.yml` matrix like the other two,
after the headless package is built. **The first npm publish is manual**: npm
trusted publishing (OIDC) can only be configured on a package that already
exists, so until a maintainer has published `1.79.0` by hand and added the
trusted publisher, the workflow's publish step fails for this entry.
