import type { UserProperties, UserPropertyValue } from "./types";

/**
 * A property value as it crosses the wire.
 *
 * Note how this interacts with a studio audience filter. `json-logic-js` applies
 * the plain JS operator, and the studio authors the literal — so the normal
 * shape, `{">=": [{"var": "daysSinceInstall"}, 3]}`, coerces numerically
 * (`"3" >= 3` is `true`) and behaves as an author expects. The case to know
 * about is a filter whose literal is itself a STRING: `{">": [{"var":"day"}, "9"]}`
 * compares lexicographically, so `"10"` is NOT greater than `"9"`. That is a
 * property of the querystring wire format rather than of this function, but
 * numbers being a first-class property type makes it much easier to reach.
 */
export const serializeUserPropertyValue = (value: UserPropertyValue): string => {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
};

/** The property map as the client's `userDefinedParams`. */
export const toQueryParams = (properties: UserProperties): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of Object.keys(properties)) {
    out[key] = serializeUserPropertyValue(properties[key]);
  }
  return out;
};

/**
 * A short, stable fingerprint of the resolved params, used to SCOPE the
 * AsyncStorage cache keys (`infra/queries/cacheKey.ts`).
 *
 * Sorted by key, because the same logical params arrive in different insertion
 * orders depending on whether they came from disk or from a fresh merge — an
 * unsorted hash would make that a guaranteed spurious cache miss on every
 * launch.
 *
 * `key=value;` per pair rather than bare concatenation, so `{ab:"c"}` and
 * `{a:"bc"}` cannot collide.
 *
 * Returns `""` for an empty map. That is load-bearing: it makes the cache key of
 * a host sending no params byte-identical to the pre-scoping key, so shipping
 * this does not invalidate every existing install's cache.
 *
 * djb2 — this addresses accidental collision between one app's own param sets,
 * not an adversary, and a crypto hash would mean pulling in a dependency to name
 * a cache entry.
 */
export const paramsHash = (params: Record<string, string>): string => {
  const keys = Object.keys(params).sort();
  if (keys.length === 0) return "";
  let hash = 5381;
  for (const key of keys) {
    const pair = `${key}=${params[key]};`;
    for (let i = 0; i < pair.length; i++) {
      hash = ((hash * 33) ^ pair.charCodeAt(i)) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
};
