# @rocapine/react-native-onboarding-devtools

Debug-build devtools for Rocapine Onboarding Studio. Today it does one thing:
**paywall capture**. Each paywall the SDK shows on a debug build is captured
(`react-native-view-shot`) and uploaded to the Studio, where it becomes that
paywall's screenshot.

Requires `@rocapine/react-native-onboarding` **>= 1.79.0** (the release that
added the paywall dev hook this package registers).

## Install

```sh
npx expo install react-native-view-shot
npm install --save-dev @rocapine/react-native-onboarding-devtools
```

Both can be devDependencies — see [Native linking](#native-linking-react-native-view-shot)
for why that works and what it does not change.

## Register — debug builds only

```ts
// e.g. app/_layout.tsx, at module scope
if (__DEV__) {
  require("@rocapine/react-native-onboarding-devtools").enablePaywallCapture({
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
`enablePaywallCapture` warns once and registers nothing.

### Options

| Option     | Default | Meaning                                              |
| ---------- | ------- | ---------------------------------------------------- |
| `token`    | —       | Project dev token. Required.                         |
| `delayMs`  | `1000`  | Wait after the paywall is shown before capturing.    |
| `maxWidth` | `390`   | Width in px the capture is scaled to.                |
| `quality`  | `0.7`   | JPEG quality, 0–1.                                   |

`enablePaywallCapture` returns a function that unregisters the hook.

### Behaviour

- One upload per paywall and platform per app session.
- Dismissed before `delayMs`, or a 5xx / network error: one warning, and the
  next time that paywall is shown it is tried again.
- A 4xx (bad or revoked token, paywall from another project, image too large):
  one warning, not retried this session.
- Never throws into the paywall. Every failure is a `console.warn`.

Wire contract: `POST <functionsBaseUrl>/upload-paywall-screenshot` with
`Authorization: Bearer <token>` and a JSON body
`{ paywallId, platform, appVersion, sdkVersion, image }` (`image` is base64 JPEG,
no `data:` prefix).

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

1. The native module is linked into **every** binary built with devDependencies
   installed — release builds included (EAS installs devDependencies). Only the
   JS is stripped from release bundles; the native `RNViewShot` module is inert
   there, but present.
2. If your build installs production dependencies only, add
   `react-native-view-shot` as a regular dependency instead.

## Publishing

This package is published by the repo's `publish.yml` matrix like the other two,
after the headless package is built. **The first npm publish is manual**: npm
trusted publishing (OIDC) can only be configured on a package that already
exists, so until a maintainer has published `1.79.0` by hand and added the
trusted publisher, the workflow's publish step fails for this entry.
