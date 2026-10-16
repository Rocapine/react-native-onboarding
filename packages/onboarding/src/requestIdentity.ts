import { SDK_VERSION } from "./version";

declare const __DEV__: boolean;

/**
 * The identity every request carries, so the server can tell which app
 * version, build, SDK and environment it served: `appVersion`, `build`,
 * `sdkVersion`, `environment`.
 *
 * These are ordinary query params, so an audience rule can target them too
 * (`environment == "staging"`, a build range).
 */

export type NativeAppInfo = { appVersion?: string; build?: string };

export type ExpoApplicationModule = {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
};

/**
 * `expo-application` is an OPTIONAL peer dependency. Required inside
 * try/catch, so Metro treats it as optional and an app without it still
 * bundles (same pattern as `expo-image` in `infra/preload/preloadAssets.ts`).
 */
export const loadExpoApplication = (): ExpoApplicationModule | null => {
  try {
    return require("expo-application") as ExpoApplicationModule;
  } catch {
    return null;
  }
};

const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

/** Never throws: no module, a throwing module, or null values all mean "unknown". */
export const readNativeAppInfo = (
  load: () => ExpoApplicationModule | null = loadExpoApplication,
): NativeAppInfo => {
  try {
    const mod = load();
    if (!mod) return {};
    return {
      appVersion: nonEmpty(mod.nativeApplicationVersion),
      build: nonEmpty(mod.nativeBuildVersion),
    };
  } catch {
    return {};
  }
};

export const ENVIRONMENT_MAX_LENGTH = 32;

const isDevBuild = (): boolean => typeof __DEV__ !== "undefined" && __DEV__ === true;

export const defaultEnvironment = (
  isSandbox: boolean | undefined,
  isDev: boolean = isDevBuild(),
): "sandbox" | "development" | "production" =>
  isSandbox ? "sandbox" : isDev ? "development" : "production";

/**
 * Developer-chosen, so it is normalized before it leaves the device: it must
 * not blow up the server's cardinality, and a typo in case or punctuation must
 * not split one environment into two.
 */
export const normalizeEnvironment = (raw: unknown, fallback: string): string => {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, ENVIRONMENT_MAX_LENGTH);
  return cleaned || fallback;
};

export type IdentityOptions = {
  appVersion?: string;
  build?: string;
  environment?: string;
  isSandbox?: boolean;
};

/** Host option → expo-application → omitted, for appVersion and build. */
export const resolveRequestIdentity = (
  options: IdentityOptions,
  native: NativeAppInfo,
  isDev?: boolean,
): Record<string, string> => {
  const out: Record<string, string> = {};
  const appVersion = nonEmpty(options.appVersion) ?? native.appVersion;
  const build = nonEmpty(options.build) ?? native.build;
  if (appVersion) out.appVersion = appVersion;
  if (build) out.build = build;
  out.sdkVersion = SDK_VERSION;
  out.environment = normalizeEnvironment(
    options.environment,
    defaultEnvironment(options.isSandbox, isDev),
  );
  return out;
};
