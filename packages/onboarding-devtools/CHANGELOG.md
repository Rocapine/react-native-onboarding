# Changelog
All notable changes to `@rocapine/react-native-onboarding-devtools` are documented here.

---

## [1.79.0] - 2026-11-25
### Added
- **First release.** `enablePaywallCapture({ token, delayMs?, maxWidth?, quality? })`
  registers the headless SDK's paywall dev hook (`setPaywallDevHook`, 1.79.0) and,
  in debug builds, captures each paywall once per paywall and platform per session
  (`react-native-view-shot`, JPEG, quality 0.7, 1000 ms after it is shown,
  scaled down to at most 390 px wide with its aspect ratio kept — the view is
  measured, since view-shot resizes only when given both width and height) and
  uploads it to the Studio's `upload-paywall-screenshot` endpoint. A 413 (image
  over the server's 1 MiB limit) is retried once at once at quality 0.5.
  Returns a function that unregisters the hook. Without a token it warns once and
  registers nothing. Requires `@rocapine/react-native-onboarding` >= 1.79.0.
