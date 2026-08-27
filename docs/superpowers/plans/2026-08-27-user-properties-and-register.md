# User properties + `register()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mutable, persisted user-property store that feeds the moments → audiences → paywalls resolution, and a `register(moment, feature)` API that shows the moment's paywall and runs the feature only on a purchase.

**Architecture:** A module-scope store (created by a factory, injected storage) publishes properties through `useSyncExternalStore`. Both `PaywallProvider` and `OnboardingProvider` merge it over their existing `customAudienceParams` prop, serialize the result to strings once, and gate their query on hydration. `register()` is a thin caller of the existing `present()`, with its decision extracted as a pure function.

**Tech Stack:** TypeScript, React 18 (`useSyncExternalStore`), `@tanstack/react-query`, `@react-native-async-storage/async-storage`, vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-user-properties-and-register-design.md`

## Global Constraints

- **Headless package only** (`packages/onboarding`). No change to `packages/onboarding-ui`, the studio, edge functions, or any migration.
- **No entitlement concept.** `register()` gates on the moment alone.
- **Non-breaking.** `customAudienceParams` keeps working on both providers; `present()` is unchanged; `getPaywallsCacheKey(customKey)` with no second argument must return the byte-identical legacy key.
- **Store wins per key** over `customAudienceParams`.
- Reserved property keys, exactly: `projectId`, `platform`, `appVersion`, `draft`, `locale`, `omitNulls`, `moment`, `now`.
- `registerTimeoutMs` default: **3000**.
- Tests run with `npm test --workspace=packages/onboarding` (i.e. `vitest run`). Mock AsyncStorage with the `vi.hoisted` + `vi.mock` pattern in `src/__tests__/getOnboarding.query.test.ts`; stub `react-native` as `{ Platform: { OS: "ios" } }` whenever a module under test reaches `OnboardingStudioClient`.
- Every new module gets a module-level doc comment explaining *why*, matching the density of `src/paywalls/present.ts`.
- Commit after each task, gitmoji conventional style (e.g. `✨ feat(user-properties): …`).

---

### Task 1: Pure property primitives — reserved keys, serialization, patch application, hash

The whole testable core of the store, with no storage and no React. Doing it first means the store in Task 2 is a thin shell over already-tested functions.

**Files:**
- Create: `packages/onboarding/src/userProperties/types.ts`
- Create: `packages/onboarding/src/userProperties/reserved.ts`
- Create: `packages/onboarding/src/userProperties/serialize.ts`
- Create: `packages/onboarding/src/userProperties/applyPatch.ts`
- Test: `packages/onboarding/src/userProperties/__tests__/primitives.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `UserPropertyValue = string | number | boolean`
  - `UserProperties = Record<string, UserPropertyValue>`
  - `UserPropertyPatch = Record<string, UserPropertyValue | null | undefined>`
  - `RESERVED_USER_PROPERTY_KEYS: readonly string[]`
  - `isReservedUserPropertyKey(key: string): boolean`
  - `serializeUserPropertyValue(value: UserPropertyValue): string`
  - `toQueryParams(properties: UserProperties): Record<string, string>`
  - `paramsHash(params: Record<string, string>): string` — `""` for an empty map
  - `applyUserPropertyPatch(current: UserProperties, patch: UserPropertyPatch): { next: UserProperties; warnings: string[] }`

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/userProperties/__tests__/primitives.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isReservedUserPropertyKey, RESERVED_USER_PROPERTY_KEYS } from "../reserved";
import { serializeUserPropertyValue, toQueryParams, paramsHash } from "../serialize";
import { applyUserPropertyPatch } from "../applyPatch";

describe("reserved keys", () => {
  it("names every key the client itself puts on the querystring", () => {
    expect([...RESERVED_USER_PROPERTY_KEYS].sort()).toEqual(
      ["appVersion", "draft", "locale", "moment", "now", "omitNulls", "platform", "projectId"],
    );
  });

  it("is exact, not a prefix match", () => {
    expect(isReservedUserPropertyKey("projectId")).toBe(true);
    expect(isReservedUserPropertyKey("projectIdentifier")).toBe(false);
  });
});

describe("serializeUserPropertyValue", () => {
  it("stringifies each supported value type", () => {
    expect(serializeUserPropertyValue("free")).toBe("free");
    expect(serializeUserPropertyValue(3)).toBe("3");
    expect(serializeUserPropertyValue(0)).toBe("0");
    expect(serializeUserPropertyValue(true)).toBe("true");
    expect(serializeUserPropertyValue(false)).toBe("false");
  });

  it("keeps a version-shaped string intact for the server's version conversion", () => {
    expect(serializeUserPropertyValue("1.2.3")).toBe("1.2.3");
  });
});

describe("toQueryParams", () => {
  it("serializes every value", () => {
    expect(toQueryParams({ plan: "free", days: 3, trial: false })).toEqual({
      plan: "free",
      days: "3",
      trial: "false",
    });
  });
});

describe("paramsHash", () => {
  it("is stable under key reordering", () => {
    expect(paramsHash({ a: "1", b: "2" })).toBe(paramsHash({ b: "2", a: "1" }));
  });

  it("changes when any value changes", () => {
    expect(paramsHash({ a: "1" })).not.toBe(paramsHash({ a: "2" }));
  });

  it("distinguishes a moved delimiter", () => {
    // Without a delimiter per pair, {ab:"c"} and {a:"bc"} would collide.
    expect(paramsHash({ ab: "c" })).not.toBe(paramsHash({ a: "bc" }));
  });

  it("returns an empty string for no params, so the legacy cache key is unchanged", () => {
    expect(paramsHash({})).toBe("");
  });
});

describe("applyUserPropertyPatch", () => {
  it("merges shallowly rather than replacing", () => {
    const { next } = applyUserPropertyPatch({ plan: "free", days: 3 }, { days: 4 });
    expect(next).toEqual({ plan: "free", days: 4 });
  });

  it("deletes a key set to null or undefined", () => {
    expect(applyUserPropertyPatch({ plan: "free", days: 3 }, { plan: null }).next).toEqual({ days: 3 });
    expect(applyUserPropertyPatch({ plan: "free" }, { plan: undefined }).next).toEqual({});
  });

  it("rejects a reserved key, leaving it absent, and warns naming it", () => {
    const { next, warnings } = applyUserPropertyPatch({}, { projectId: "sneaky", plan: "free" });
    expect(next).toEqual({ plan: "free" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("projectId");
  });

  it("rejects a non-finite number rather than serializing NaN", () => {
    const { next, warnings } = applyUserPropertyPatch({}, { days: NaN, ok: 1 });
    expect(next).toEqual({ ok: 1 });
    expect(warnings[0]).toContain("days");
  });

  it("rejects an unsupported value type", () => {
    const { next, warnings } = applyUserPropertyPatch({}, { nested: { a: 1 } as any });
    expect(next).toEqual({});
    expect(warnings[0]).toContain("nested");
  });

  it("returns the same object when the patch changes nothing", () => {
    const current = { plan: "free" };
    expect(applyUserPropertyPatch(current, { plan: "free" }).next).toBe(current);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=packages/onboarding -- primitives`
Expected: FAIL — `Cannot find module '../reserved'`.

- [ ] **Step 3: Write the implementation**

`packages/onboarding/src/userProperties/types.ts`:

```ts
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
```

`packages/onboarding/src/userProperties/reserved.ts`:

```ts
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
```

`packages/onboarding/src/userProperties/serialize.ts`:

```ts
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
 * Returns `""` for an empty map. That is load-bearing: it makes the cache key
 * of a host sending no params byte-identical to the pre-scoping key, so
 * shipping this does not invalidate every existing install's cache.
 *
 * djb2 — this addresses accidental collision between one app's own param sets,
 * not an adversary, and a crypto hash would mean pulling in a dependency to
 * name a cache entry.
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
```

`packages/onboarding/src/userProperties/applyPatch.ts`:

```ts
import { isReservedUserPropertyKey } from "./reserved";
import type { UserProperties, UserPropertyPatch } from "./types";

/**
 * The store's entire mutation logic, as a pure function — so merge semantics,
 * deletion, and every rejection rule are covered by an importable test rather
 * than through AsyncStorage and React.
 *
 * Warnings are RETURNED rather than logged here, so the same rules can be
 * asserted without spying on `console`. The store logs them.
 *
 * Returns the SAME `current` object when nothing changed, so a no-op `set` does
 * not notify subscribers or trigger a refetch — a host calling
 * `set({ plan })` on every render must not re-key the catalog query each time.
 */
export const applyUserPropertyPatch = (
  current: UserProperties,
  patch: UserPropertyPatch,
): { next: UserProperties; warnings: string[] } => {
  const warnings: string[] = [];
  const next: UserProperties = { ...current };
  let changed = false;

  for (const key of Object.keys(patch)) {
    if (isReservedUserPropertyKey(key)) {
      warnings.push(
        `[user-properties] Ignoring "${key}" — the SDK puts that name on the ` +
          "request querystring itself, and a duplicate silently breaks the request. " +
          "Rename the property.",
      );
      continue;
    }

    const value = patch[key];

    if (value === null || value === undefined) {
      if (key in next) {
        delete next[key];
        changed = true;
      }
      continue;
    }

    const type = typeof value;
    if (type === "number") {
      if (!Number.isFinite(value)) {
        warnings.push(
          `[user-properties] Ignoring "${key}" — ${String(value)} is not a finite ` +
            'number and would reach the server as "NaN"/"Infinity", matching nothing.',
        );
        continue;
      }
    } else if (type !== "string" && type !== "boolean") {
      warnings.push(
        `[user-properties] Ignoring "${key}" — a user property must be a string, ` +
          `number or boolean, not ${type}. Audience filters compare scalars.`,
      );
      continue;
    }

    if (next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  }

  return { next: changed ? next : current, warnings };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/onboarding -- primitives`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/onboarding/src/userProperties
git commit -m "✨ feat(user-properties): pure property primitives — reserved keys, serialization, patch, hash"
```

---

### Task 2: The store and its hook

**Files:**
- Create: `packages/onboarding/src/userProperties/store.ts`
- Create: `packages/onboarding/src/userProperties/useUserProperties.ts`
- Create: `packages/onboarding/src/userProperties/index.ts`
- Test: `packages/onboarding/src/userProperties/__tests__/store.test.ts`

**Interfaces:**
- Consumes: Task 1's `applyUserPropertyPatch`, `UserProperties`, `UserPropertyPatch`.
- Produces:
  - `UserPropertyStorage = { getItem(k): Promise<string|null>; setItem(k, v): Promise<void>; removeItem(k): Promise<void> }`
  - `USER_PROPERTIES_STORAGE_KEY = "rocapine-user-properties"`
  - `createUserPropertyStore(storage: UserPropertyStorage): UserPropertyStore`
  - `UserPropertyStore = { get(): UserProperties; set(patch: UserPropertyPatch): void; remove(key: string): void; reset(): void; getSnapshot(): UserPropertySnapshot; subscribe(l: () => void): () => void; ensureHydrated(): Promise<void> }`
  - `UserPropertySnapshot = { properties: UserProperties; status: "hydrating" | "ready" }`
  - `userProperties` — the singleton, backed by AsyncStorage
  - `useUserProperties(): UserPropertySnapshot`

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/userProperties/__tests__/store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUserPropertyStore, USER_PROPERTIES_STORAGE_KEY } from "../store";

const makeStorage = (initial: string | null = null) => {
  const store = new Map<string, string>();
  if (initial !== null) store.set(USER_PROPERTIES_STORAGE_KEY, initial);
  return {
    store,
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
  };
};

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => vi.restoreAllMocks());

describe("createUserPropertyStore", () => {
  it("starts hydrating and empty", () => {
    const s = createUserPropertyStore(makeStorage());
    expect(s.getSnapshot()).toEqual({ properties: {}, status: "hydrating" });
  });

  it("hydrates from storage and flips to ready", async () => {
    const s = createUserPropertyStore(makeStorage(JSON.stringify({ plan: "pro", days: 9 })));
    await s.ensureHydrated();
    expect(s.getSnapshot()).toEqual({ properties: { plan: "pro", days: 9 }, status: "ready" });
  });

  it("is ready even when storage holds nothing", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    expect(s.getSnapshot().status).toBe("ready");
  });

  it("is ready even when storage throws", async () => {
    const storage = makeStorage();
    storage.getItem.mockRejectedValueOnce(new Error("disk gone"));
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    expect(s.getSnapshot()).toEqual({ properties: {}, status: "ready" });
  });

  it("discards a corrupt payload rather than throwing", async () => {
    const s = createUserPropertyStore(makeStorage("not json"));
    await s.ensureHydrated();
    expect(s.getSnapshot()).toEqual({ properties: {}, status: "ready" });
  });

  it("drops invalid entries from a persisted payload", async () => {
    const s = createUserPropertyStore(
      makeStorage(JSON.stringify({ plan: "pro", projectId: "sneaky", nested: { a: 1 } })),
    );
    await s.ensureHydrated();
    expect(s.getSnapshot().properties).toEqual({ plan: "pro" });
  });

  it("hydrates UNDER values already set in memory", async () => {
    const s = createUserPropertyStore(makeStorage(JSON.stringify({ plan: "pro", days: 9 })));
    s.set({ plan: "free" }); // set before hydration resolves
    await s.ensureHydrated();
    // in-memory wins; disk fills the gap
    expect(s.getSnapshot().properties).toEqual({ plan: "free", days: 9 });
  });

  it("ensureHydrated reads storage once however many callers await it", async () => {
    const storage = makeStorage(JSON.stringify({ a: 1 }));
    const s = createUserPropertyStore(storage);
    await Promise.all([s.ensureHydrated(), s.ensureHydrated(), s.ensureHydrated()]);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on a real change and not on a no-op", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    const listener = vi.fn();
    s.subscribe(listener);

    s.set({ plan: "free" });
    expect(listener).toHaveBeenCalledTimes(1);

    s.set({ plan: "free" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns an identical snapshot object until something changes", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    const a = s.getSnapshot();
    expect(s.getSnapshot()).toBe(a);
    s.set({ plan: "free" });
    expect(s.getSnapshot()).not.toBe(a);
  });

  it("unsubscribes", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    const listener = vi.fn();
    s.subscribe(listener)();
    s.set({ plan: "free" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("coalesces a burst of mutations into one write", async () => {
    const storage = makeStorage();
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    storage.setItem.mockClear();

    s.set({ a: 1 });
    s.set({ b: 2 });
    s.set({ c: 3 });
    await flush();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("warns and ignores a reserved key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    s.set({ projectId: "sneaky" });
    expect(s.get()).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("projectId"));
  });

  it("removes a single key", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    s.set({ a: 1, b: 2 });
    s.remove("a");
    expect(s.get()).toEqual({ b: 2 });
  });

  it("reset clears memory and deletes the persisted map", async () => {
    const storage = makeStorage();
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    s.set({ a: 1 });
    await flush();
    s.reset();
    await flush();
    expect(s.get()).toEqual({});
    expect(storage.removeItem).toHaveBeenCalledWith(USER_PROPERTIES_STORAGE_KEY);
  });

  it("does not touch storage before hydration, so it cannot clobber the disk", async () => {
    const storage = makeStorage(JSON.stringify({ persisted: "yes" }));
    const s = createUserPropertyStore(storage);
    s.set({ plan: "free" });
    await flush();
    expect(storage.setItem).not.toHaveBeenCalled();
    await s.ensureHydrated();
    await flush();
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual({
      persisted: "yes",
      plan: "free",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=packages/onboarding -- store`
Expected: FAIL — `Cannot find module '../store'`.

- [ ] **Step 3: Write the implementation**

`packages/onboarding/src/userProperties/store.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyUserPropertyPatch } from "./applyPatch";
import type { UserProperties, UserPropertyPatch } from "./types";

/**
 * The slice of AsyncStorage this needs, injected so the store is testable
 * without mocking a module — the same shape `OnboardingStudioClient` uses.
 */
export type UserPropertyStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * ONE constant, deliberately not namespaced by `client.options.cacheKey` the way
 * the payload caches are. `cacheKey` exists to pin a payload VERSION; user
 * properties describe the USER, which is orthogonal. Deriving this from
 * `cacheKey` would also force the store to learn about a client before it could
 * hydrate, reintroducing the ordering problem hydration exists to remove.
 */
export const USER_PROPERTIES_STORAGE_KEY = "rocapine-user-properties";

export type UserPropertySnapshot = {
  properties: UserProperties;
  status: "hydrating" | "ready";
};

export type UserPropertyStore = {
  get: () => UserProperties;
  set: (patch: UserPropertyPatch) => void;
  remove: (key: string) => void;
  reset: () => void;
  getSnapshot: () => UserPropertySnapshot;
  subscribe: (listener: () => void) => () => void;
  ensureHydrated: () => Promise<void>;
};

/**
 * The mutable, persisted user-property map that feeds audience resolution.
 *
 * A module singleton (see `userProperties` below) rather than a provider +
 * context, which is what every other piece of state in this package uses. The
 * departure is deliberate and is the reason the feature exists: properties get
 * set from a login handler, an analytics service, a push-token callback — code
 * that is not a component and cannot call a hook. Superwall's own
 * `setUserAttributes` is a singleton for the same reason.
 *
 * It also REMOVES a source of truth rather than adding one. With
 * `customAudienceParams` passed separately to `OnboardingProvider` and
 * `PaywallProvider`, an onboarding audience and a paywall audience can disagree
 * about the same user. One store makes that impossible.
 *
 * Storage is injected so the whole thing is testable as a plain object.
 */
export const createUserPropertyStore = (storage: UserPropertyStorage): UserPropertyStore => {
  let properties: UserProperties = {};
  let status: UserPropertySnapshot["status"] = "hydrating";
  let snapshot: UserPropertySnapshot = { properties, status };
  const listeners = new Set<() => void>();
  let hydration: Promise<void> | null = null;
  let writeScheduled = false;

  const publish = () => {
    snapshot = { properties, status };
    for (const listener of listeners) listener();
  };

  // Coalesced: a burst of `set` calls in one tick costs one write. Skipped
  // entirely while hydrating — writing then would persist a map that has not
  // yet been merged with what is already on disk, i.e. silently delete
  // properties the host set on a previous launch.
  const scheduleWrite = () => {
    if (status !== "ready" || writeScheduled) return;
    writeScheduled = true;
    setTimeout(() => {
      writeScheduled = false;
      void storage.setItem(USER_PROPERTIES_STORAGE_KEY, JSON.stringify(properties)).catch((error) => {
        console.warn("[user-properties] Failed to persist:", error);
      });
    }, 0);
  };

  const commit = (next: UserProperties, warnings: string[]) => {
    for (const warning of warnings) console.warn(warning);
    if (next === properties) return;
    properties = next;
    publish();
    scheduleWrite();
  };

  return {
    get: () => properties,

    set: (patch) => {
      const { next, warnings } = applyUserPropertyPatch(properties, patch);
      commit(next, warnings);
    },

    remove: (key) => {
      const { next, warnings } = applyUserPropertyPatch(properties, { [key]: null });
      commit(next, warnings);
    },

    reset: () => {
      if (Object.keys(properties).length > 0) {
        properties = {};
        publish();
      }
      void storage.removeItem(USER_PROPERTIES_STORAGE_KEY).catch((error) => {
        console.warn("[user-properties] Failed to clear persisted properties:", error);
      });
    },

    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    // Memoized: several providers await this on mount and it must read the disk
    // once. Never rejects — a store that cannot hydrate must still let the app
    // fetch a catalog, so a failure degrades to "no persisted properties".
    ensureHydrated: () => {
      if (hydration) return hydration;
      hydration = (async () => {
        let persisted: UserProperties = {};
        try {
          const raw = await storage.getItem(USER_PROPERTIES_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              // Through the same validation as a live `set`: a payload written by
              // an older version (or hand-edited) must not smuggle a reserved key
              // or a non-scalar into the map.
              persisted = applyUserPropertyPatch({}, parsed as UserPropertyPatch).next;
            }
          }
        } catch (error) {
          console.warn("[user-properties] Failed to hydrate, continuing empty:", error);
        }
        // Disk UNDER memory: anything the host set while hydration was in flight
        // is newer than what was on disk and must win.
        properties = { ...persisted, ...properties };
        status = "ready";
        publish();
        // Persist the merged result if the host wrote during hydration, which
        // `scheduleWrite` refused to do while status was "hydrating".
        if (Object.keys(properties).length > 0) scheduleWrite();
      })();
      return hydration;
    },
  };
};

/** The store every host uses. */
export const userProperties = createUserPropertyStore(AsyncStorage);
```

`packages/onboarding/src/userProperties/useUserProperties.ts`:

```ts
import { useSyncExternalStore } from "react";
import { userProperties } from "./store";
import type { UserPropertySnapshot } from "./store";

/**
 * Subscribe to the user-property store.
 *
 * `useSyncExternalStore` rather than a context: the store is a singleton so
 * non-React code can write to it, and this is the supported way to read an
 * external mutable source without tearing.
 *
 * Hydration is kicked off here rather than by the host, so a provider that
 * calls this is automatically gated correctly — see `getSnapshot().status`.
 */
export const useUserProperties = (): UserPropertySnapshot => {
  const snapshot = useSyncExternalStore(userProperties.subscribe, userProperties.getSnapshot);
  if (snapshot.status === "hydrating") void userProperties.ensureHydrated();
  return snapshot;
};
```

`packages/onboarding/src/userProperties/index.ts`:

```ts
export type { UserProperties, UserPropertyPatch, UserPropertyValue } from "./types";
export { RESERVED_USER_PROPERTY_KEYS, isReservedUserPropertyKey } from "./reserved";
export type { ReservedUserPropertyKey } from "./reserved";
export { serializeUserPropertyValue, toQueryParams, paramsHash } from "./serialize";
export { applyUserPropertyPatch } from "./applyPatch";
export {
  createUserPropertyStore,
  userProperties,
  USER_PROPERTIES_STORAGE_KEY,
} from "./store";
export type { UserPropertySnapshot, UserPropertyStorage, UserPropertyStore } from "./store";
export { useUserProperties } from "./useUserProperties";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/onboarding -- store`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run type:check --workspace=packages/onboarding`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/onboarding/src/userProperties
git commit -m "✨ feat(user-properties): persisted store with a useSyncExternalStore hook"
```

---

### Task 3: Scope the AsyncStorage cache keys by params

The spec's §6. Not optional: mutable properties turn the existing wrong-params-serve bug from a rare edge case into the normal path.

**Files:**
- Modify: `packages/onboarding/src/infra/queries/cacheKey.ts`
- Modify: `packages/onboarding/src/infra/queries/getOnboarding.query.ts`
- Modify: `packages/onboarding/src/paywalls/getPaywalls.query.ts`
- Modify: `packages/onboarding/src/OnboardingStudioClient.ts` (`clearCache`)
- Modify: `packages/onboarding/src/__tests__/getOnboarding.query.test.ts` (its AsyncStorage mock and its existing `clearCache` assertion)
- Test: `packages/onboarding/src/__tests__/cacheKey.test.ts`

**Interfaces:**
- Consumes: Task 1's `paramsHash`.
- Produces:
  - `getOnboardingCacheKey(customKey?: string, paramsHash?: string): string`
  - `getPaywallsCacheKey(customKey?: string, paramsHash?: string): string`
  - `ONBOARDING_CACHE_KEY_PREFIX = "rocapine-onboarding"`, `PAYWALLS_CACHE_KEY_PREFIX = "rocapine-paywalls"`

> `cacheKey.ts` currently has **no imports**, on purpose (its doc says so — it breaks a circular import between the query modules and `OnboardingStudioClient`). `paramsHash` lives in `userProperties/serialize.ts`, which imports only `./types`, so importing it here introduces no cycle. Keep `cacheKey.ts` free of any import that reaches `OnboardingStudioClient`.

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/__tests__/cacheKey.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  getOnboardingCacheKey,
  getPaywallsCacheKey,
  DEFAULT_ONBOARDING_CACHE_KEY,
  DEFAULT_PAYWALLS_CACHE_KEY,
  ONBOARDING_CACHE_KEY_PREFIX,
  PAYWALLS_CACHE_KEY_PREFIX,
} from "../infra/queries/cacheKey";
import { paramsHash } from "../userProperties/serialize";

describe("cache keys", () => {
  it("is byte-identical to the legacy key when there are no params", () => {
    expect(getOnboardingCacheKey()).toBe(DEFAULT_ONBOARDING_CACHE_KEY);
    expect(getOnboardingCacheKey(undefined, "")).toBe(DEFAULT_ONBOARDING_CACHE_KEY);
    expect(getPaywallsCacheKey()).toBe(DEFAULT_PAYWALLS_CACHE_KEY);
    expect(getPaywallsCacheKey(undefined, "")).toBe(DEFAULT_PAYWALLS_CACHE_KEY);
    expect(getPaywallsCacheKey("v2")).toBe("rocapine-paywalls-sdk-v2");
  });

  it("appends the hash when params are present", () => {
    const hash = paramsHash({ plan: "free" });
    expect(getPaywallsCacheKey(undefined, hash)).toBe(`${DEFAULT_PAYWALLS_CACHE_KEY}-${hash}`);
    expect(getPaywallsCacheKey("v2", hash)).toBe(`rocapine-paywalls-sdk-v2-${hash}`);
  });

  it("gives different params different keys", () => {
    const a = getPaywallsCacheKey(undefined, paramsHash({ plan: "free" }));
    const b = getPaywallsCacheKey(undefined, paramsHash({ plan: "pro" }));
    expect(a).not.toBe(b);
  });

  it("keeps the two domains on separate prefixes", () => {
    const hash = paramsHash({ plan: "free" });
    expect(getOnboardingCacheKey(undefined, hash)).toMatch(
      new RegExp(`^${ONBOARDING_CACHE_KEY_PREFIX}`),
    );
    expect(getPaywallsCacheKey(undefined, hash)).toMatch(
      new RegExp(`^${PAYWALLS_CACHE_KEY_PREFIX}`),
    );
  });

  it("every key a helper can produce starts with its prefix, so clearCache finds it", () => {
    const hash = paramsHash({ plan: "free" });
    for (const key of [
      getPaywallsCacheKey(),
      getPaywallsCacheKey("v2"),
      getPaywallsCacheKey(undefined, hash),
      getPaywallsCacheKey("v2", hash),
    ]) {
      expect(key.startsWith(PAYWALLS_CACHE_KEY_PREFIX)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace=packages/onboarding -- cacheKey`
Expected: FAIL — `ONBOARDING_CACHE_KEY_PREFIX` is not exported.

- [ ] **Step 3: Implement the key helpers**

In `packages/onboarding/src/infra/queries/cacheKey.ts` — add the prefixes, add the second parameter to both helpers, and extend the module doc:

```ts
/**
 * … existing doc …
 *
 * ## Why the key is scoped by params
 *
 * The react-query key has always been scoped by `customAudienceParams`; this
 * disk key was a bare constant. So a cache-first read could serve a payload
 * resolved under DIFFERENT params — non-null, and therefore indistinguishable
 * from a correct one — with a fresh fetch in flight behind it.
 *
 * Observed in production: an audience gated on `hoursSinceOnboardingPaywall >= 44`
 * was served the pre-threshold catalog on the launch where the user first became
 * eligible, so the arm under test lost exactly the launch that mattered.
 *
 * That needed volatile params to trigger, which was rare while params were a
 * static prop. The user-property store makes volatile params normal, so the key
 * carries a hash of the resolved params. An EMPTY hash yields the legacy key
 * byte-for-byte, so shipping this does not invalidate existing installs.
 */

/** Every onboarding cache key starts with this — `clearCache` scans on it. */
export const ONBOARDING_CACHE_KEY_PREFIX = "rocapine-onboarding";
/** Every paywall cache key starts with this — `clearCache` scans on it. */
export const PAYWALLS_CACHE_KEY_PREFIX = "rocapine-paywalls";

const withHash = (base: string, hash?: string): string =>
  hash ? `${base}-${hash}` : base;

export const getOnboardingCacheKey = (customKey?: string, paramsHash?: string): string =>
  withHash(
    customKey ? `rocapine-onboarding-sdk-${customKey}` : DEFAULT_ONBOARDING_CACHE_KEY,
    paramsHash,
  );

export const getPaywallsCacheKey = (customKey?: string, paramsHash?: string): string =>
  withHash(
    customKey ? `rocapine-paywalls-sdk-${customKey}` : DEFAULT_PAYWALLS_CACHE_KEY,
    paramsHash,
  );
```

Verify `DEFAULT_ONBOARDING_CACHE_KEY` (`"rocapine-onboarding-studio"`) and `DEFAULT_PAYWALLS_CACHE_KEY` (`"rocapine-paywalls-studio"`) both start with their prefix — they do, which is what makes the prefix scan total.

- [ ] **Step 4: Pass the hash from both query factories**

In `packages/onboarding/src/paywalls/getPaywalls.query.ts`, import `paramsHash` from `../userProperties/serialize` and change the one `getPaywallsCacheKey` call:

```ts
const cacheKey = getPaywallsCacheKey(
  client.options.cacheKey,
  // Scoped by params — see cacheKey.ts. `customAudienceParams` arrives already
  // serialized to strings from the provider (`resolveEffectiveParams`).
  paramsHash(customAudienceParams as Record<string, string>),
);
```

Make the identical change in `packages/onboarding/src/infra/queries/getOnboarding.query.ts` for `getOnboardingCacheKey`.

- [ ] **Step 5: Rewrite `clearCache` to scan by prefix**

In `packages/onboarding/src/OnboardingStudioClient.ts`:

```ts
  /**
   * Removes EVERY cached onboarding payload and paywall catalog this SDK wrote,
   * across all param variants.
   *
   * Scans `getAllKeys()` by prefix rather than naming two keys, because the keys
   * are now scoped by a hash of the resolved audience params (see
   * `infra/queries/cacheKey.ts`) — so there is no longer one key to name. This
   * also picks up entries written before that scoping existed, which are
   * otherwise orphaned forever.
   *
   * To force an in-session refetch as well, also invalidate the React Query keys
   * `["onboardingQuestions", ...]` and `["paywallCatalog", ...]`.
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter(
        (key) =>
          key.startsWith(ONBOARDING_CACHE_KEY_PREFIX) ||
          key.startsWith(PAYWALLS_CACHE_KEY_PREFIX),
      );
      if (ours.length > 0) await AsyncStorage.multiRemove(ours);
    } catch (error) {
      console.warn("Failed to clear SDK caches:", error);
    }
  }
```

Update its import to pull `ONBOARDING_CACHE_KEY_PREFIX` / `PAYWALLS_CACHE_KEY_PREFIX` (the two `get*CacheKey` imports may now be unused there — remove them if so, or `tsc` will not complain but lint noise will).

Note `USER_PROPERTIES_STORAGE_KEY` starts with `rocapine-user-properties`, which matches **neither** prefix — `clearCache()` must not wipe who the user is. That is why the prefixes are `rocapine-onboarding` / `rocapine-paywalls` and not a bare `rocapine-`.

- [ ] **Step 6: Update the existing test's mock and its `clearCache` expectation**

`packages/onboarding/src/__tests__/getOnboarding.query.test.ts` mocks AsyncStorage with only `getItem`/`setItem`/`removeItem`. Add the two new methods to the hoisted mock:

```ts
const { getItem, setItem, removeItem, getAllKeys, multiRemove } = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
  getAllKeys: vi.fn<() => Promise<string[]>>(),
  multiRemove: vi.fn<(keys: string[]) => Promise<void>>(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem, removeItem, getAllKeys, multiRemove },
}));
```

Then find the existing `clearCache` test — it asserts `removeItem` was called with the two named keys — and replace that expectation with the prefix-scan behaviour, including the two cases that matter:

```ts
it("clears every param variant and any legacy unscoped key", async () => {
  getAllKeys.mockResolvedValue([
    "rocapine-onboarding-studio",
    "rocapine-onboarding-studio-7f3a1c92",
    "rocapine-paywalls-studio",
    "rocapine-paywalls-sdk-v2-deadbeef",
    "rocapine-user-properties",
    "unrelated-app-key",
  ]);
  const client = new OnboardingStudioClient("p1", {});
  await client.clearCache();
  expect(multiRemove).toHaveBeenCalledWith([
    "rocapine-onboarding-studio",
    "rocapine-onboarding-studio-7f3a1c92",
    "rocapine-paywalls-studio",
    "rocapine-paywalls-sdk-v2-deadbeef",
  ]);
});

it("leaves user properties alone — clearing a cache must not forget who the user is", async () => {
  getAllKeys.mockResolvedValue(["rocapine-user-properties"]);
  const client = new OnboardingStudioClient("p1", {});
  await client.clearCache();
  expect(multiRemove).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Run the full suite**

Run: `npm test --workspace=packages/onboarding`
Expected: PASS, including the pre-existing query tests. If a query test now fails on a changed cache key, that means params reached `paramsHash` where the test expected none — check the test passes `{}` for `customAudienceParams`.

- [ ] **Step 8: Commit**

```bash
git add packages/onboarding/src
git commit -m "🐛 fix(cache): scope the AsyncStorage payload keys by audience params"
```

---

### Task 4: Wire the store into both providers

**Files:**
- Create: `packages/onboarding/src/userProperties/effectiveParams.ts`
- Modify: `packages/onboarding/src/paywalls/PaywallProvider.tsx`
- Modify: `packages/onboarding/src/infra/provider/OnboardingProvider.tsx`
- Test: `packages/onboarding/src/userProperties/__tests__/effectiveParams.test.ts`

**Interfaces:**
- Consumes: Task 1's `serializeUserPropertyValue`; Task 2's `useUserProperties`.
- Produces: `resolveEffectiveParams(baseline: Record<string, any>, properties: UserProperties): Record<string, string>`

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/userProperties/__tests__/effectiveParams.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveEffectiveParams } from "../effectiveParams";

describe("resolveEffectiveParams", () => {
  it("merges the store over the prop", () => {
    expect(resolveEffectiveParams({ onboardingId: "abc", plan: "stale" }, { plan: "free" })).toEqual({
      onboardingId: "abc",
      plan: "free",
    });
  });

  it("serializes both sides to strings", () => {
    expect(resolveEffectiveParams({ build: 42 }, { days: 3, trial: true })).toEqual({
      build: "42",
      days: "3",
      trial: "true",
    });
  });

  it("drops a null or undefined baseline value rather than sending \"null\"", () => {
    expect(resolveEffectiveParams({ a: null, b: undefined, c: "keep" }, {})).toEqual({ c: "keep" });
  });

  it("drops a reserved key present in the baseline prop, warning once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveEffectiveParams({ projectId: "sneaky", plan: "free" }, {})).toEqual({
      plan: "free",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("projectId"));
    warn.mockRestore();
  });

  it("returns an empty map for empty inputs", () => {
    expect(resolveEffectiveParams({}, {})).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace=packages/onboarding -- effectiveParams`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/onboarding/src/userProperties/effectiveParams.ts`:

```ts
import { isReservedUserPropertyKey } from "./reserved";
import { serializeUserPropertyValue } from "./serialize";
import type { UserProperties } from "./types";

/**
 * The audience params a provider actually sends: the `customAudienceParams`
 * prop as a static baseline, with the user-property store merged OVER it.
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
 * key hash and the querystring all see the same bytes. The prop is typed
 * `Record<string, any>`, so its values get the same treatment the store's
 * validation would have given them — a reserved name is dropped (it would break
 * the request; see `reserved.ts`) and a null/undefined value is omitted rather
 * than sent as the string `"null"`, which would match an audience filter
 * comparing against absence.
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=packages/onboarding -- effectiveParams`
Expected: PASS.

- [ ] **Step 5: Wire `PaywallProvider`**

In `PaywallProviderInner`, above the `useQuery` call:

```ts
  // The user-property store is the runtime half of audience targeting; the
  // `customAudienceParams` prop is the static half. Merged here, store-wins,
  // and serialized once so the query key, the disk cache key and the
  // querystring all agree — see `resolveEffectiveParams`.
  const { properties, status: propertiesStatus } = useUserProperties();
  const params = useMemo(
    () => resolveEffectiveParams(customAudienceParams, properties),
    [customAudienceParams, properties],
  );
```

Then gate the query. `getPaywallsQuery` returns an options object, so spread it:

```ts
  const { data, error, isFetching } = useQuery<PaywallCatalog>({
    ...getPaywallsQuery(client, locale, params, paywallQueryClient),
    // Held until the store has hydrated. Without this the first fetch of a cold
    // launch carries an EMPTY property map, matches the catch-all audience, and
    // — because the catalog is cached with staleTime: Infinity — that wrong
    // answer is what the whole session uses.
    enabled: propertiesStatus === "ready",
  });
```

`computeCatalogStatus(catalog, error, isFetching)` needs no change: a disabled query reports `data: undefined`, `error: null`, `isFetching: false`, which is exactly `"loading"` — the honest answer while the store hydrates.

- [ ] **Step 6: Wire `OnboardingProvider` the same way**

`OnboardingDataGate` takes `customAudienceParams` as a prop and passes it to `getOnboardingQuery`. Do the merge inside the gate (not in the outer provider) so the subscription lives next to the query that consumes it:

```ts
  const { properties, status: propertiesStatus } = useUserProperties();
  const params = useMemo(
    () => resolveEffectiveParams(customAudienceParams, properties),
    [customAudienceParams, properties],
  );

  const { data, error } = useQuery<Onboarding<OnboardingStepType>>({
    ...getOnboardingQuery<OnboardingStepType>(client, locale, params, setOnboarding),
    enabled: propertiesStatus === "ready",
  });
```

`OnboardingDataGate` already renders `fontsFallback` while `!data`, so hydration shows the state it already shows while loading — nothing new appears on screen.

Leave the rest of `OnboardingProvider` alone: it still publishes the raw `customAudienceParams` on its context (read by `useOnboardingStart` / `useOnboardingStep`). Changing that is out of scope and would alter what those hooks send on their own calls.

- [ ] **Step 7: Type-check and run the suite**

Run: `npm run type:check --workspace=packages/onboarding && npm test --workspace=packages/onboarding`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add packages/onboarding/src
git commit -m "✨ feat(user-properties): both providers merge the store over customAudienceParams"
```

---

### Task 5: `register`'s decision, as pure functions

**Files:**
- Create: `packages/onboarding/src/paywalls/register.ts`
- Test: `packages/onboarding/src/paywalls/__tests__/register.test.ts`

**Interfaces:**
- Consumes: `Paywall`, `PaywallCatalog`, `PresentResult` from `./types`; `CatalogStatus` from `./present`.
- Produces:
  - `RegisterDecision = { type: "run"; reason: "no-paywall" | "catalog-unavailable" } | { type: "present"; paywall: Paywall } | { type: "wait" }`
  - `resolveRegisterDecision(catalog, catalogStatus, moment): RegisterDecision`
  - `shouldRunFeature(outcome: PresentResult): boolean`
  - `RegisterResult` (the union in spec §7.5)
  - `RegisterFeature = () => void | Promise<void>`
  - `RegisterDeps` and `runRegister(deps, moment, feature?): Promise<RegisterResult>` — the whole orchestration, with its four environment reads injected

> **Why `runRegister` is injectable rather than living inside the provider.** This repo has **no vitest config**, so tests run in vitest's default `node` environment — there is no DOM, and a `@testing-library/react` `render()` test would require adding jsdom plus a config file just to assert control flow. Injecting the four things `register` reads from its environment (current catalog, current status, the settle-waiter, `present`) keeps every branch — including the fail-open paths and the Stripe warning — testable as a plain async function, and leaves Task 6 as pure wiring that `tsc` can verify.

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/paywalls/__tests__/register.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveRegisterDecision, shouldRunFeature } from "../register";
import type { PaywallCatalog } from "../types";

const paywall = { id: "pw1", name: "Main", moment: "unlock_stats", products: [] } as any;
const catalog = { paywalls: { unlock_stats: paywall } } as unknown as PaywallCatalog;

describe("resolveRegisterDecision", () => {
  it("presents when the catalog holds the moment", () => {
    expect(resolveRegisterDecision(catalog, "ready", "unlock_stats")).toEqual({
      type: "present",
      paywall,
    });
  });

  it("runs the feature when a resolved catalog has no such moment", () => {
    expect(resolveRegisterDecision(catalog, "ready", "not_authored")).toEqual({
      type: "run",
      reason: "no-paywall",
    });
  });

  it("waits while the catalog is still loading", () => {
    expect(resolveRegisterDecision(null, "loading", "unlock_stats")).toEqual({ type: "wait" });
  });

  it("fails open when the catalog failed to load", () => {
    expect(resolveRegisterDecision(null, "error", "unlock_stats")).toEqual({
      type: "run",
      reason: "catalog-unavailable",
    });
  });

  it("treats a revalidating catalog as usable", () => {
    // Safe only because the disk cache key is now params-scoped: a served
    // catalog always matches the current params.
    expect(resolveRegisterDecision(catalog, "revalidating", "unlock_stats")).toEqual({
      type: "present",
      paywall,
    });
    expect(resolveRegisterDecision(catalog, "revalidating", "not_authored")).toEqual({
      type: "run",
      reason: "no-paywall",
    });
  });

  it("never returns wait once a catalog exists", () => {
    for (const status of ["loading", "ready", "revalidating", "error"] as const) {
      expect(resolveRegisterDecision(catalog, status, "unlock_stats").type).not.toBe("wait");
    }
  });
});

describe("shouldRunFeature", () => {
  it("runs only on a purchase", () => {
    expect(shouldRunFeature({ status: "purchased" })).toBe(true);
  });

  it("does not run on anything else", () => {
    expect(shouldRunFeature({ status: "dismissed" })).toBe(false);
    expect(shouldRunFeature({ status: "cancelled" })).toBe(false);
    // Stripe: the entitlement arrives out-of-band, so pending never unlocks.
    expect(shouldRunFeature({ status: "pending" } as any)).toBe(false);
    expect(shouldRunFeature({ status: "error", reason: "unknown-moment" })).toBe(false);
    expect(shouldRunFeature({ status: "error", reason: "already-presenting", activeMoment: "x" })).toBe(
      false,
    );
  });
});
```

Append the orchestration tests to the same file:

```ts
import { runRegister } from "../register";
import type { RegisterDeps } from "../register";

const deps = (over: Partial<RegisterDeps> = {}): RegisterDeps => ({
  getCatalog: () => catalog,
  getCatalogStatus: () => "ready",
  waitForCatalogSettled: async () => {},
  present: async () => ({ status: "dismissed" }),
  timeoutMs: 3000,
  ...over,
});

describe("runRegister", () => {
  it("runs the feature and never presents when the moment has no paywall", async () => {
    const present = vi.fn();
    const feature = vi.fn();
    const result = await runRegister(deps({ present }), "not_authored", feature);
    expect(present).not.toHaveBeenCalled();
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, presented: false, reason: "no-paywall" });
  });

  it("fails open when there is no catalog and it is not loading", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const feature = vi.fn();
    const result = await runRegister(
      deps({ getCatalog: () => null, getCatalogStatus: () => "error" }),
      "unlock_stats",
      feature,
    );
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, presented: false, reason: "catalog-unavailable" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unlock_stats"));
    warn.mockRestore();
  });

  it("waits once, then decides against the settled catalog", async () => {
    let status: "loading" | "ready" = "loading";
    const waitForCatalogSettled = vi.fn(async () => {
      status = "ready";
    });
    let cat: typeof catalog | null = null;
    const present = vi.fn(async () => ({ status: "purchased" }) as const);
    const feature = vi.fn();

    const result = await runRegister(
      deps({
        getCatalog: () => cat,
        getCatalogStatus: () => status,
        waitForCatalogSettled: async (ms) => {
          await waitForCatalogSettled();
          cat = catalog;
          return undefined as unknown as void;
        },
        present,
      }),
      "unlock_stats",
      feature,
    );

    expect(waitForCatalogSettled).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledWith("unlock_stats");
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ran: true,
      presented: true,
      reason: "purchased",
      outcome: { status: "purchased" },
    });
  });

  it("fails open — and does not wait twice — when the wait times out still loading", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const waitForCatalogSettled = vi.fn(async () => {});
    const feature = vi.fn();
    const result = await runRegister(
      deps({ getCatalog: () => null, getCatalogStatus: () => "loading", waitForCatalogSettled }),
      "unlock_stats",
      feature,
    );
    expect(waitForCatalogSettled).toHaveBeenCalledTimes(1);
    expect(feature).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, presented: false, reason: "catalog-unavailable" });
    warn.mockRestore();
  });

  it("presents and withholds the feature when the user does not buy", async () => {
    const feature = vi.fn();
    const result = await runRegister(
      deps({ present: async () => ({ status: "dismissed" }) }),
      "unlock_stats",
      feature,
    );
    expect(feature).not.toHaveBeenCalled();
    expect(result).toEqual({
      ran: false,
      presented: true,
      reason: "not-purchased",
      outcome: { status: "dismissed" },
    });
  });

  it("withholds the feature when another paywall is already presenting", async () => {
    const feature = vi.fn();
    const result = await runRegister(
      deps({
        present: async () => ({ status: "error", reason: "already-presenting", activeMoment: "other" }),
      }),
      "unlock_stats",
      feature,
    );
    expect(feature).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
  });

  it("warns before presenting a Stripe paywall, whose purchase never unlocks", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stripeCatalog = {
      paywalls: { unlock_stats: { ...paywall, billing: "stripe" } },
    } as unknown as PaywallCatalog;
    const feature = vi.fn();
    const result = await runRegister(
      deps({ getCatalog: () => stripeCatalog, present: async () => ({ status: "pending" } as any) }),
      "unlock_stats",
      feature,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Stripe"));
    expect(feature).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
    warn.mockRestore();
  });

  it("awaits an async feature before resolving", async () => {
    const order: string[] = [];
    const result = await runRegister(deps({ present: async () => ({ status: "purchased" }) }), "unlock_stats", async () => {
      await new Promise((r) => setTimeout(r, 0));
      order.push("feature");
    });
    order.push("resolved");
    expect(order).toEqual(["feature", "resolved"]);
    expect(result.ran).toBe(true);
  });

  it("works with no feature at all — register is also a plain gate check", async () => {
    const result = await runRegister(deps({ present: async () => ({ status: "purchased" }) }), "unlock_stats");
    expect(result).toEqual({
      ran: true,
      presented: true,
      reason: "purchased",
      outcome: { status: "purchased" },
    });
  });
});
```

Add `vi` to the file's vitest import (`import { describe, it, expect, vi } from "vitest";`).

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace=packages/onboarding -- register`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/onboarding/src/paywalls/register.ts`:

```ts
import type { Paywall, PaywallCatalog, PresentResult } from "./types";
import type { CatalogStatus } from "./present";

/** The feature `register` gates. May be async; `register` awaits it. */
export type RegisterFeature = () => void | Promise<void>;

/**
 * What `register(moment, feature)` should do, as a pure function of current
 * state — extracted for the same reason `resolvePresentDecision` and
 * `shouldAdvanceOnComplete` are: every branch on a monetisation path gets an
 * importable test rather than inspection.
 */
export type RegisterDecision =
  | { type: "run"; reason: "no-paywall" | "catalog-unavailable" }
  | { type: "present"; paywall: Paywall }
  | { type: "wait" };

/**
 * `wait` is a DECISION rather than something the caller infers from
 * `catalogStatus` itself, so "when may register block?" has exactly one answer
 * in one tested place. The caller awaits the catalog settling and calls this
 * again; the second call cannot return `wait`, because the wait resolves only on
 * `"ready"`/`"error"` and a timeout is treated as `catalog-unavailable` without
 * asking again.
 *
 * `"revalidating"` counts as usable. That is safe only because the AsyncStorage
 * cache key is scoped by audience params: before that, a revalidating catalog
 * might have been resolved under DIFFERENT params, so a missing moment could
 * mean "not yet" rather than "absent". Now a served catalog always matches the
 * current params.
 */
export const resolveRegisterDecision = (
  catalog: PaywallCatalog | null,
  catalogStatus: CatalogStatus,
  moment: string,
): RegisterDecision => {
  if (!catalog) {
    // Nothing to decide against yet. "loading" is worth waiting for; an error
    // (or any other terminal state with no catalog) is not.
    return catalogStatus === "loading" ? { type: "wait" } : { type: "run", reason: "catalog-unavailable" };
  }
  const paywall = catalog.paywalls[moment];
  // A moment absent from a RESOLVED catalog is not a failure: it means the
  // moment is not monetised, or is not authored yet. The feature is free.
  if (!paywall) return { type: "run", reason: "no-paywall" };
  return { type: "present", paywall };
};

/**
 * Whether a completed presentation unlocks the feature. Only a purchase does.
 *
 * This one-liner is correct only because `resolvePresentedOutcome` already
 * upgraded the generic `{status:"dismissed"}` that the canonical authoring shape
 * — `{type:"purchase", onSuccess:[{type:"dismiss"}]}` — produces into
 * `"purchased"` when the store actually charged. Without that upgrade this would
 * refuse the feature to every user who bought.
 *
 * A `"pending"` outcome does NOT unlock: a Stripe paywall resolves `pending` and
 * never `purchased`, because the entitlement arrives out-of-band through
 * RevenueCat. `register()` against a Stripe-billed moment therefore never
 * unlocks on the strength of the purchase alone — `PaywallProvider` warns about
 * exactly that when it presents one.
 */
export const shouldRunFeature = (outcome: PresentResult): boolean =>
  outcome.status === "purchased";

/**
 * What `register` resolves to.
 *
 * Returned rather than fire-and-forget so a host can measure how often it ran
 * ungated: `reason: "catalog-unavailable"` is the rate at which failing open is
 * giving features away, and a host that cannot see that number cannot decide
 * whether the default is right for it.
 */
export type RegisterResult =
  | { ran: true; presented: false; reason: "no-paywall" | "catalog-unavailable" }
  | { ran: true; presented: true; reason: "purchased"; outcome: PresentResult }
  | { ran: false; presented: true; reason: "not-purchased"; outcome: PresentResult };

/**
 * Everything `register` reads from its environment, injected.
 *
 * The catalog and its status are read through GETTERS rather than passed by
 * value because `register` may await a wait in the middle: reading them once up
 * front would decide against a catalog that has since arrived, which is the
 * entire point of waiting.
 */
export type RegisterDeps = {
  getCatalog: () => PaywallCatalog | null;
  getCatalogStatus: () => CatalogStatus;
  /** Resolves when the catalog stops loading, or after `timeoutMs`. */
  waitForCatalogSettled: (timeoutMs: number) => Promise<void>;
  present: (moment: string) => Promise<PresentResult>;
  timeoutMs: number;
};

/**
 * `register(moment, feature)`'s whole orchestration.
 *
 * Lives here rather than inside `PaywallProvider` so every branch — both
 * fail-open paths, the wait-once rule, the Stripe warning, and the
 * withhold-on-dismiss case — is covered by a plain async test. This repo has no
 * vitest config, so tests run without a DOM; a provider-rendering test would
 * mean adding jsdom to assert control flow that has nothing to do with
 * rendering.
 *
 * It delegates presentation to the injected `present`, which in the provider is
 * the real one — so the wedge recovery, the purchase-generation race guard and
 * outcome reconciliation all apply unchanged.
 */
export const runRegister = async (
  deps: RegisterDeps,
  moment: string,
  feature?: RegisterFeature,
): Promise<RegisterResult> => {
  let decision = resolveRegisterDecision(deps.getCatalog(), deps.getCatalogStatus(), moment);

  if (decision.type === "wait") {
    // Called on a user tap, so it cannot simply fail because the catalog has not
    // landed. In practice a returning user's catalog is already on disk and this
    // resolves immediately.
    await deps.waitForCatalogSettled(deps.timeoutMs);
    decision = resolveRegisterDecision(deps.getCatalog(), deps.getCatalogStatus(), moment);
    // The wait timed out with the catalog still loading. Decide — never wait a
    // second time, or a permanently-loading catalog would park the caller
    // forever in `timeoutMs` increments.
    if (decision.type === "wait") decision = { type: "run", reason: "catalog-unavailable" };
  }

  if (decision.type === "run") {
    if (decision.reason === "catalog-unavailable") {
      // Failing OPEN. The alternative locks every gated feature behind a network
      // call: an offline launch would make the app's features silently dead with
      // no paywall to explain why, which is indistinguishable from a broken app.
      // The cost is real — some sessions get a paid feature free — so it is
      // logged, and the returned `reason` lets a host measure the rate.
      console.warn(
        `[paywalls] register("${moment}") could not reach a verdict (no paywall catalog) ` +
          "and ran the feature ungated. The catalog failed to load, or is still loading " +
          "after the register timeout.",
      );
    }
    await feature?.();
    return { ran: true, presented: false, reason: decision.reason };
  }

  if (decision.paywall.billing === "stripe") {
    // A Stripe purchase resolves "pending", never "purchased", because the
    // entitlement arrives out-of-band via RevenueCat — so the feature would
    // never unlock on the purchase alone.
    console.warn(
      `[paywalls] register("${moment}") will present a Stripe-billed paywall, whose purchase ` +
        'resolves "pending" rather than "purchased" — so the gated feature will NOT run on a ' +
        "successful checkout. Grant access from your RevenueCat entitlement webhook instead.",
    );
  }

  const outcome = await deps.present(moment);
  if (shouldRunFeature(outcome)) {
    await feature?.();
    return { ran: true, presented: true, reason: "purchased", outcome };
  }
  // Covers dismissed, cancelled, pending, and every `present()` error — including
  // "already-presenting", which needs no branch of its own: the feature does not
  // run and the in-flight paywall is untouched.
  return { ran: false, presented: true, reason: "not-purchased", outcome };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/onboarding -- register`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/onboarding/src/paywalls
git commit -m "✨ feat(paywalls): register()'s decision and feature gate as pure functions"
```

---

### Task 6: `register` on the provider and the hook

**Files:**
- Create: `packages/onboarding/src/paywalls/catalogSettleWaiter.ts`
- Modify: `packages/onboarding/src/paywalls/PaywallProvider.tsx`
- Modify: `packages/onboarding/src/paywalls/usePaywall.ts`
- Test: `packages/onboarding/src/paywalls/__tests__/catalogSettleWaiter.test.ts`

**Interfaces:**
- Consumes: Task 5's `runRegister`, `RegisterDeps`, `RegisterResult`, `RegisterFeature`; the existing `present`.
- Produces: `register` on `PaywallContextValue` and on `usePaywall()`'s result; `registerTimeoutMs?: number` on `PaywallProviderProps` (default `3000`, exported as `DEFAULT_REGISTER_TIMEOUT_MS`).

**Interfaces (continued):**
- Produces: `createCatalogSettleWaiter(isLoading, schedule?): CatalogSettleWaiter`
  with `{ wait(timeoutMs): Promise<void>; settle(): void }`

`register`'s branches are all covered by Task 5's `runRegister` tests, so what
is left in the provider is wiring — building a `RegisterDeps` from refs and
threading a prop, both of which `tsc` checks and the latter of which follows the
`presentAckTimeoutMs` precedent exactly.

The one genuinely new piece of logic is the settle waiter, and it has two
non-obvious invariants worth a test: it must not resolve a waiter twice (a
timeout racing a real settle), and it must not skip a waiter that re-parks from
another waiter's continuation (mutating the set while draining it). So it is
extracted into its own module with the timer injected, rather than written inline
in the component where neither invariant could be asserted without a DOM.

- [ ] **Step 1: Write the failing test**

Create `packages/onboarding/src/paywalls/__tests__/catalogSettleWaiter.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createCatalogSettleWaiter } from "../catalogSettleWaiter";

// A controllable stand-in for setTimeout: records pending callbacks so a test
// can fire them deliberately instead of waiting on real time.
const makeScheduler = () => {
  const pending: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
  const schedule = (fn: () => void, ms: number) => {
    const entry = { fn, ms, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  const fire = () => {
    for (const entry of [...pending]) if (!entry.cancelled) entry.fn();
  };
  return { schedule, fire, pending };
};

describe("createCatalogSettleWaiter", () => {
  it("resolves immediately when the catalog is not loading", async () => {
    const { schedule, pending } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => false, schedule);
    await waiter.wait(1000);
    // Nothing was scheduled: there was nothing to wait for.
    expect(pending).toHaveLength(0);
  });

  it("parks while loading and resolves on settle()", async () => {
    const { schedule } = makeScheduler();
    let loading = true;
    const waiter = createCatalogSettleWaiter(() => loading, schedule);

    let resolved = false;
    const promise = waiter.wait(1000).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    loading = false;
    waiter.settle();
    await promise;
    expect(resolved).toBe(true);
  });

  it("resolves on timeout even if settle() never comes", async () => {
    const { schedule, fire } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const promise = waiter.wait(1000);
    fire();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves each waiter exactly once when a timeout races a settle", async () => {
    const { schedule, fire } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const onResolve = vi.fn();
    const promise = waiter.wait(1000).then(onResolve);

    waiter.settle();
    fire(); // the timeout fires after the settle already resolved it
    await promise;

    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it("cancels a waiter's timer once it has settled, leaving nothing pending", async () => {
    const { schedule, pending } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const promise = waiter.wait(1000);
    waiter.settle();
    await promise;
    expect(pending.every((entry) => entry.cancelled)).toBe(true);
  });

  it("settles every parked waiter", async () => {
    const { schedule } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const results: number[] = [];
    const all = Promise.all([
      waiter.wait(1000).then(() => results.push(1)),
      waiter.wait(1000).then(() => results.push(2)),
      waiter.wait(1000).then(() => results.push(3)),
    ]);
    waiter.settle();
    await all;
    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it("does not skip a waiter that re-parks from another waiter's continuation", async () => {
    const { schedule } = makeScheduler();
    let loading = true;
    const waiter = createCatalogSettleWaiter(() => loading, schedule);
    const second = vi.fn();

    // The first waiter's continuation parks a NEW waiter — which must not be
    // dropped by the drain that woke the first one.
    const first = waiter.wait(1000).then(() => {
      void waiter.wait(1000).then(second);
    });

    waiter.settle();
    await first;
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled(); // still parked, correctly

    waiter.settle();
    await Promise.resolve();
    await Promise.resolve();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("settle() with nothing parked is a no-op", () => {
    const { schedule } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    expect(() => waiter.settle()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace=packages/onboarding -- catalogSettleWaiter`
Expected: FAIL — `Cannot find module '../catalogSettleWaiter'`.

- [ ] **Step 3: Implement the waiter**

`packages/onboarding/src/paywalls/catalogSettleWaiter.ts`:

```ts
/**
 * Parks `register()` callers while the paywall catalog is still loading, and
 * wakes them when it settles or when their own timeout elapses.
 *
 * Extracted from `PaywallProvider` — rather than written inline over a couple of
 * refs — because it has two invariants that are easy to get wrong and impossible
 * to assert from inside a component without a DOM (this repo's tests run in
 * vitest's default `node` environment):
 *
 * 1. **A waiter resolves exactly once.** A timeout can fire after a real settle
 *    already woke the waiter. Resolving twice is harmless for a Promise but the
 *    bookkeeping around it is not — a stale entry left in the set would be woken
 *    by the NEXT settle, resolving a promise that belongs to nobody.
 * 2. **Draining must not skip a re-parked waiter.** A woken caller's
 *    continuation may call `register()` again and park immediately; mutating the
 *    set while iterating it would either miss that new waiter or loop over it.
 *    So the set is swapped out before it is drained.
 *
 * The timer is injected so both invariants are testable without real time.
 */

/** Cancels the scheduled callback. */
export type ScheduleCancel = () => void;
export type Schedule = (fn: () => void, ms: number) => ScheduleCancel;

export type CatalogSettleWaiter = {
  /** Resolves when the catalog stops loading, or after `timeoutMs`. */
  wait: (timeoutMs: number) => Promise<void>;
  /** Wakes every parked waiter. Called when the catalog status leaves "loading". */
  settle: () => void;
};

const defaultSchedule: Schedule = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

export const createCatalogSettleWaiter = (
  isLoading: () => boolean,
  schedule: Schedule = defaultSchedule,
): CatalogSettleWaiter => {
  let waiters = new Set<() => void>();

  return {
    wait: (timeoutMs) =>
      new Promise<void>((resolve) => {
        // Nothing to wait for — do not allocate a timer or an entry.
        if (!isLoading()) return resolve();

        let settled = false;
        let cancelTimer: ScheduleCancel = () => {};

        const finish = () => {
          if (settled) return; // invariant 1
          settled = true;
          waiters.delete(finish);
          cancelTimer();
          resolve();
        };

        waiters.add(finish);
        cancelTimer = schedule(finish, timeoutMs);
      }),

    settle: () => {
      // Swapped before draining — invariant 2.
      const parked = waiters;
      waiters = new Set();
      for (const wake of parked) wake();
    },
  };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/onboarding -- catalogSettleWaiter`
Expected: PASS.

- [ ] **Step 5: Wire the waiter and `register` into `PaywallProviderInner`**

Add next to the existing `catalogRef` block:

```ts
  // `catalogStatus` as a ref so `register` reads the CURRENT status without
  // being re-created on every status change — the same pattern `present` and
  // `complete` use for `catalog`/`activeMoment`.
  const catalogStatusRef = useRef(catalogStatus);
  catalogStatusRef.current = catalogStatus;

  // One waiter per provider instance, reading status through the ref above.
  const settleWaiterRef = useRef<CatalogSettleWaiter | null>(null);
  if (settleWaiterRef.current === null) {
    settleWaiterRef.current = createCatalogSettleWaiter(
      () => catalogStatusRef.current === "loading",
    );
  }
```

Wake parked callers whenever the catalog stops loading:

```ts
  useEffect(() => {
    if (catalogStatus === "loading") return;
    settleWaiterRef.current?.settle();
  }, [catalogStatus]);
```

Then `register` itself — thin, because the behaviour lives in `runRegister`:

```ts
  /**
   * Superwall's `registerPlacement`, in this SDK's vocabulary: gate a feature on
   * a moment.
   *
   * Gates on the MOMENT alone — there is deliberately no entitlement check.
   * Exclude subscribers by authoring an audience filter against a user property
   * the host sets (`plan: "pro"`), which is machinery that already exists.
   *
   * All of the decision logic — both fail-open paths, the wait-once rule, the
   * Stripe warning — is `runRegister` in `register.ts`, where it is unit-tested.
   * This callback only supplies the environment.
   */
  const register = useCallback(
    (moment: string, feature?: RegisterFeature): Promise<RegisterResult> =>
      runRegister(
        {
          getCatalog: () => catalogRef.current,
          getCatalogStatus: () => catalogStatusRef.current,
          waitForCatalogSettled: (ms) => settleWaiterRef.current!.wait(ms),
          // The real `present`, so the wedge recovery, the purchase-generation
          // race guard and outcome reconciliation all apply unchanged.
          present,
          timeoutMs: registerTimeoutMs,
        },
        moment,
        feature,
      ),
    [present, registerTimeoutMs],
  );
```

Then:

- add `register: (moment: string, feature?: RegisterFeature) => Promise<RegisterResult>` to
  `PaywallContextValue`, with a doc comment stating the moment-only gate;
- add `register` to `contextValue` and to its dependency array;
- add to `EMPTY_PAYWALL_CONTEXT`:

  ```ts
    // No provider above: no verdict is reachable, which is the fail-open case —
    // consistent with how `register` treats an unavailable catalog, and with
    // `present` resolving "unknown-moment" here.
    register: async (_moment, feature) => {
      await feature?.();
      return { ran: true, presented: false, reason: "catalog-unavailable" };
    },
  ```

- add the prop and default:

  ```ts
  /**
   * How long `register()` waits for the catalog to settle before deciding without
   * it. Generous enough that a cold network fetch usually lands, short enough
   * that a tap does not feel stuck.
   */
  export const DEFAULT_REGISTER_TIMEOUT_MS = 3000;
  ```

  threading `registerTimeoutMs` through `PaywallProviderProps` →
  `PaywallProviderInnerProps` → the inner component exactly as
  `presentAckTimeoutMs` is threaded, defaulted in the outer `PaywallProvider`.

- [ ] **Step 6: Expose it on `usePaywall`**

Add `register` to `UsePaywallResult` — documenting the moment-only gate, that
only a purchase runs the feature, that it fails open when no catalog is
reachable, and the Stripe `pending` caveat — then add it to the destructure and
the returned object in `usePaywall()`.

- [ ] **Step 7: Run everything**

Run: `npm run type:check --workspace=packages/onboarding && npm test --workspace=packages/onboarding`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add packages/onboarding/src
git commit -m "✨ feat(paywalls): register(moment, feature) gates a feature on a moment"
```

---

### Task 7: Exports, docs, host-facing skills, version bump

Two SDK surfaces are host-facing, so the setup skills must move with them — the `bump-version` skill's own pre-flight check exists because the provider surface added across 1.54–1.59 never reached them and both kept wiring the SDK the old way for five minor versions.

**Files:**
- Modify: `packages/onboarding/src/index.ts`
- Modify: `packages/onboarding/README.md`
- Modify: `claude-plugin/skills/setup-headless-sdk/SKILL.md`
- Modify: `claude-plugin/skills/setup-ui-sdk/SKILL.md`
- Modify: `claude-plugin/skills/setup-paywalls/SKILL.md`
- Modify (via the bump skill): both `package.json`s, `claude-plugin/.claude-plugin/plugin.json`, both `CHANGELOG.md`s

- [ ] **Step 1: Export the public surface**

In `packages/onboarding/src/index.ts`, after the ComposableScreen exports:

```ts
// The mutable, persisted user-property map that feeds audience resolution.
// A singleton, so non-React code (a login handler, an analytics service) can
// write to it — see `userProperties/store.ts` for why this one piece of state
// is not a provider.
export {
  userProperties,
  useUserProperties,
  createUserPropertyStore,
  USER_PROPERTIES_STORAGE_KEY,
  RESERVED_USER_PROPERTY_KEYS,
  isReservedUserPropertyKey,
} from "./userProperties";
export type {
  UserProperties,
  UserPropertyPatch,
  UserPropertyValue,
  UserPropertySnapshot,
  UserPropertyStorage,
  UserPropertyStore,
} from "./userProperties";
// register(moment, feature) — gate a feature on a moment.
export { resolveRegisterDecision, shouldRunFeature } from "./paywalls/register";
export type { RegisterDecision, RegisterFeature, RegisterResult } from "./paywalls/register";
export { DEFAULT_REGISTER_TIMEOUT_MS } from "./paywalls/PaywallProvider";
```

Keep these **out** of `index.ts` — they are implementation detail, and a host that reproduces them will drift from the SDK:

- `toQueryParams`, `paramsHash`, `resolveEffectiveParams`, `applyUserPropertyPatch` — internal to the store
- `runRegister`, `RegisterDeps` — the orchestration's injected seam, useful only to its own test
- `ONBOARDING_CACHE_KEY_PREFIX`, `PAYWALLS_CACHE_KEY_PREFIX`, `createCatalogSettleWaiter` — only `clearCache` and `PaywallProvider` read them, both inside the package

`resolveRegisterDecision` and `shouldRunFeature` *are* exported: they are pure, and a host implementing its own gating on top of `catalog` can reuse the SDK's exact rules instead of reimplementing them slightly differently.

- [ ] **Step 2: Document in the README**

Add a **User properties** section covering: `userProperties.set` merge semantics, `null` deletes, the reserved names and *why* they are refused, that values reach audience filters as strings (with the lexicographic-comparison caveat from the spec), persistence and what hydration does and does not fix on a first-ever install, and that the store wins over `customAudienceParams`.

Add a **Gating a feature with `register`** section: the call shape, the three outcomes, that only a purchase unlocks, that it fails open when the catalog is unavailable and how to measure that from the returned `reason`, and the Stripe `pending` caveat.

- [ ] **Step 3: Update the three host-facing skills**

- `setup-headless-sdk` and `setup-ui-sdk`: add setting user properties to the wiring steps, since audience targeting is now something a host wires rather than a prop it may pass.
- `setup-paywalls`: add `register` alongside `present`, and say which to reach for — `register` when gating a feature, `present` when the caller wants the outcome and will act on it itself.

- [ ] **Step 4: Verify nothing else claims to enumerate the exports**

Run: `npm run check:element-docs && npm run check:versions`
Expected: `check:element-docs` passes (no UIElement changed). `check:versions` will FAIL until step 5 — that is expected here.

- [ ] **Step 5: Bump the version**

Use the repo's `bump-version` skill with **minor** (`1.73.0` → `1.74.0`): new features, no breaking change. It updates all five version-carrying files and writes both changelogs.

The headless changelog entry covers the store, `register`, the reserved-key rejection and the cache-key scoping. The UI changelog entry is short — the UI package is untouched — and should say so rather than inventing content.

- [ ] **Step 6: Final verification**

Run: `npm run check:versions && npm run type:check && npm test --workspace=packages/onboarding && npm run build`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "📝 docs(user-properties): document the store and register(), update the setup skills"
```

- [ ] **Step 8: Finish the branch**

Announce and use `superpowers:finishing-a-development-branch`. Publishing (`npm run publish:all`) is the user's — do not run it. The marketplace-manifest PR is optional and not a release blocker.
