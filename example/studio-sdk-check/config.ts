// Startup configuration of the @rocapine/studio-sdk check. Imported for its
// side effects by app/_layout.tsx, so the guard below runs when the app starts,
// not when someone first opens the check screen:
//
// - The collector URL is the local mock collector (scripts/studio-sdk-collector.mjs),
//   or EXPO_PUBLIC_STUDIO_SDK_COLLECTOR_URL when set. Anything that is not
//   localhost, 127.0.0.1 or 10.0.2.2 throws here, at launch.
// - The tracker uses its own storage key, never the package default.
// - `typeof globalThis.crypto?.getRandomValues` is recorded before any other
//   check code touches the global, so the log shows what the runtime provides.
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createHttpSink,
  createOnboardingRunTracker,
  type Diagnostic,
  type OnboardingRunTracker,
  type RunContextInput,
} from "@rocapine/studio-sdk/onboarding";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { CHECK_STORAGE_KEY, collectorUrlFor } from "./localOnly";
import { typeOfGetRandomValues } from "./randomSource";

export const LOG_PREFIX = "[studio-sdk-check]";

export const COLLECTOR_URL = collectorUrlFor(Platform.OS, process.env.EXPO_PUBLIC_STUDIO_SDK_COLLECTOR_URL);

/** What the runtime offered before the check ran anything. */
export const STARTUP_GET_RANDOM_VALUES = typeOfGetRandomValues();

console.log(
  `${LOG_PREFIX} startup platform=${Platform.OS} collector=${COLLECTOR_URL} storageKey=${CHECK_STORAGE_KEY} typeof crypto.getRandomValues=${STARTUP_GET_RANDOM_VALUES}`,
);

export function checkContext(): RunContextInput {
  const intl = Intl.DateTimeFormat().resolvedOptions();
  return {
    appVersion: Constants.expoConfig?.version ?? "1.0.0",
    build: null,
    platform: Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios",
    osVersion: String(Platform.Version).slice(0, 32) || null,
    locale: intl.locale || "en-US",
    timezone: intl.timeZone || "UTC",
  };
}

const sink = createHttpSink({ url: COLLECTOR_URL });

let diagnosticListener: (d: Diagnostic) => void = (d) => console.log(`${LOG_PREFIX} diagnostic ${d.code}: ${d.message}`);
/** Where the trackers' diagnostics go: the screen showing the check, while it is mounted. */
export function setDiagnosticListener(listener: (d: Diagnostic) => void): void {
  diagnosticListener = listener;
}
const onDiagnostic = (d: Diagnostic) => diagnosticListener(d);

let tracker: OnboardingRunTracker | null = null;

/**
 * The check's persisted tracker: AsyncStorage under CHECK_STORAGE_KEY, sending
 * to the local collector. One per JS process, so a relaunch gets a fresh one
 * that reads what the killed process stored.
 */
export function checkTracker(): OnboardingRunTracker {
  tracker ??= createOnboardingRunTracker({
    sink,
    context: checkContext,
    storage: AsyncStorage,
    storageKey: CHECK_STORAGE_KEY,
    onDiagnostic,
  });
  return tracker;
}

/**
 * A tracker with no storage, for the run-id checks: it still sends to the
 * local collector, so each of those runs is validated there too.
 */
export function uuidCheckTracker(): OnboardingRunTracker {
  return createOnboardingRunTracker({
    sink,
    context: checkContext,
    storageKey: `${CHECK_STORAGE_KEY}:uuid`,
    debounceMs: 0,
    onDiagnostic,
  });
}
