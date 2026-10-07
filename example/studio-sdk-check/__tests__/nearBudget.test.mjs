// node --test: a run filled to just under RECORDING_BUDGET, stored and resumed.
// The device check does the same against AsyncStorage; this proves the filling
// itself lands near the budget without tripping truncation.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOnboardingRunTracker, memoryStorage, RECORDING_BUDGET } from "@rocapine/studio-sdk/onboarding";
import { BIG_RUN_START, fillAnswers, measureCapacity } from "../nearBudget.ts";

const CONTEXT = { appVersion: "1.0.0", build: "1", platform: "ios", osVersion: "18.0", locale: "en-US", timezone: "Europe/Paris" };
const bytes = (s) => Buffer.byteLength(s, "utf8");

describe("near-budget run", () => {
  it("measureCapacity finds how many 1,000-character answers fit before truncation", () => {
    const capacity = measureCapacity(CONTEXT);
    assert.ok(capacity > 200 && capacity < 300, `capacity ${capacity}`);
  });

  it("filling to capacity - 1 sends a snapshot within 3 KB under the budget, not truncated, and it is stored and resumed", async () => {
    const capacity = measureCapacity(CONTEXT);
    const storage = memoryStorage();
    const sent = [];
    const diagnostics = [];
    const config = {
      sink: { send: (p) => (sent.push(JSON.stringify(p)), { outcome: "transient" }) },
      context: CONTEXT,
      storage,
      storageKey: "example:test:near-budget",
      debounceMs: 60_000,
      onDiagnostic: (d) => diagnostics.push(d),
    };
    const tracker = createOnboardingRunTracker(config);
    const run = tracker.start(BIG_RUN_START);
    fillAnswers(run, capacity - 1);
    assert.deepEqual(diagnostics.filter((d) => d.code === "truncated"), []);
    run.background(); // sends now
    await tracker.idle();
    await new Promise((r) => setTimeout(r, 20));
    const last = sent.at(-1);
    assert.ok(last, "a snapshot was sent");
    const snapshot = JSON.parse(last);
    assert.equal(snapshot.truncated, undefined);
    assert.ok(bytes(last) <= RECORDING_BUDGET, `${bytes(last)} > budget`);
    assert.ok(bytes(last) >= RECORDING_BUDGET - 3000, `${bytes(last)} is not near the budget`);

    const stored = storage.dump()["example:test:near-budget"];
    assert.ok(bytes(stored) > RECORDING_BUDGET, `stored ${bytes(stored)} bytes`);
    assert.equal(JSON.parse(stored).current.runId, run.runId);
    tracker.dispose();

    const relaunched = createOnboardingRunTracker({ ...config, onDiagnostic: () => {} });
    const resumed = await relaunched.resume();
    assert.equal(resumed?.runId, run.runId);
    relaunched.dispose();
  });
});
