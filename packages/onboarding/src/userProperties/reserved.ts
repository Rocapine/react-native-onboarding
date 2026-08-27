/**
 * Property names a host may NOT use, because `OnboardingStudioClient` puts them
 * on the querystring itself.
 *
 * Two of them — `moment` and `now` — mirror the server's own
 * `RESERVED_AUDIENCE_VARS`, which strips them because they are server-owned (a
 * client supplying `now` is self-selecting into a time-gated audience).
 *
 * The other six close a collision that is live today and merely unreachable,
 * because nobody hand-writes these names into `customAudienceParams`. The
 * client appends user params FIRST, then its own:
 *
 *     Object.entries(userDefinedParams).forEach(([k, v]) => urlParams.append(k, v));
 *     urlParams.append("projectId", this.projectId);
 *
 * `URLSearchParams.append` permits duplicates, and the two server-side readers
 * disagree about which one wins: `url.searchParams.get("projectId")` returns the
 * FIRST occurrence (the user's value — so the request resolves the wrong
 * project, or 400s), while `Object.fromEntries(...)` is last-wins (so the
 * json-logic data still holds the real one). The result is a failed or
 * cross-project request with no diagnostic pointing at the property that caused
 * it.
 *
 * A store whose whole purpose is to let a host name keys freely makes that a
 * plausible accident, so this is where it gets refused. Refusing — rather than
 * prefixing or escaping — keeps the wire format unchanged and puts the warning
 * at the call site responsible.
 */
export const RESERVED_USER_PROPERTY_KEYS = [
  "projectId",
  "platform",
  "appVersion",
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
