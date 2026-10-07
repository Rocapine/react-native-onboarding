// node --test: the screen's "Run all", pressed twice in one process. The
// near-budget run is left in progress on purpose (so a kill and relaunch can
// resume it), and the next start on the same tracker must not replace it.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOnboardingRunTracker, memoryStorage } from "@rocapine/studio-sdk/onboarding";
import { createCheckRuns, diagnosticVerdict } from "../checkRuns.ts";

const CONTEXT = { appVersion: "1.0.0", build: "1", platform: "ios", osVersion: "18.0", locale: "en-US", timezone: "Europe/Paris" };
const TRACKED = { onboarding: { key: "tracked", version: "1" }, manifest: { steps: [{ stepKey: "a" }, { stepKey: "b" }] } };
const BIG = { onboarding: { key: "big", version: "1" }, manifest: { steps: [{ stepKey: "x" }] } };

let harnesses = 0;
function harness() {
  // A fresh storage key each: a disposed tracker hands its leftovers to the next one on the same key.
  const diagnostics = [];
  const sent = [];
  const tracker = createOnboardingRunTracker({
    sink: { send: (p) => (sent.push(p), { outcome: "accepted" }) },
    context: CONTEXT,
    storage: memoryStorage(),
    storageKey: `example:test:check-runs:${++harnesses}`,
    debounceMs: 0,
    onDiagnostic: (d) => diagnostics.push(d),
  });
  // What the screen logs as FAIL: every diagnostic but truncation.
  const fails = () => diagnostics.filter((d) => diagnosticVerdict(d.code) === false);
  return { tracker, diagnostics, sent, fails };
}

/** One "Run all", in the order the screen runs it: a completed tracked run, then a big run left in progress. */
function runAll(runs, tracker) {
  const tracked = runs.start(tracker, TRACKED).run;
  tracked.enterStep("a");
  tracked.exitStep("a");
  tracked.enterStep("b");
  tracked.complete();
  const big = runs.start(tracker, BIG);
  big.run.enterStep("x");
  big.run.background();
  runs.leaveInProgress(big.run);
  return { tracked, big };
}

describe("createCheckRuns", () => {
  it("a second Run all in one process logs no FAIL: the leftover near-budget run is completed before the next start", async () => {
    const { tracker, sent, fails } = harness();
    const runs = createCheckRuns();
    const first = runAll(runs, tracker);
    const second = runAll(runs, tracker);
    await tracker.idle();
    await new Promise((r) => setTimeout(r, 20));
    tracker.dispose();
    assert.deepEqual(fails().map((d) => d.code), []);
    // The leftover was completed, not abandoned: its completed snapshot went out.
    assert.ok(sent.some((p) => p.run_id === first.big.run.runId && p.status === "completed"));
    // The second big run is the new leftover, still in progress.
    assert.equal(second.big.completedLeftover, null);
    assert.equal(sent.filter((p) => p.run_id === second.big.run.runId).every((p) => p.status === "in_progress"), true);
  });

  it("reports which leftover a start completed", () => {
    const { tracker } = harness();
    const runs = createCheckRuns();
    const { big } = runAll(runs, tracker);
    const next = runs.start(tracker, TRACKED);
    tracker.dispose();
    assert.equal(next.completedLeftover, big.run.runId);
  });

  it("tells the caller about every run it starts", () => {
    const { tracker } = harness();
    const started = [];
    const runs = createCheckRuns((id) => started.push(id));
    const { tracked, big } = runAll(runs, tracker);
    tracker.dispose();
    assert.deepEqual(started, [tracked.runId, big.run.runId]);
  });

  it("a start that replaces a run the check did not leave behind still FAILs", () => {
    const { tracker, fails } = harness();
    const runs = createCheckRuns();
    tracker.start(TRACKED).enterStep("a"); // in progress, not handed to leaveInProgress
    runs.start(tracker, BIG);
    tracker.dispose();
    assert.deepEqual(fails().map((d) => d.code), ["run-replaced"]);
  });
});

describe("diagnosticVerdict", () => {
  it("truncation is INFO, anything else is a FAIL", () => {
    assert.equal(diagnosticVerdict("truncated"), null);
    assert.equal(diagnosticVerdict("run-replaced"), false);
    assert.equal(diagnosticVerdict("rejected"), false);
  });
});
