// node --test: the local mock collector the example's tracked run sends to.
// Driven end to end by the real tracker and its stock HTTP sink, over real HTTP.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createHttpSink, createOnboardingRunTracker } from "@rocapine/studio-sdk/onboarding";
import { startCollector } from "../../scripts/studio-sdk-collector.mjs";

const CONTEXT = { appVersion: "1.0.0", build: "1", platform: "ios", osVersion: "18.0", locale: "en-US", timezone: "Europe/Paris" };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-sdk-collector-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const until = async (cond, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};
const post = (url, body) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body }).then(async (r) => ({ status: r.status, body: await r.json() }));

describe("studio-sdk mock collector", () => {
  it("listens on the loopback interface only", async () => {
    const c = await startCollector({ port: 0, logFile: path.join(tmp, "a.jsonl") });
    try {
      assert.match(c.url, /^http:\/\/127\.0\.0\.1:\d+\/v1\/onboarding-runs$/);
    } finally {
      await c.close();
    }
  });

  it("accepts every snapshot of a tracked run, validates each against the shipped schema, and logs one line per payload", async () => {
    const logFile = path.join(tmp, "b.jsonl");
    const c = await startCollector({ port: 0, logFile });
    try {
      const tracker = createOnboardingRunTracker({ sink: createHttpSink({ url: c.url }), context: CONTEXT, debounceMs: 0, onDiagnostic: () => {} });
      const run = tracker.start({ onboarding: { key: "check", version: "1" }, manifest: { steps: [{ stepKey: "a" }, { stepKey: "b" }] } });
      run.enterStep("a");
      run.exitStep("a", { answers: [{ questionKey: "goal", kind: "single", value: "focus" }] });
      run.enterStep("b");
      run.complete();
      await until(() => c.received.some((r) => r.status === "completed"));
      tracker.dispose();
      assert.ok(c.received.length >= 2);
      for (const r of c.received) {
        assert.equal(r.valid, true, JSON.stringify(r.errors));
        assert.equal(r.run_id, run.runId);
        assert.ok(r.bytes > 0);
      }
      assert.equal(c.received.at(-1).outcome, "accepted");
      const lines = fs.readFileSync(logFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      assert.equal(lines.length, c.received.length);
      assert.deepEqual(lines.map((l) => l.seq), c.received.map((r) => r.seq));
    } finally {
      await c.close();
    }
  });

  it("rejects a payload the schema refuses, with the errors in the reply and the log", async () => {
    const c = await startCollector({ port: 0, logFile: path.join(tmp, "c.jsonl") });
    try {
      const r = await post(c.url, JSON.stringify({ schema_version: 1, run_id: "nope", seq: 1 }));
      assert.equal(r.body.outcome, "rejected");
      assert.equal(c.received[0].valid, false);
      assert.ok(c.received[0].errors.length > 0);
      const notJson = await post(c.url, "{");
      assert.equal(notJson.body.outcome, "rejected");
    } finally {
      await c.close();
    }
  });

  it("ignores a seq not above the stored one, and anything after a completed snapshot", async () => {
    const c = await startCollector({ port: 0, logFile: path.join(tmp, "d.jsonl") });
    try {
      const sent = [];
      const tracker = createOnboardingRunTracker({ sink: { send: (p) => (sent.push(p), { outcome: "accepted" }) }, context: CONTEXT, debounceMs: 0, onDiagnostic: () => {} });
      const run = tracker.start({ onboarding: { key: "check", version: "1" }, manifest: { steps: [{ stepKey: "a" }] } });
      run.enterStep("a");
      run.complete();
      await until(() => sent.length >= 2);
      tracker.dispose();
      const [first, completed] = sent;
      assert.equal((await post(c.url, JSON.stringify(first))).body.outcome, "accepted");
      assert.equal((await post(c.url, JSON.stringify(first))).body.outcome, "ignored");
      assert.equal((await post(c.url, JSON.stringify(completed))).body.outcome, "accepted");
      assert.equal((await post(c.url, JSON.stringify({ ...completed, seq: completed.seq + 1 }))).body.outcome, "ignored");
    } finally {
      await c.close();
    }
  });

  it("reports a summary over GET", async () => {
    const c = await startCollector({ port: 0, logFile: path.join(tmp, "e.jsonl") });
    try {
      await post(c.url, "{}");
      const summary = await fetch(c.url.replace(/\/v1\/onboarding-runs$/, "/summary")).then((r) => r.json());
      assert.deepEqual({ received: summary.received, valid: summary.valid, invalid: summary.invalid }, { received: 1, valid: 0, invalid: 1 });
    } finally {
      await c.close();
    }
  });
});
