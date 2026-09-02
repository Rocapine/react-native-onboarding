import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyUserPropertyPatch } from "./applyPatch";
import type { UserProperties, UserPropertyPatch } from "./types";

/**
 * The slice of AsyncStorage this needs, injected so the store is testable
 * without mocking a module.
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
 *
 * It also deliberately does NOT start with `rocapine-onboarding` or
 * `rocapine-paywalls`, the two prefixes `OnboardingStudioClient.clearCache`
 * scans: clearing a payload cache must not forget who the user is.
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
 * about the same user. One store makes that impossible — they can now differ
 * only by WHEN they read it, since each is resolved at its own serve time (see
 * `useAudienceParams` in `OnboardingProvider`).
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

  // A fresh object per change, so `useSyncExternalStore` can compare snapshots
  // by identity — and the SAME object between changes, or React would re-render
  // on every check.
  const publish = () => {
    snapshot = { properties, status };
    for (const listener of listeners) listener();
  };

  // Coalesced: a burst of `set` calls in one tick costs one write. Skipped
  // entirely while hydrating — writing then would persist a map that has not yet
  // been merged with what is already on disk, i.e. silently delete properties
  // the host set on a previous launch.
  const scheduleWrite = () => {
    if (status !== "ready" || writeScheduled) return;
    writeScheduled = true;
    setTimeout(() => {
      writeScheduled = false;
      void storage.setItem(USER_PROPERTIES_STORAGE_KEY, JSON.stringify(properties)).catch((error) => {
        // The in-memory map stays authoritative: a failed write costs
        // persistence across launches, not correctness in this one.
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
              // Through the same validation as a live `set` — defence in depth
              // against a payload written by an older version or hand-edited.
              // Warnings are dropped rather than logged: `set` already refused
              // these values when they were first written, so anything caught
              // here cannot occur in a normally-produced payload, and warning
              // on every launch about it would be noise.
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

/**
 * The process-wide store.
 *
 * INTERNAL: hosts reach this through `OnboardingStudio` (`setUserProperty`,
 * `reset`, …) and `useUserProperties()`, never directly. Keeping one public
 * front door means a host cannot half-use the facade and half-use the store, and
 * leaves this module free to change shape.
 */
export const userPropertyStore = createUserPropertyStore(AsyncStorage);
