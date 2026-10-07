// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The studio-sdk check (#289) bundles once with package exports off, to prove
// @rocapine/studio-sdk's stub folders (onboarding/, core/, rocalytics/) resolve
// for a resolver that ignores the exports map. Off only when asked for.
if (process.env.STUDIO_SDK_CHECK_NO_EXPORTS === "1") {
  config.resolver.unstable_enablePackageExports = false;
}

module.exports = config;