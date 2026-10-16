/**
 * This package's version, sent as `sdkVersion` on every request.
 *
 * A committed constant rather than a read of `package.json`: `rootDir` is
 * `./src`, so the build cannot import it, and reading it at runtime would ship
 * the file. `npm run check:versions` fails when this disagrees with
 * `package.json`, and the `bump-version` skill updates it.
 */
export const SDK_VERSION = "1.77.0";
