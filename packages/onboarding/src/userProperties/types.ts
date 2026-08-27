/**
 * The value types a user property may hold.
 *
 * Deliberately narrower than `customAudienceParams`' `Record<string, any>`,
 * which this store supersedes as the place runtime targeting values live.
 * Everything reaches the server as a STRING (the client builds a
 * `URLSearchParams`; the edge function reads
 * `Object.fromEntries(url.searchParams.entries())`), so a value type that
 * cannot be stringified unambiguously has no meaning on the wire — see
 * `serialize.ts`.
 */
export type UserPropertyValue = string | number | boolean;

/** The resolved property map. Always fully valid — invalid input never lands here. */
export type UserProperties = Record<string, UserPropertyValue>;

/**
 * What `set` accepts. `null`/`undefined` for a key DELETES it, which is both
 * how Superwall's attribute API behaves and what a caller reaching for "unset
 * this" writes without thinking about it.
 */
export type UserPropertyPatch = Record<string, UserPropertyValue | null | undefined>;
