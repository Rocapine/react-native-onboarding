// node --test: the screen's summary. It passes only when every run this
// process started or sent reached the collector, was validated there, and has
// no send left unanswered; "nothing arrived" is a FAIL, not a PASS.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createHttpSink, createOnboardingRunTracker } from "@rocapine/studio-sdk/onboarding";
import { startCollector } from "../../scripts/studio-sdk-collector.mjs";
import { createSendLedger, evaluateSummary, ledgerSink, pollSummary } from "../ledger.ts";

const CONTEXT = { appVersion: "1.0.0", build: "1", platform: "ios", osVersion: "18.0", locale: "en-US", timezone: "Europe/Paris" };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-sdk-summary-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const A = "01928f3e-7b2c-7d4e-8f00-00000000000a";
const B = "01928f3e-7b2c-7d4e-8f00-00000000000b";
const run = (over = {}) => ({ received: 2, valid: 2, invalid: 0, lastSeq: 2, lastStatus: "completed", ...over });
const collector = (runs) => {
  const all = Object.values(runs);
  const received = all.reduce((n, r) => n + r.received, 0);
  const valid = all.reduce((n, r) => n + r.valid, 0);
  return { received, valid, invalid: received - valid, runs };
};
/** A ledger in which each run had `answered` sends answered `outcome`. */
async function ledgerWith(entries) {
  const ledger = createSendLedger();
  for (const { runId, answered = 2, outcome = "accepted" } of entries) {
    ledger.started(runId);
    const sink = ledgerSink({ send: () => ({ outcome }) }, ledger);
    for (let i = 0; i < answered; i++) await sink.send({ run_id: runId, seq: i + 1 });
  }
  return ledger;
}

describe("evaluateSummary", () => {
  it("FAILs when nothing was sent this session, however clean the collector is", () => {
    const s = evaluateSummary([], collector({}));
    assert.equal(s.ok, false);
    assert.match(s.lines.map((l) => l.text).join("\n"), /nothing/i);
  });

  it("PASSes when every run was received as often as it was answered, and validated", async () => {
    const ledger = await ledgerWith([{ runId: A }, { runId: B }]);
    const s = evaluateSummary(ledger.runs(), collector({ [A]: run(), [B]: run() }));
    assert.equal(s.ok, true, JSON.stringify(s.lines));
  });

  it("FAILs when a sent run_id never reached the collector", async () => {
    const ledger = await ledgerWith([{ runId: A }, { runId: B }]);
    const s = evaluateSummary(ledger.runs(), collector({ [A]: run() }));
    assert.equal(s.ok, false);
    assert.ok(s.lines.some((l) => l.ok === false && l.text.includes(B)), JSON.stringify(s.lines));
  });

  it("FAILs when the collector received fewer payloads of a run than the app had answered", async () => {
    const ledger = await ledgerWith([{ runId: A, answered: 3 }]);
    const s = evaluateSummary(ledger.runs(), collector({ [A]: run({ received: 2, valid: 2 }) }));
    assert.equal(s.ok, false);
    assert.ok(s.lines.some((l) => l.ok === false && /received 2.*3/.test(l.text)), JSON.stringify(s.lines));
  });

  it("FAILs when a payload of a run was invalid, even if the global count is not looked at", async () => {
    const ledger = await ledgerWith([{ runId: A }]);
    const s = evaluateSummary(ledger.runs(), { received: 2, valid: 2, invalid: 0, runs: { [A]: run({ valid: 1, invalid: 1 }) } });
    assert.equal(s.ok, false);
  });

  it("FAILs when the last send of a run was transient: an unsent snapshot is not silent", async () => {
    const ledger = await ledgerWith([{ runId: A, answered: 1, outcome: "transient" }]);
    const s = evaluateSummary(ledger.runs(), collector({ [A]: run({ received: 1, valid: 1 }) }));
    assert.equal(s.ok, false);
    assert.ok(s.lines.some((l) => l.ok === false && /transient/.test(l.text)), JSON.stringify(s.lines));
  });

  it("FAILs when the app was told rejected", async () => {
    const ledger = await ledgerWith([{ runId: A, outcome: "rejected" }]);
    const s = evaluateSummary(ledger.runs(), collector({ [A]: run() }));
    assert.equal(s.ok, false);
  });

  it("FAILs while the collector's stored status is not the one the app expects: a completion not sent yet is not verified", async () => {
    const ledger = await ledgerWith([{ runId: A }]);
    ledger.expectStatus(A, "completed");
    const behind = evaluateSummary(ledger.runs(), collector({ [A]: run({ lastStatus: "in_progress" }) }));
    assert.equal(behind.ok, false);
    assert.ok(behind.lines.some((l) => l.ok === false && /in_progress.*completed/.test(l.text)), JSON.stringify(behind.lines));
    assert.equal(evaluateSummary(ledger.runs(), collector({ [A]: run({ lastStatus: "completed" }) })).ok, true);
  });

  it("FAILs on a run that was started and never sent at all", () => {
    const ledger = createSendLedger();
    ledger.started(A);
    const s = evaluateSummary(ledger.runs(), collector({}));
    assert.equal(s.ok, false);
    assert.ok(s.lines.some((l) => l.ok === false && l.text.includes(A)));
  });
});

describe("ledgerSink", () => {
  it("records each send's outcome per run_id, keeps the inner sink's destination, and counts a throw as transient", async () => {
    const ledger = createSendLedger();
    let fail = false;
    const sink = ledgerSink({ destination: "http://127.0.0.1:1/x", send: () => { if (fail) throw new Error("down"); return { outcome: "accepted" }; } }, ledger);
    assert.equal(sink.destination, "http://127.0.0.1:1/x");
    await sink.send({ run_id: A, seq: 1 });
    fail = true;
    assert.deepEqual(await sink.send({ run_id: A, seq: 2 }), { outcome: "transient", reason: "Error: down" });
    const [entry] = ledger.runs();
    assert.equal(entry.runId, A);
    assert.equal(entry.answered, 1);
    assert.equal(entry.last, "transient");
    assert.equal(entry.inFlight, 0);
  });
});

describe("pollSummary", () => {
  it("polls until the collector has caught up, rather than sleeping a fixed time", async () => {
    const ledger = await ledgerWith([{ runId: A }]);
    const answers = [collector({}), collector({ [A]: run({ received: 1, valid: 1 }) }), collector({ [A]: run() })];
    let calls = 0;
    const s = await pollSummary({ ledger, fetchSummary: async () => answers[Math.min(calls++, answers.length - 1)], timeoutMs: 2000, intervalMs: 5 });
    assert.equal(s.ok, true, JSON.stringify(s.lines));
    assert.equal(calls, 3);
  });

  it("gives up after its timeout with a FAIL, and a fetch error counts as not caught up", async () => {
    const ledger = await ledgerWith([{ runId: A }]);
    const t0 = Date.now();
    const s = await pollSummary({ ledger, fetchSummary: async () => { throw new Error("ECONNREFUSED"); }, timeoutMs: 100, intervalMs: 10 });
    assert.equal(s.ok, false);
    assert.ok(Date.now() - t0 >= 100);
    assert.match(s.lines.map((l) => l.text).join("\n"), /ECONNREFUSED/);
  });
});

describe("summary against the real collector", () => {
  it("a tracked run through the counting sink PASSes; a collector that lost it FAILs", async () => {
    const c = await startCollector({ port: 0, logFile: path.join(tmp, "a.jsonl") });
    const summaryUrl = c.url.replace(/\/v1\/onboarding-runs$/, "/summary");
    const fetchSummary = () => fetch(summaryUrl).then((r) => r.json());
    let tracker;
    try {
      const ledger = createSendLedger();
      tracker = createOnboardingRunTracker({ sink: ledgerSink(createHttpSink({ url: c.url }), ledger), context: CONTEXT, debounceMs: 0, onDiagnostic: () => {} });
      const r = tracker.start({ onboarding: { key: "check", version: "1" }, manifest: { steps: [{ stepKey: "a" }] } });
      ledger.started(r.runId);
      r.enterStep("a");
      r.complete();
      ledger.expectStatus(r.runId, "completed");
      const s = await pollSummary({ ledger, fetchSummary, timeoutMs: 3000, intervalMs: 20 });
      assert.equal(s.ok, true, JSON.stringify(s.lines));

      const fresh = await startCollector({ port: 0, logFile: path.join(tmp, "b.jsonl") });
      try {
        const lost = await pollSummary({ ledger, fetchSummary: () => fetch(fresh.url.replace(/\/v1\/onboarding-runs$/, "/summary")).then((x) => x.json()), timeoutMs: 100, intervalMs: 20 });
        assert.equal(lost.ok, false);
      } finally {
        await fresh.close();
      }
    } finally {
      tracker?.dispose(); // its retry timers would keep the test process alive
      await c.close();
    }
  });
});
