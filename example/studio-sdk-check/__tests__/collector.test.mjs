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

  describe("the contract's 256 KiB size gate (D8, section 5 rule 2, case A13)", () => {
    // 256 KiB, as onboarding-run-contract.md 3.8 states it: "At most 256 KiB (262,144 bytes) serialized".
    const LIMIT = 262_144;
    /** Two valid snapshots of one run, in progress then completed. */
    const snapshots = async () => {
      const sent = [];
      const tracker = createOnboardingRunTracker({ sink: { send: (p) => (sent.push(p), { outcome: "accepted" }) }, context: CONTEXT, debounceMs: 0, onDiagnostic: () => {} });
      const run = tracker.start({ onboarding: { key: "check", version: "1" }, manifest: { steps: [{ stepKey: "a" }] } });
      run.enterStep("a");
      run.complete();
      await until(() => sent.length >= 2);
      tracker.dispose();
      return sent;
    };
    /** `payload` serialized and padded with JSON whitespace to exactly `bytes` bytes: still the same JSON value. */
    const padded = (payload, bytes) => {
      const s = JSON.stringify(payload);
      return s + " ".repeat(bytes - Buffer.byteLength(s, "utf8"));
    };

    it("accepts a valid snapshot of exactly 256 KiB", async () => {
      const c = await startCollector({ port: 0, logFile: path.join(tmp, "f.jsonl") });
      try {
        const [first] = await snapshots();
        const body = padded(first, LIMIT);
        assert.equal(Buffer.byteLength(body), LIMIT);
        const r = await post(c.url, body);
        assert.equal(r.body.outcome, "accepted");
        assert.equal(c.received[0].valid, true);
        assert.equal(c.received[0].bytes, LIMIT);
      } finally {
        await c.close();
      }
    });

    it("rejects one byte more with 413 and a rejected outcome body, and logs it as invalid", async () => {
      const c = await startCollector({ port: 0, logFile: path.join(tmp, "g.jsonl") });
      try {
        const [first] = await snapshots();
        const r = await post(c.url, padded(first, LIMIT + 1));
        assert.equal(r.status, 413);
        assert.equal(r.body.outcome, "rejected");
        assert.match(r.body.reason, /256 KiB/);
        assert.equal(c.received[0].valid, false);
        assert.equal(c.received[0].outcome, "rejected");
        assert.equal(c.received[0].run_id, first.run_id);
        // Rejected, so the run is not stored: the same snapshot at size is then a new run.
        assert.equal((await post(c.url, JSON.stringify(first))).body.outcome, "accepted");
      } finally {
        await c.close();
      }
    });

    it("checks the size before the schema", async () => {
      const c = await startCollector({ port: 0, logFile: path.join(tmp, "h.jsonl") });
      try {
        const r = await post(c.url, padded({ schema_version: 1, run_id: "nope" }, LIMIT + 1));
        assert.equal(r.body.outcome, "rejected");
        assert.equal(c.received[0].errors.length, 1);
        assert.match(c.received[0].errors[0], /256 KiB/);
      } finally {
        await c.close();
      }
    });

    it("ignores an oversized or invalid snapshot of a run already stored completed: rule 1 runs first (A11)", async () => {
      const c = await startCollector({ port: 0, logFile: path.join(tmp, "i.jsonl") });
      try {
        const [, completed] = await snapshots();
        assert.equal((await post(c.url, JSON.stringify(completed))).body.outcome, "accepted");
        assert.equal((await post(c.url, padded({ ...completed, seq: completed.seq + 1 }, LIMIT + 1))).body.outcome, "ignored");
        assert.equal((await post(c.url, JSON.stringify({ ...completed, seq: completed.seq + 1, status: "quit" }))).body.outcome, "ignored");
      } finally {
        await c.close();
      }
    });
  });

  it("reports per-run counts in its summary, with the stored snapshot's seq and status", async () => {
    const c = await startCollector({ port: 0, logFile: path.join(tmp, "j.jsonl") });
    try {
      const sent = [];
      const tracker = createOnboardingRunTracker({ sink: { send: (p) => (sent.push(p), { outcome: "accepted" }) }, context: CONTEXT, debounceMs: 0, onDiagnostic: () => {} });
      const run = tracker.start({ onboarding: { key: "check", version: "1" }, manifest: { steps: [{ stepKey: "a" }] } });
      run.enterStep("a");
      run.complete();
      await until(() => sent.length >= 2);
      tracker.dispose();
      for (const p of sent) await post(c.url, JSON.stringify(p));
      await post(c.url, JSON.stringify({ ...sent[0], status: "quit" }));
      const summary = await fetch(c.url.replace(/\/v1\/onboarding-runs$/, "/summary")).then((r) => r.json());
      assert.deepEqual(summary.runs[run.runId], {
        received: sent.length + 1,
        valid: sent.length,
        invalid: 1,
        lastSeq: sent.at(-1).seq,
        lastStatus: "completed",
      });
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
