import type { PermissionKind } from "./actions";

/**
 * The bundled resolver behind the `requestPermission` ButtonAction (#196).
 *
 * Every permission module is an **optional** peer dep, dynamic-`require`d at
 * press time — the `expo-haptics` / `expo-store-review` / `expo-linear-gradient`
 * pattern (`./haptics.ts`), so an app that never asks for the camera does not
 * carry `expo-camera`. Two departures from that precedent, both deliberate:
 *
 *  - **The require is lazy, not module-level.** `haptics.ts` requires on import;
 *    doing that here would pull in up to eight native modules — several of
 *    which register listeners or notification handlers as an import side effect
 *    — on any screen that merely renders a Button. A kind is loaded the first
 *    time it is asked for, then cached.
 *  - **A missing module is NOT a silent no-op.** Haptics can vanish and nobody
 *    notices; a permission gate can be the only thing standing between the user
 *    and the next screen. Absence resolves the distinct `"unavailable"` outcome,
 *    which `runActions` routes to `onUnavailable` (falling back to `onDenied`,
 *    and reporting an error when the author declared neither).
 *
 * `require` is used rather than `import()` because Metro resolves only literal
 * `require` strings — hence one hard-coded loader per module rather than a
 * table keyed by name.
 */

/** What one request resolves to. `"unavailable"` means this build could not ask at all. */
export type PermissionOutcome = "granted" | "denied" | "unavailable";

/**
 * A host-supplied override for the bundled resolver — the seam HealthKit and
 * Screen Time / Family Controls will use, since both need app-owned
 * entitlements the SDK cannot declare. Returning `undefined` means "not mine",
 * and the bundled Expo resolver runs instead.
 */
export type PermissionResolver = (
  kind: PermissionKind
) => Promise<PermissionOutcome | undefined> | PermissionOutcome | undefined;

/**
 * Read an Expo `PermissionResponse` (`{ status, granted, canAskAgain }`).
 *
 * `status` is authoritative because not every module returns `granted`:
 * `expo-tracking-transparency` resolves `{ status: "restricted" }` on a device
 * where ATT is disabled by policy. Anything unreadable — a module whose API
 * changed shape — answers `"unavailable"` and never `"granted"`: failing toward
 * "did not get it" is the only safe direction for a permission.
 */
export function normalizePermissionResponse(response: unknown): PermissionOutcome {
  if (typeof response !== "object" || response === null) return "unavailable";
  const record = response as Record<string, unknown>;
  if (typeof record.status === "string") {
    return record.status === "granted" ? "granted" : "denied";
  }
  if (typeof record.granted === "boolean") {
    return record.granted ? "granted" : "denied";
  }
  return "unavailable";
}

type Requester = (...args: unknown[]) => unknown;

/**
 * Find the request function on a loaded module, trying the module root and then
 * one level into each namespace export.
 *
 * The namespace hop is not defensive padding: `expo-camera` moved
 * `requestCameraPermissionsAsync` between `Camera.` and the module root across
 * SDK versions, and this SDK's peer range covers both.
 */
export function pickPermissionRequester(
  mod: unknown,
  fnNames: readonly string[]
): Requester | null {
  if (typeof mod !== "object" || mod === null) return null;
  const record = mod as Record<string, unknown>;
  for (const name of fnNames) {
    if (typeof record[name] === "function") return record[name] as Requester;
  }
  for (const value of Object.values(record)) {
    if (typeof value !== "object" || value === null) continue;
    const nested = value as Record<string, unknown>;
    for (const name of fnNames) {
      if (typeof nested[name] === "function") return nested[name] as Requester;
    }
  }
  return null;
}

/**
 * `require` a module without ever throwing. Catches both the resolution failure
 * (module not installed) and the `ReferenceError` from an ESM context where
 * `require` is not defined at all — which is how this reads under vitest, and
 * is also the honest answer there: no native module, so nothing to ask.
 */
const safeRequire = (load: () => unknown): unknown => {
  try {
    return load();
  } catch {
    return null;
  }
};

type Candidate = { load: () => unknown; fns: readonly string[] };

/**
 * Which module(s) each kind is asked through, in order. The first candidate
 * that both resolves and exposes one of its named functions wins.
 */
const CANDIDATES: Record<PermissionKind, readonly Candidate[]> = {
  notifications: [
    {
      load: () => require("expo-notifications"),
      fns: ["requestPermissionsAsync"],
    },
  ],
  appTrackingTransparency: [
    {
      load: () => require("expo-tracking-transparency"),
      fns: ["requestTrackingPermissionsAsync"],
    },
  ],
  // Foreground only. Background location needs its own App Store review
  // justification, so it is not something a template should be able to ask for.
  locationWhenInUse: [
    {
      load: () => require("expo-location"),
      fns: ["requestForegroundPermissionsAsync"],
    },
  ],
  camera: [
    {
      load: () => require("expo-camera"),
      fns: ["requestCameraPermissionsAsync"],
    },
  ],
  // `expo-audio` is the current module; `expo-camera` also owns a microphone
  // permission and is the more commonly installed of the two in a video app.
  microphone: [
    {
      load: () => require("expo-audio"),
      fns: ["requestRecordingPermissionsAsync"],
    },
    {
      load: () => require("expo-camera"),
      fns: ["requestMicrophonePermissionsAsync"],
    },
  ],
  // Both ask for the same OS photo-library read permission.
  photoLibrary: [
    {
      load: () => require("expo-image-picker"),
      fns: ["requestMediaLibraryPermissionsAsync"],
    },
    {
      load: () => require("expo-media-library"),
      fns: ["requestPermissionsAsync"],
    },
  ],
};

// Resolved requester per kind, or `null` for "checked, nothing available".
// Cached because the require cost is per-press otherwise, and a module that was
// absent on the first press is absent for the life of the bundle.
const requesterCache = new Map<PermissionKind, Requester | null>();

const resolveRequester = (kind: PermissionKind): Requester | null => {
  if (requesterCache.has(kind)) return requesterCache.get(kind) ?? null;
  let found: Requester | null = null;
  for (const candidate of CANDIDATES[kind] ?? []) {
    const mod = safeRequire(candidate.load);
    // `pickPermissionRequester` reads the namespace's own values, and a module
    // export can in principle be a throwing getter — so the read is guarded
    // too, not just the require.
    try {
      found = pickPermissionRequester(mod, candidate.fns);
    } catch {
      found = null;
    }
    if (found) break;
  }
  requesterCache.set(kind, found);
  return found;
};

/**
 * Ask the OS through whichever optional Expo module is installed.
 *
 * Never throws: a module that rejects or returns a shape this does not
 * understand resolves `"unavailable"`, which the caller routes to an explicit
 * outcome hook rather than swallowing.
 */
export const requestPermissionViaExpoModules = async (
  kind: PermissionKind
): Promise<PermissionOutcome> => {
  const request = resolveRequester(kind);
  if (!request) return "unavailable";
  try {
    return normalizePermissionResponse(await request());
  } catch (err) {
    console.error(
      `[ComposableScreen] requestPermission("${kind}") threw inside the native module:`,
      err
    );
    return "unavailable";
  }
};
