/**
 * Property names a host may NOT use, because `OnboardingStudioClient` puts them
 * on the querystring itself.
 *
 * Two of them — `moment` and `now` — mirror the server's own
 * `RESERVED_AUDIENCE_VARS`, which strips them because they are server-owned (a
 * client supplying `now` is self-selecting into a time-gated audience).
 *
 * The others are the params the client writes on every request: `projectId`,
 * `platform`, the request identity (`appVersion`, `build`, `sdkVersion`,
 * `environment` — see `requestIdentity.ts`), `draft`, `locale`, `omitNulls`.
 * The client adds user params FIRST, then writes its own with
 * `URLSearchParams.set`, which replaces any same-named user param:
 *
 *     Object.entries(userDefinedParams).forEach(([k, v]) => urlParams.append(k, v));
 *     urlParams.set("projectId", this.projectId);
 *
 * It used to `append` them, and the server's two readers disagree about which
 * duplicate wins: `url.searchParams.get("projectId")` returns the FIRST
 * occurrence (the user's value — so the request resolved the wrong project, or
 * 400ed), while `Object.fromEntries(...)` is last-wins. `set` closes that on the
 * wire, but a user property that silently loses to the SDK's value is still a
 * bug in the host, so this is where it gets refused.
 *
 * A store whose whole purpose is to let a host name keys freely makes that a
 * plausible accident. Refusing — rather than prefixing or escaping — keeps the
 * wire format unchanged and puts the warning at the call site responsible.
 */
export const RESERVED_USER_PROPERTY_KEYS = [
  "projectId",
  "platform",
  "appVersion",
  "build",
  "sdkVersion",
  "environment",
  "draft",
  "locale",
  "omitNulls",
  "moment",
  "now",
] as const;

export type ReservedUserPropertyKey = (typeof RESERVED_USER_PROPERTY_KEYS)[number];

/** Exact match, never a prefix — `projectIdentifier` is a perfectly good property. */
export const isReservedUserPropertyKey = (key: string): boolean =>
  (RESERVED_USER_PROPERTY_KEYS as readonly string[]).includes(key);
