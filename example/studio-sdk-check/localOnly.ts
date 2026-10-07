// Guards that keep the studio-sdk check off every production endpoint.
//
// Parsed by hand rather than with `URL`: the check has to behave the same on
// Hermes, whose URL support depends on the polyfill an app installs, as in Node.
// No relative imports, so `node --test` can load this file as is.

/** The only hosts the check may talk to: the host machine, from a simulator or an Android emulator. */
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "10.0.2.2"] as const;

/** The port `scripts/studio-sdk-collector.mjs` listens on by default. */
export const COLLECTOR_PORT = 4319;

/** The check's own storage key: never the tracker's default, so it cannot touch a real app's run. */
export const CHECK_STORAGE_KEY = "example:studio-sdk-check:onboarding-run";

// scheme://host[:port][/path][?query][#fragment], with no userinfo at all.
const URL_SHAPE = /^(https?):\/\/([^/?#@:]+)(?::(\d{1,5}))?([/?#].*)?$/;

/** Returns `url` unchanged when it points at a local host, and throws otherwise. */
export function assertLocalUrl(url: string): string {
  const match = typeof url === "string" ? URL_SHAPE.exec(url) : null;
  const host = match?.[2];
  if (!match || !host || !(LOCAL_HOSTS as readonly string[]).includes(host)) {
    throw new Error(
      `studio-sdk check: refusing ${JSON.stringify(url)}: only ${LOCAL_HOSTS.join(", ")} over http(s), with no credentials, are allowed`,
    );
  }
  return url;
}

/** The mock collector's URL as the device sees it, or a local override; throws on anything else. */
export function collectorUrlFor(platform: string, override?: string): string {
  if (override) return assertLocalUrl(override);
  const host = platform === "android" ? "10.0.2.2" : "127.0.0.1";
  return assertLocalUrl(`http://${host}:${COLLECTOR_PORT}/v1/onboarding-runs`);
}
