import type { PermissionKind } from "./actions";

/**
 * The bundled resolver behind the `requestPermission` ButtonAction (#196).
 *
 * Every permission module is an **optional** peer dep, `require`d at press time
 * — the `expo-haptics` / `expo-store-review` / `expo-linear-gradient` pattern
 * (`./haptics.ts`), so an app that never asks for the camera does not carry
 * `expo-camera`. Two departures from that precedent, both deliberate:
 *
 *  - **The require is lazy, not module-level.** `haptics.ts` requires on import;
 *    doing that here would pull in up to seven native modules — several of
 *    which register listeners or notification handlers as an import side effect
 *    — on any screen that merely renders a Button. A kind is loaded the first
 *    time it is asked for, then cached.
 *  - **A missing module is NOT a silent no-op.** Haptics can vanish and nobody
 *    notices; a permission gate can be the only thing standing between the user
 *    and the next screen. Absence resolves the distinct `"unavailable"` outcome,
 *    which `runActions` routes to `onUnavailable` (falling back to `onDenied`,
 *    and reporting an error when the author declared neither).
 *
 * ## The `require` shape is load-bearing (review round 1)
 *
 * Metro resolves every literal `require` string when it BUILDS the graph, long
 * before any of this runs, so a module that is not installed fails the whole
 * bundle — unless Metro marks the dependency *optional*. Its rule
 * (`isOptionalDependency` in
 * `@expo/metro-config/build/transform-worker/collect-dependencies.js`, enabled
 * by `allowOptionalDependencies: true` in Expo's default config) is purely
 * syntactic: walk at most three statements up from the call, and answer yes
 * only if the first `BlockStatement` reached is a `TryStatement`'s own `block`.
 *
 * So each `require` below sits DIRECTLY inside a literal `try` block, exactly
 * like `haptics.ts`. The first version of this file put them in arrow functions
 * that a try/catch helper invoked instead — semantically identical, and it made
 * every one of the seven MANDATORY: `expo start` on the example app died with
 * `Unable to resolve module expo-notifications` on ios, android and web, and
 * the whole app was unbundleable rather than just this screen.
 * `__tests__/permissionModules.test.ts` asserts the shape at source level,
 * because nothing observable in Node tells the two forms apart.
 *
 * The module name must also stay a literal — `require(candidate.module)` cannot
 * be resolved by a static bundler at all — hence a table of named loaders
 * rather than one parameterised loader.
 */

/** What one request resolves to. `"unavailable"` means this build could not ask at all. */
export type PermissionOutcome = "granted" | "denied" | "unavailable";

/**
 * A host-supplied override for the bundled resolver, per kind. Returning
 * `undefined` means "not mine", and the bundled Expo resolver runs instead.
 *
 * It overrides the SIX declared kinds — an app that already owns a notification
 * opt-in flow, or asks for the camera through its own native module. It does
 * NOT add a seventh: `PermissionKindSchema` is a closed enum, so a payload
 * naming `"healthKit"` or `"screenTime"` fails `invalid_union` and takes the
 * whole screen to the error boundary before this is ever consulted. Those two
 * need the kind added to the headless schema first (#261); an
 * earlier version of this comment called this their "seam", which was true of
 * the resolver and false of the schema.
 *
 * Set it on `OnboardingPage` (which forwards it to a ComposableScreen step and
 * to a Paywall step) or on `PaywallHost` (for a `present()`ed paywall). Every
 * `ScreenHost` builder threads it — see
 * `Runtime/__tests__/hostResolverWiring.test.ts`.
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
 * One optional module, and the function name(s) the permission is asked
 * through on it.
 */
export type PermissionModuleCandidate = {
  /** npm name — must have an entry in `permissionModuleLoaders`. */
  module: string;
  fns: readonly string[];
};

/**
 * `require` one optional module, keyed by name. Each body is the literal
 * `try { return require("…"); } catch { … }` Metro needs to treat the
 * dependency as optional (see this file's header); a module that is not
 * installed answers `null` here instead of failing the bundle.
 *
 * `catch` swallows both the resolution failure and the `ReferenceError` from an
 * ESM context where `require` is not defined at all — which is how this reads
 * under vitest, and is also the honest answer there: no native module, so
 * nothing to ask.
 */
export const permissionModuleLoaders: Record<string, () => unknown> = {
  "expo-notifications": () => {
    try {
      return require("expo-notifications");
    } catch {
      return null;
    }
  },
  "expo-tracking-transparency": () => {
    try {
      return require("expo-tracking-transparency");
    } catch {
      return null;
    }
  },
  "expo-location": () => {
    try {
      return require("expo-location");
    } catch {
      return null;
    }
  },
  "expo-camera": () => {
    try {
      return require("expo-camera");
    } catch {
      return null;
    }
  },
  "expo-audio": () => {
    try {
      return require("expo-audio");
    } catch {
      return null;
    }
  },
  "expo-image-picker": () => {
    try {
      return require("expo-image-picker");
    } catch {
      return null;
    }
  },
  "expo-media-library": () => {
    try {
      return require("expo-media-library");
    } catch {
      return null;
    }
  },
};

/**
 * Which module(s) each kind is asked through, in order. The first candidate
 * that both loads and exposes one of its named functions wins.
 *
 * Exported so `__tests__/permissionModules.test.ts` can assert the table is
 * complete and pin the names: a typo in a function name is invisible in Node
 * (every kind reads `"unavailable"` either way) and would report a real GRANT
 * on a device as a refusal.
 */
export const PERMISSION_MODULES: Record<PermissionKind, readonly PermissionModuleCandidate[]> = {
  notifications: [{ module: "expo-notifications", fns: ["requestPermissionsAsync"] }],
  appTrackingTransparency: [
    { module: "expo-tracking-transparency", fns: ["requestTrackingPermissionsAsync"] },
  ],
  // Foreground only. Background location needs its own App Store review
  // justification, so it is not something a template should be able to ask for.
  locationWhenInUse: [{ module: "expo-location", fns: ["requestForegroundPermissionsAsync"] }],
  camera: [{ module: "expo-camera", fns: ["requestCameraPermissionsAsync"] }],
  // `expo-audio` is the current module; `expo-camera` also owns a microphone
  // permission and is the more commonly installed of the two in a video app.
  microphone: [
    { module: "expo-audio", fns: ["requestRecordingPermissionsAsync"] },
    { module: "expo-camera", fns: ["requestMicrophonePermissionsAsync"] },
  ],
  // Both ask for the same OS photo-library read permission.
  photoLibrary: [
    { module: "expo-image-picker", fns: ["requestMediaLibraryPermissionsAsync"] },
    { module: "expo-media-library", fns: ["requestPermissionsAsync"] },
  ],
};

/** Load a module by name, never throwing. `null` = not installed here. */
type ModuleLoader = (module: string) => unknown;

const loadInstalledModule: ModuleLoader = (module) => {
  const loader = permissionModuleLoaders[module];
  if (!loader) return null;
  try {
    return loader();
  } catch {
    return null;
  }
};

const resolveRequester = (kind: PermissionKind, loadModule: ModuleLoader): Requester | null => {
  for (const candidate of PERMISSION_MODULES[kind] ?? []) {
    let mod: unknown = null;
    try {
      mod = loadModule(candidate.module);
    } catch {
      continue;
    }
    // `pickPermissionRequester` reads the namespace's own values, and a module
    // export can in principle be a throwing getter — so the read is guarded
    // too, not just the load.
    try {
      const found = pickPermissionRequester(mod, candidate.fns);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
};

// Resolved requester per kind, or `null` for "checked, nothing available".
// Cached because the require cost is per-press otherwise, and a module that was
// absent on the first press is absent for the life of the bundle. Only the
// DEFAULT loader is cached: an injected one (tests, and any future host-side
// module registry) must neither read nor poison this.
const requesterCache = new Map<PermissionKind, Requester | null>();

const cachedRequester = (kind: PermissionKind): Requester | null => {
  if (requesterCache.has(kind)) return requesterCache.get(kind) ?? null;
  const found = resolveRequester(kind, loadInstalledModule);
  requesterCache.set(kind, found);
  return found;
};

/**
 * Ask the OS through whichever optional Expo module is installed.
 *
 * Never throws: a module that rejects or returns a shape this does not
 * understand resolves `"unavailable"`, which the caller routes to an explicit
 * outcome hook rather than swallowing.
 *
 * @param options.loadModule Resolve a module by name instead of `require`ing
 *   it. Test seam only — production passes nothing and gets the cached
 *   `require` path.
 */
export const requestPermissionViaExpoModules = async (
  kind: PermissionKind,
  options?: { loadModule?: ModuleLoader }
): Promise<PermissionOutcome> => {
  const request = options?.loadModule
    ? resolveRequester(kind, options.loadModule)
    : cachedRequester(kind);
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
