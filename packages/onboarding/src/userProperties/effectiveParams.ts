import { isReservedUserPropertyKey } from "./reserved";
import { serializeUserPropertyValue } from "./serialize";
import type { UserProperties } from "./types";

/**
 * The audience params a provider actually sends: the `customAudienceParams` prop
 * as a static baseline, with the user-property store merged OVER it.
 *
 * Precedence is the store, per key. `customAudienceParams` is where build-time
 * facts live (an `onboardingId`, a build channel) — set once at mount — and the
 * store is where anything that changes at runtime lives. A runtime value losing
 * to a mount-time prop would make the store useless for the case it exists for.
 *
 * The prop is neither deprecated nor removed: merging means every existing host
 * keeps working untouched.
 *
 * Everything is serialized to a string here, once, so the query key, the cache
 * key hash and the querystring all see the same bytes.
 *
 * The prop is typed `Record<string, any>` and predates this module, so its values
 * are treated conservatively:
 *
 * - a reserved name is DROPPED, because it would break the request outright (the
 *   client puts that name on the querystring itself — see `reserved.ts`);
 * - `null`/`undefined` is OMITTED rather than sent as the string `"null"`, which
 *   would match an audience filter testing for absence;
 * - anything else non-scalar is stringified with `String(...)` rather than
 *   dropped, so a host already passing something exotic keeps the exact wire
 *   behaviour it had before this module existed.
 */
export const resolveEffectiveParams = (
  baseline: Record<string, any>,
  properties: UserProperties,
): Record<string, string> => {
  const out: Record<string, string> = {};

  for (const key of Object.keys(baseline ?? {})) {
    if (isReservedUserPropertyKey(key)) {
      console.warn(
        `[user-properties] Ignoring customAudienceParams."${key}" — the SDK puts ` +
          "that name on the request querystring itself, and a duplicate silently " +
          "breaks the request.",
      );
      continue;
    }
    const value = baseline[key];
    if (value === null || value === undefined) continue;
    out[key] =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? serializeUserPropertyValue(value)
        : String(value);
  }

  // The store wins.
  for (const key of Object.keys(properties)) {
    out[key] = serializeUserPropertyValue(properties[key]);
  }

  return out;
};
