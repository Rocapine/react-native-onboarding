# Changelog
All notable changes to `@rocapine/react-native-onboarding-devtools` are documented here.

---

## [1.79.0] - 2026-11-25
### Added
- **First release.** `enablePaywallCapture({ token, delayMs?, maxWidth?, quality? })`
  registers the headless SDK's paywall dev hook (`setPaywallDevHook`, 1.79.0) and,
  in debug builds, captures each paywall once per paywall and platform per session
  (`react-native-view-shot`, JPEG, quality 0.7, width 390, 1000 ms after it is
  shown) and uploads it to the Studio's `upload-paywall-screenshot` endpoint.
  Returns a function that unregisters the hook. Without a token it warns once and
  registers nothing. Requires `@rocapine/react-native-onboarding` >= 1.79.0.
