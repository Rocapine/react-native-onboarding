// What this process sent to the mock collector, and the summary verdict over it.
//
// The summary used to pass on `invalid === 0` alone, so a collector that had
// received nothing read PASS, and a run whose sends all ended transient was
// silent. Now the app keeps a ledger, filled by a sink wrapper, of every run it
// started and every send's answer, and the summary passes only when each of
// those runs reached the collector at least as many times as the app was
// answered, was valid every time, has no send left in flight or transient,
// and, when the app knows how the run ended, is stored with that status.
// It polls the collector's /summary until that holds or a timeout ends it,
// instead of sleeping a fixed time.
// No relative imports, so `node --test` can load this file as is.
import type { Sink, SinkResult } from "@rocapine/studio-sdk/onboarding";

export type SendOutcome = SinkResult["outcome"];

export interface LedgerRun {
  runId: string;
  /** Sends handed to the sink. */
  attempts: number;
  /** Sends the collector answered with an outcome: each of these reached it. */
  answered: number;
  /** Sends not answered yet. */
  inFlight: number;
  /** The last finished send's outcome, or null before any finished. */
  last: SendOutcome | null;
  outcomes: Record<SendOutcome, number>;
  /** The status the collector's stored snapshot must end at, when the app knows it. */
  expectedStatus: RunStatus | null;
}

export type RunStatus = "in_progress" | "completed";

export interface SendLedger {
  /** A run was started: the summary expects it at the collector even if nothing was sent. */
  started(runId: string): void;
  /**
   * The run's last snapshot has this status (it was completed, or left in
   * progress): the summary waits for the collector to store exactly that, so a
   * completion still queued in the tracker is not read as verified.
   */
  expectStatus(runId: string, status: RunStatus): void;
  began(runId: string): void;
  ended(runId: string, outcome: SendOutcome): void;
  runs(): LedgerRun[];
}

export function createSendLedger(): SendLedger {
  const byId = new Map<string, LedgerRun>();
  const entry = (runId: string): LedgerRun => {
    let e = byId.get(runId);
    if (!e) {
      e = { runId, attempts: 0, answered: 0, inFlight: 0, last: null, outcomes: { accepted: 0, ignored: 0, rejected: 0, transient: 0 }, expectedStatus: null };
      byId.set(runId, e);
    }
    return e;
  };
  return {
    started: (runId) => void entry(runId),
    expectStatus(runId, status) {
      entry(runId).expectedStatus = status;
    },
    began(runId) {
      const e = entry(runId);
      e.attempts += 1;
      e.inFlight += 1;
    },
    ended(runId, outcome) {
      const e = entry(runId);
      e.inFlight = Math.max(0, e.inFlight - 1);
      e.last = outcome;
      e.outcomes[outcome] += 1;
      if (outcome !== "transient") e.answered += 1;
    },
    runs: () => [...byId.values()].map((e) => ({ ...e, outcomes: { ...e.outcomes } })),
  };
}

/**
 * `inner`, recording every send in `ledger` by the payload's `run_id`. Keeps
 * `inner`'s destination, so the tracker's hand-over between trackers on one
 * storage key works as with `inner`. A throw is answered transient, which is
 * what the tracker makes of a throw anyway.
 */
export function ledgerSink<T>(inner: Sink<T>, ledger: SendLedger): Sink<T> {
  return {
    destination: inner.destination,
    async send(payload: T): Promise<SinkResult> {
      const runId = String((payload as { run_id?: unknown } | null)?.run_id ?? "(no run_id)");
      ledger.began(runId);
      let result: SinkResult;
      try {
        result = await inner.send(payload);
      } catch (e) {
        result = { outcome: "transient", reason: String(e) };
      }
      const known: SendOutcome[] = ["accepted", "ignored", "rejected", "transient"];
      ledger.ended(runId, known.includes(result?.outcome) ? result.outcome : "transient");
      return result;
    },
  };
}

/** The collector's per-run counts (scripts/studio-sdk-collector.mjs, GET /summary). */
export interface CollectorRun {
  received: number;
  valid: number;
  invalid: number;
  lastSeq: number | null;
  lastStatus: string | null;
}

export interface CollectorSummary {
  received: number;
  valid: number;
  invalid: number;
  runs?: Record<string, CollectorRun>;
}

export interface SummaryLine {
  ok: boolean | null;
  text: string;
}

export interface SummaryVerdict {
  ok: boolean;
  lines: SummaryLine[];
}

/** PASS only when every run in `runs` reached the collector, was valid every time, and has nothing unsent. */
export function evaluateSummary(runs: LedgerRun[], collector: CollectorSummary): SummaryVerdict {
  const lines: SummaryLine[] = [];
  if (runs.length === 0) {
    lines.push({ ok: false, text: "nothing was sent this session, so nothing is verified: run the checks first" });
  }
  for (const r of runs) {
    const c = collector.runs?.[r.runId];
    const problems: string[] = [];
    if (r.attempts === 0) problems.push("started but never sent");
    if (r.inFlight > 0) problems.push(`${r.inFlight} send(s) still in flight`);
    if (r.last === "transient") problems.push(`last send transient (${r.outcomes.transient} transient of ${r.attempts}): a snapshot is unsent`);
    if (r.outcomes.rejected > 0) problems.push(`${r.outcomes.rejected} send(s) answered rejected`);
    if (!c) problems.push("never reached the collector");
    else {
      if (c.received < r.answered) problems.push(`collector received ${c.received} payload(s), the app was answered ${r.answered} times`);
      if (c.invalid > 0) problems.push(`${c.invalid} invalid payload(s) at the collector`);
      if (r.expectedStatus && c.lastStatus !== r.expectedStatus) problems.push(`collector stored ${c.lastStatus ?? "nothing"}, expected ${r.expectedStatus}`);
    }
    const counts = `sent=${r.attempts} answered=${r.answered} received=${c?.received ?? 0} valid=${c?.valid ?? 0} invalid=${c?.invalid ?? 0} last=${r.last ?? "-"}${c ? ` stored seq=${c.lastSeq} ${c.lastStatus}` : ""}`;
    lines.push(problems.length ? { ok: false, text: `run=${r.runId} ${problems.join("; ")} (${counts})` } : { ok: true, text: `run=${r.runId} ${counts}` });
  }
  const ok = runs.length > 0 && lines.every((l) => l.ok !== false);
  lines.push({
    ok,
    text: `collector summary: ${runs.length} run(s) sent this session, ${lines.filter((l) => l.ok === true).length} verified; collector total received=${collector.received} valid=${collector.valid} invalid=${collector.invalid}`,
  });
  return { ok, lines };
}

/**
 * Polls `fetchSummary` until `evaluateSummary` passes for what `ledger` holds,
 * or `timeoutMs` has passed; returns the last verdict. A fetch that fails
 * counts as not caught up, and its error is in the verdict when it is the last.
 */
export async function pollSummary(options: {
  ledger: Pick<SendLedger, "runs">;
  fetchSummary: () => Promise<CollectorSummary>;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<SummaryVerdict> {
  const { ledger, fetchSummary, timeoutMs = 10_000, intervalMs = 250 } = options;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let verdict: SummaryVerdict;
    try {
      verdict = evaluateSummary(ledger.runs(), await fetchSummary());
    } catch (e) {
      verdict = { ok: false, lines: [{ ok: false, text: `collector unreachable: ${String(e)}` }] };
    }
    if (verdict.ok || Date.now() >= deadline) {
      if (!verdict.ok) verdict.lines.push({ ok: false, text: `gave up after ${timeoutMs} ms` });
      return verdict;
    }
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
  }
}
