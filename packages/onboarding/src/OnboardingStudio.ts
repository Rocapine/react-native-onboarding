import { OnboardingStudioClient } from "./OnboardingStudioClient";
import type { OnboardingStudioClientOptions } from "./types";
import { userPropertyStore } from "./userProperties/store";
import type { UserPropertyStore } from "./userProperties/store";
import type {
  UserProperties,
  UserPropertyPatch,
  UserPropertyValue,
} from "./userProperties/types";

/**
 * What `OnboardingStudio.init` takes: everything `new OnboardingStudioClient()`
 * takes, plus the project id it takes positionally, plus optional initial user
 * properties.
 *
 * `userProperties` here is a genuine convenience rather than sugar. Audience
 * targeting is evaluated against the property map, and persisted properties are
 * only hydrated from disk — so on a first-EVER install there is nothing to
 * hydrate and the first catalog fetch matches the catch-all audience. Seeding at
 * `init`, which runs before any provider mounts, is the only way to be targeted
 * correctly on that first launch.
 */
export type OnboardingStudioConfig = { projectId: string } & OnboardingStudioClientOptions & {
    userProperties?: UserPropertyPatch;
  };

export type OnboardingStudioFacade = {
  /**
   * Configure the SDK. Returns the client it built, so a host that needs
   * `clearCache()` (or wants to pass it explicitly) can keep hold of it.
   *
   * Idempotent for an unchanged config — Fast Refresh re-runs module scope, and
   * rebuilding the client there would orphan the one the providers already hold.
   * A genuinely CHANGED config replaces the client and warns, because silently
   * ignoring it would be worse than either alternative.
   */
  init: (config: OnboardingStudioConfig) => OnboardingStudioClient;
  /** The configured client, or `null` before `init`. */
  getClient: () => OnboardingStudioClient | null;
  isInitialized: () => boolean;
  /** Set one property. `null` deletes it. */
  setUserProperty: (key: string, value: UserPropertyValue | null) => void;
  /** Set several at once. Merges; a `null` value deletes that key. */
  setUserProperties: (patch: UserPropertyPatch) => void;
  removeUserProperty: (key: string) => void;
  getUserProperties: () => UserProperties;
  /**
   * Forget the user: clears every user property, in memory and on disk. Call it
   * on logout.
   *
   * Deliberately does NOT clear the payload cache or the configuration. Logging
   * out should forget who someone is, not force a refetch of content that has
   * not changed — `getClient()?.clearCache()` is right there if both are wanted.
   */
  reset: () => void;
};

/** Stable signature of a config, for the idempotency check in `init`. */
const configSignature = (projectId: string, options: Record<string, unknown>): string =>
  `${projectId}::${JSON.stringify(options)}`;

/**
 * The SDK's front door, in the shape the SDKs it sits alongside use
 * (`Superwall.configure` / `Purchases.configure` / `amplitude.init`): one
 * module-level object that owns configuration and user identity.
 *
 * A factory with the store injected, so its tests need a fake store rather than
 * a module mock — the same reason `createUserPropertyStore` is a factory.
 *
 * `register`/`present` deliberately do NOT live here. Presenting needs the
 * mounted provider's catalog and presentation state, so they stay on
 * `usePaywall()`, where that state is reachable and where a call cannot be made
 * before a provider exists.
 */
export const createOnboardingStudio = (store: UserPropertyStore): OnboardingStudioFacade => {
  let client: OnboardingStudioClient | null = null;
  let signature: string | null = null;

  return {
    init: (config) => {
      const { projectId, userProperties: initialProperties, ...options } = config;
      const next = configSignature(projectId, options);

      if (client && signature === next) {
        // Same config: hand back the same client. Seeding the same properties
        // again would be a no-op anyway (`applyUserPropertyPatch` returns the
        // same object when nothing changed), so there is nothing else to do.
        return client;
      }

      if (client) {
        console.warn(
          `[onboarding-studio] init() was called again with a DIFFERENT config ` +
            `(projectId "${projectId}"). The previous client has been replaced. ` +
            "Providers already holding the old client keep using it until they " +
            "re-render — call init() once, at module scope."
        );
      }

      client = new OnboardingStudioClient(projectId, options);
      signature = next;

      // Before hydration on purpose: the store merges disk UNDER memory, so a
      // property the host states here beats a stale one from a previous launch.
      if (initialProperties) store.set(initialProperties);
      // Start reading the persisted map now rather than at the first provider
      // mount, so it is ready before anything queries.
      void store.ensureHydrated();

      return client;
    },

    getClient: () => client,
    isInitialized: () => client !== null,

    setUserProperty: (key, value) => store.set({ [key]: value }),
    setUserProperties: (patch) => store.set(patch),
    removeUserProperty: (key) => store.remove(key),
    getUserProperties: () => store.get(),
    reset: () => store.reset(),
  };
};

/** The facade every host uses. */
export const OnboardingStudio = createOnboardingStudio(userPropertyStore);

/**
 * Which client a provider should use: an explicit `client` prop wins, otherwise
 * the one `OnboardingStudio.init()` built.
 *
 * The prop keeps winning so every host that already passes one is untouched by
 * `init` existing.
 */
export const resolveProviderClient = (
  prop: OnboardingStudioClient | undefined,
  fromStudio: OnboardingStudioClient | null
): OnboardingStudioClient | null => prop ?? fromStudio;

/**
 * Shared by both providers, because a host hitting this has exactly two fixes
 * and should be told both rather than left to guess which one this provider
 * wanted.
 */
export const MISSING_CLIENT_MESSAGE =
  "[onboarding-studio] No client. Either call OnboardingStudio.init({ projectId }) " +
  "once at module scope, or pass a `client` prop built with " +
  "`new OnboardingStudioClient(projectId, options)`.";
