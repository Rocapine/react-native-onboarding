import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * `assignmentId`: the stable per-person value every `getSteps` / `getPaywalls`
 * request carries, so the server can put the same person in the same variant
 * every time (it hashes this value with the id of the group being split).
 * The SDK's only job is to send the same value every time for the same person.
 *
 * Resolution, per request:
 *   1. the host's `assignmentId` option (a string, or a getter called on every
 *      request — e.g. `() => Purchases.getAppUserID()`),
 *   2. else an installation id, generated once and persisted under
 *      `ASSIGNMENT_ID_STORAGE_KEY`,
 *   3. else nothing: the param is omitted rather than invented, so the server
 *      can tell "no stable id" from "a fresh id it will never see again".
 *
 * A host value that is empty, throws, or does not settle within
 * `HOST_ASSIGNMENT_ID_TIMEOUT_MS` falls through to the installation id, so a
 * broken getter still yields a sticky assignment instead of none.
 */

export type AssignmentIdValue = string | null | undefined;

/** The `OnboardingStudioClientOptions.assignmentId` option. */
export type AssignmentIdOption =
  | AssignmentIdValue
  | (() => AssignmentIdValue | Promise<AssignmentIdValue>);

/**
 * Deliberately NOT under the `rocapine-onboarding` / `rocapine-paywalls`
 * prefixes `OnboardingStudioClient.clearCache` scans, and not the user
 * property key `OnboardingStudio.reset()` removes: clearing a payload cache or
 * logging out must not move the install to another variant.
 */
export const ASSIGNMENT_ID_STORAGE_KEY = "rocapine-assignment-id";

/** How long a host getter may take before the installation id is used instead. */
export const HOST_ASSIGNMENT_ID_TIMEOUT_MS = 2000;

export type AssignmentIdStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

/** RFC 4122 v4. `crypto.randomUUID` when present; Hermes may not have it. */
const generateUuidV4 = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export type InstallationIdStore = { get: () => Promise<string | undefined> };

/**
 * One in-flight resolution per store, so `getSteps` and `getPaywalls` fired
 * together on a first launch share one generated id and write it once. A
 * failure is not memoized: the next request retries.
 */
export const createInstallationIdStore = (
  storage: AssignmentIdStorage,
  generate: () => string = generateUuidV4,
): InstallationIdStore => {
  let pending: Promise<string | undefined> | null = null;

  const load = async (): Promise<string | undefined> => {
    let stored: string | null;
    try {
      stored = await storage.getItem(ASSIGNMENT_ID_STORAGE_KEY);
    } catch (error) {
      // An unreadable key may still hold an id: generating now could overwrite it.
      console.warn("[assignment-id] Failed to read the installation id; omitting it:", error);
      return undefined;
    }
    const existing = nonEmpty(stored);
    if (existing) return existing;
    const fresh = generate();
    try {
      await storage.setItem(ASSIGNMENT_ID_STORAGE_KEY, fresh);
    } catch (error) {
      // Not persisted means not stable: the next launch would send another one.
      console.warn("[assignment-id] Failed to persist the installation id; omitting it:", error);
      return undefined;
    }
    return fresh;
  };

  return {
    get: () => {
      if (!pending) {
        pending = load().then((id) => {
          if (!id) pending = null;
          return id;
        });
      }
      return pending;
    },
  };
};

/** Calls a host getter; never throws, never waits past the bound. */
const readHostValue = async (option: AssignmentIdOption): Promise<string | undefined> => {
  if (typeof option !== "function") return nonEmpty(option);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(option),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
          console.warn(
            `[assignment-id] The assignmentId getter did not settle within ${HOST_ASSIGNMENT_ID_TIMEOUT_MS}ms; ` +
              "using the installation id for this request."
          );
          resolve(undefined);
        }, HOST_ASSIGNMENT_ID_TIMEOUT_MS);
      }),
    ]);
    return nonEmpty(value);
  } catch (error) {
    console.warn("[assignment-id] The assignmentId getter threw; using the installation id:", error);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

/** Host value → installation id → `undefined`. Never throws. */
export const resolveAssignmentId = async (
  option: AssignmentIdOption,
  installation: InstallationIdStore,
): Promise<string | undefined> => (await readHostValue(option)) ?? installation.get();

let installationIdStore = createInstallationIdStore(AsyncStorage);

/** The process-wide installation id store: shared by every client, like the disk it reads. */
export const getInstallationIdStore = (): InstallationIdStore => installationIdStore;

/** Test-only: forget the in-memory id, as a new process would. */
export const __resetInstallationIdForTests = (): void => {
  installationIdStore = createInstallationIdStore(AsyncStorage);
};
