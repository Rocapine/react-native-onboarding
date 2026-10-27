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
 * `false` (as the option, or returned by the getter) OPTS OUT: nothing is sent
 * and the installation id is never read, created or written — e.g. until the
 * user consents. `null` / `""` are not an opt-out; they fall through to 2.
 *
 * A host value of `undefined`, `null` or `""` falls through to the installation
 * id. A getter that throws, rejects, or does not settle within
 * `HOST_ASSIGNMENT_ID_TIMEOUT_MS` FAILS CLOSED: the id is omitted for that
 * request and the installation id is not read, created or written. A getter
 * that cannot answer may be one that would have answered `false` (no consent
 * yet), so it must never be overridden by the stored id.
 */

/** `false` opts out; `null` / `undefined` / `""` mean "no host value". */
export type AssignmentIdValue = string | false | null | undefined;

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
  removeItem: (key: string) => Promise<void>;
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

export type InstallationIdStore = {
  get: () => Promise<string | undefined>;
  /**
   * Removes the stored id and forgets the in-memory one, so a later request
   * mints a new id. Rejects if the removal fails.
   */
  clear: () => Promise<void>;
};

/**
 * One in-flight resolution per store, so `getSteps` and `getPaywalls` fired
 * together on a first launch share one generated id and write it once. A
 * failure is not memoized: the next request retries.
 *
 * `clear()` must win against a load already in flight, or the id it removes
 * comes back. Two mechanisms:
 * - every storage operation runs on ONE queue, so a removal is ordered after
 *   any write already started, and a load started after `clear()` runs after
 *   the removal (and is therefore never deleted by it);
 * - an `epoch` bumped by `clear()`: a load that began before it neither writes
 *   nor returns an id, so the request in flight sends nothing.
 */
export const createInstallationIdStore = (
  storage: AssignmentIdStorage,
  generate: () => string = generateUuidV4,
): InstallationIdStore => {
  let pending: Promise<string | undefined> | null = null;
  let epoch = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op);
    queue = run.catch(() => {});
    return run;
  };

  const load = async (startedAt: number): Promise<string | undefined> => {
    let stored: string | null;
    try {
      stored = await storage.getItem(ASSIGNMENT_ID_STORAGE_KEY);
    } catch (error) {
      // An unreadable key may still hold an id: generating now could overwrite it.
      console.warn("[assignment-id] Failed to read the installation id; omitting it:", error);
      return undefined;
    }
    if (epoch !== startedAt) return undefined; // cleared meanwhile: do not mint
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
        const startedAt = epoch;
        pending = enqueue(() => load(startedAt)).then((id) => {
          // Cleared while loading: `clear()` already dropped this memo.
          if (epoch !== startedAt) return undefined;
          if (!id) pending = null;
          return id;
        });
      }
      return pending;
    },
    clear: () => {
      epoch++;
      pending = null;
      return enqueue(() => storage.removeItem(ASSIGNMENT_ID_STORAGE_KEY));
    },
  };
};

/**
 * Calls a host getter; never throws, never waits past the bound. Returns
 * `false` (omit, store untouched) for an explicit opt-out AND for a getter that
 * throws or times out; `undefined` only for "no host value".
 */
const readHostValue = async (option: AssignmentIdOption): Promise<string | false | undefined> => {
  if (option === false) return false;
  if (typeof option !== "function") return nonEmpty(option);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(option),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => {
          console.warn(
            `[assignment-id] The assignmentId getter did not settle within ${HOST_ASSIGNMENT_ID_TIMEOUT_MS}ms; ` +
              "sending no assignmentId for this request."
          );
          resolve(false);
        }, HOST_ASSIGNMENT_ID_TIMEOUT_MS);
      }),
    ]);
    return value === false ? false : nonEmpty(value);
  } catch (error) {
    console.warn("[assignment-id] The assignmentId getter threw; sending no assignmentId for this request:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Opt-out, throw or timeout → `undefined` (store untouched); host value →
 * installation id → `undefined`. Never throws.
 */
export const resolveAssignmentId = async (
  option: AssignmentIdOption,
  installation: Pick<InstallationIdStore, "get">,
): Promise<string | undefined> => {
  const host = await readHostValue(option);
  if (host === false) return undefined;
  return host ?? installation.get();
};

let installationIdStore = createInstallationIdStore(AsyncStorage);

/** The process-wide installation id store: shared by every client, like the disk it reads. */
export const getInstallationIdStore = (): InstallationIdStore => installationIdStore;

/** Test-only: forget the in-memory id, as a new process would. */
export const __resetInstallationIdForTests = (): void => {
  installationIdStore = createInstallationIdStore(AsyncStorage);
};
