// On-device check of @rocapine/studio-sdk (react-native-onboarding#289):
// Metro resolution of its three subpaths, the run id with and without
// crypto.getRandomValues, a near-budget snapshot through AsyncStorage across a
// kill and relaunch, and a tracked run into the local mock collector.
//
// Start the collector first (from example/): node scripts/studio-sdk-collector.mjs
// Then open this screen, or `example://example/studio-sdk?auto=1` to run every
// check on mount. Every result is also logged with the [studio-sdk-check] prefix.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { utf8ByteLength } from "@rocapine/studio-sdk/core";
import { createOnboardingRunTracker, RECORDING_BUDGET, type OnboardingRun } from "@rocapine/studio-sdk/onboarding";
import * as Rocalytics from "@rocapine/studio-sdk/rocalytics";
import { getRandomValues } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  checkContext,
  checkTracker,
  COLLECTOR_URL,
  LOG_PREFIX,
  setDiagnosticListener,
  STARTUP_GET_RANDOM_VALUES,
  uuidCheckTracker,
} from "../../studio-sdk-check/config";
import { assertLocalUrl, CHECK_STORAGE_KEY } from "../../studio-sdk-check/localOnly";
import { BIG_RUN_START, fillAnswers, measureCapacity } from "../../studio-sdk-check/nearBudget";
import { isLowercaseUuidV7, withRandomSource, type RandomSourceMode } from "../../studio-sdk-check/randomSource";

type Line = { at: string; ok: boolean | null; text: string };

const SUMMARY_URL = assertLocalUrl(COLLECTOR_URL.replace(/\/v1\/onboarding-runs$/, "/summary"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACKED_START = {
  onboarding: { key: "studio_sdk_check_flow", version: "1" },
  manifest: {
    steps: [
      { stepKey: "welcome" },
      { stepKey: "goal" },
      { stepKey: "level_beginner", slot: "level" },
      { stepKey: "level_advanced", slot: "level" },
      { stepKey: "notifications" },
      { stepKey: "done" },
    ],
  },
  properties: { signup_source: "example" },
};

export default function StudioSdkCheck() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const [lines, setLines] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const log = useCallback((ok: boolean | null, text: string) => {
    const tag = ok === null ? "INFO" : ok ? "PASS" : "FAIL";
    console.log(`${LOG_PREFIX} ${tag} ${text}`);
    setLines((prev) => [...prev, { at: new Date().toISOString().slice(11, 19), ok, text }]);
  }, []);

  const truncations = useRef(0);
  useEffect(() => {
    setDiagnosticListener((d) => {
      if (d.code === "truncated") truncations.current += 1;
      log(d.code === "truncated" ? null : false, `diagnostic ${d.code}${d.runId ? ` run=${d.runId}` : ""}: ${d.message}`);
    });
  }, [log]);

  // (1) The three subpaths resolved, or this module would not have loaded.
  const checkResolution = useCallback(() => {
    log(
      typeof createOnboardingRunTracker === "function" && typeof utf8ByteLength === "function" && typeof Rocalytics.RocalyticsClient === "function",
      `resolve /onboarding=${typeof createOnboardingRunTracker} /core=${typeof utf8ByteLength} /rocalytics=${typeof Rocalytics.RocalyticsClient} (no Rocalytics client is constructed)`,
    );
  }, [log]);

  // (2) A run starts with getRandomValues absent, then present; the call counts show which source minted the id.
  const checkUuid = useCallback(
    (mode: RandomSourceMode) => {
      const tracker = uuidCheckTracker();
      const r = withRandomSource(
        mode,
        () => tracker.start({ onboarding: { key: `studio_sdk_check_uuid_${mode}`, version: "1" }, manifest: { steps: [{ stepKey: "only" }] } }),
        getRandomValues as never,
      );
      const run = r.result;
      run.enterStep("only");
      run.complete();
      tracker.dispose();
      const sourceOk = mode === "absent" ? r.mathRandomCalls >= 16 && r.getRandomValuesCalls === 0 : r.getRandomValuesCalls >= 1 && r.mathRandomCalls === 0;
      log(
        isLowercaseUuidV7(run.runId) && r.typeDuring === (mode === "absent" ? "undefined" : "function") && sourceOk,
        `uuid getRandomValues=${mode} typeof before=${r.typeBefore} during=${r.typeDuring} after=${typeof (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto?.getRandomValues} Math.random calls=${r.mathRandomCalls} getRandomValues calls=${r.getRandomValuesCalls} runId=${run.runId} uuidv7=${isLowercaseUuidV7(run.runId)}`,
      );
    },
    [log],
  );

  // (4) A hand-coded onboarding, tracked into the local collector through AsyncStorage.
  const trackedOnboarding = useCallback(async () => {
    const run = checkTracker().start(TRACKED_START);
    run.enterStep("welcome");
    await sleep(200);
    run.exitStep("welcome");
    run.enterStep("goal");
    await sleep(200);
    run.exitStep("goal", { answers: [{ questionKey: "goal", kind: "single", value: "practice" }] });
    run.enterStep("level_advanced");
    await sleep(700); // past the debounce: an in-progress snapshot goes out
    run.exitStep("level_advanced", { answers: [{ questionKey: "daily_minutes", kind: "numeric", value: 15, unit: "minute" }] });
    run.enterStep("done");
    run.complete();
    await checkTracker().idle();
    log(true, `tracked run sent run=${run.runId} (validation happens in the collector: see its log)`);
  }, [log]);

  // (3a) A run filled to just under RECORDING_BUDGET, stored in AsyncStorage and read back. Left in progress.
  const bigRun = useCallback(async () => {
    const t0 = Date.now();
    const capacity = measureCapacity(checkContext());
    const t1 = Date.now();
    truncations.current = 0;
    const run: OnboardingRun = checkTracker().start(BIG_RUN_START);
    fillAnswers(run, capacity - 1);
    run.background(); // sends now
    await checkTracker().idle();
    const t2 = Date.now();
    const raw = await AsyncStorage.getItem(CHECK_STORAGE_KEY);
    const bytes = raw ? utf8ByteLength(raw) : 0;
    let storedRunId: string | null = null;
    let unsent = -1;
    try {
      const stored = raw ? JSON.parse(raw) : null;
      storedRunId = stored?.current?.runId ?? null;
      unsent = Object.keys(stored?.outboxes ?? {}).length;
    } catch {
      storedRunId = null;
    }
    // The stored value is the run state, plus the unsent snapshot while the
    // collector has not answered: about one budget, up to about two.
    log(
      truncations.current === 0 && storedRunId === run.runId && bytes >= RECORDING_BUDGET - 3000,
      `near-budget run=${run.runId} answers=${capacity - 1} (capacity ${capacity}) truncated=${truncations.current > 0} AsyncStorage[${CHECK_STORAGE_KEY}] read back ${bytes} bytes (budget ${RECORDING_BUDGET}, unsent snapshots stored ${unsent}) runId matches=${storedRunId === run.runId} measure=${t1 - t0}ms fill+persist=${t2 - t1}ms`,
    );
    log(null, `SAFE TO KILL: run ${run.runId} is stored in progress; kill the app, relaunch, and reopen this screen to resume it`);
  }, [log]);

  const summary = useCallback(async () => {
    try {
      const s = await fetch(SUMMARY_URL).then((r) => r.json());
      log(s.invalid === 0, `collector summary received=${s.received} valid=${s.valid} invalid=${s.invalid}`);
    } catch (e) {
      log(false, `collector unreachable at ${SUMMARY_URL}: ${String(e)}`);
    }
  }, [log]);

  const runAll = useCallback(async () => {
    setBusy(true);
    try {
      checkResolution();
      checkUuid("absent");
      checkUuid("present");
      await trackedOnboarding();
      await bigRun();
      await sleep(1500);
      await summary();
    } catch (e) {
      log(false, `check threw: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [bigRun, checkResolution, checkUuid, log, summary, trackedOnboarding]);

  // (3b) On mount, before anything can start a run: resume what a killed process left.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      log(null, `startup typeof crypto.getRandomValues=${STARTUP_GET_RANDOM_VALUES} collector=${COLLECTOR_URL} storageKey=${CHECK_STORAGE_KEY}`);
      const raw = await AsyncStorage.getItem(CHECK_STORAGE_KEY);
      const resumed = await checkTracker().resume();
      if (resumed) {
        log(true, `RESUMED run=${resumed.runId} at step=${resumed.currentStepKey} from ${raw ? utf8ByteLength(raw) : 0} stored bytes; completing it`);
        resumed.complete();
        await checkTracker().idle();
        await sleep(1500);
        await summary();
      } else {
        log(null, `nothing to resume (stored bytes: ${raw ? utf8ByteLength(raw) : 0})`);
      }
      setReady(true);
      if (auto === "1" && !resumed) await runAll();
    })();
  }, [auto, log, runAll, summary]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>studio-sdk check</Text>
      <Text style={styles.meta}>collector {COLLECTOR_URL}</Text>
      <View style={styles.row}>
        <Button label="Run all" disabled={!ready || busy} onPress={runAll} />
        <Button label="Summary" disabled={!ready} onPress={summary} />
        <Button label="Back" onPress={() => router.back()} />
      </View>
      <ScrollView style={styles.log} contentContainerStyle={{ paddingBottom: 40 }}>
        {lines.map((l, i) => (
          <Text key={i} style={[styles.line, l.ok === false && styles.fail, l.ok === true && styles.pass]}>
            {l.at} {l.ok === null ? "INFO" : l.ok ? "PASS" : "FAIL"} {l.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.button, disabled && { opacity: 0.4 }]} disabled={disabled} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 64, paddingHorizontal: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700" },
  meta: { fontSize: 11, color: "#555", marginVertical: 4 },
  row: { flexDirection: "row", gap: 8, marginVertical: 8 },
  button: { backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  log: { flex: 1 },
  line: { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: "#333", marginBottom: 4 },
  pass: { color: "#047857" },
  fail: { color: "#b91c1c" },
});
