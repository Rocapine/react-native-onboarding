#!/usr/bin/env node
// A local mock collector for the example's @rocapine/studio-sdk check
// (app/example/studio-sdk.tsx). It stands in for a real onboarding-run ingest:
// every payload is validated against the docs/onboarding-run.schema.json that
// ships inside the installed studio-sdk package, written as one JSON line to a
// log, and answered with the outcome body the stock HTTP sink reads.
//
// It listens on 127.0.0.1 only. An iOS simulator reaches it there; an Android
// emulator reaches the same socket through 10.0.2.2, its alias for the host's
// loopback. Nothing outside this machine can.
//
//   node scripts/studio-sdk-collector.mjs [--port 4319] [--log <file>]
//   GET  /summary              counts, and the last payloads' results
//   POST /v1/onboarding-runs   one snapshot
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const require = createRequire(import.meta.url);
const ROUTE = "/v1/onboarding-runs";
const HOST = "127.0.0.1";
/**
 * The contract's hard limit on one snapshot: "At most 256 KiB (262,144 bytes)
 * serialized" (onboarding-run-contract.md 3.8, D8). The one limit the schema
 * cannot express, so the collector checks it itself, before the schema. A
 * larger snapshot is rejected (section 5, rule 2, case A13), with a 413 and a
 * `rejected` outcome body; one of exactly this size is accepted.
 */
export const MAX_SNAPSHOT_BYTES = 262_144;

/** The schema as the installed package ships it, never a copy. */
export function loadSchema() {
  const pkg = require.resolve("@rocapine/studio-sdk/package.json");
  const file = path.join(path.dirname(pkg), "docs", "onboarding-run.schema.json");
  return { file, schema: JSON.parse(fs.readFileSync(file, "utf8")) };
}

/**
 * Starts the collector. `port: 0` picks a free port. Resolves with its URL,
 * every payload's result in arrival order (`received`), and `close()`.
 */
export async function startCollector({ port = 4319, logFile, log = () => {} } = {}) {
  const { file: schemaFile, schema } = loadSchema();
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  const stored = new Map();
  const received = [];
  if (logFile) fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const record = (entry) => {
    received.push(entry);
    if (logFile) fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
    log(entry);
  };

  // The contract's acceptance rules (onboarding-run-contract.md section 5),
  // reduced to what the check needs, in the contract's order:
  //   1. a run stored completed is final: anything more is ignored, whatever
  //      its size or validity;
  //   2. a snapshot over 256 KiB, or one the schema refuses, is rejected (the
  //      size is checked first);
  //   3-7. a snapshot replaces the stored one only with a higher seq.
  // Rule 4 (identity and manifest unchanged) and the section 4 rules beyond the
  // schema are not checked.
  const storedCompleted = (body) => typeof body?.run_id === "string" && stored.get(body.run_id)?.status === "completed";
  const outcomeFor = (body) => {
    const current = stored.get(body.run_id);
    if (current && body.seq <= current.seq) return "ignored";
    stored.set(body.run_id, body);
    return "accepted";
  };

  /** Per run_id: payloads received and their validity, with the stored snapshot's seq and status. */
  const runs = () => {
    const out = {};
    for (const r of received) {
      if (typeof r.run_id !== "string") continue;
      const run = (out[r.run_id] ??= { received: 0, valid: 0, invalid: 0, lastSeq: null, lastStatus: null });
      run.received += 1;
      if (r.valid) run.valid += 1;
      else run.invalid += 1;
    }
    for (const [id, run] of Object.entries(out)) {
      const s = stored.get(id);
      run.lastSeq = s?.seq ?? null;
      run.lastStatus = s?.status ?? null;
    }
    return out;
  };

  const reply = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/summary") {
      const valid = received.filter((r) => r.valid).length;
      return reply(res, 200, { schema: schemaFile, received: received.length, valid, invalid: received.length - valid, runs: runs(), last: received.slice(-10) });
    }
    if (req.method !== "POST" || req.url !== ROUTE) return reply(res, 404, { error: "not found" });
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const at = new Date().toISOString();
      const buffer = Buffer.concat(chunks);
      const bytes = buffer.length; // the serialized size in bytes, as the contract measures it
      let body;
      let parsed = true;
      try {
        body = JSON.parse(buffer.toString("utf8"));
      } catch {
        parsed = false;
      }
      const tooLarge = bytes > MAX_SNAPSHOT_BYTES;
      if (!parsed && !tooLarge) {
        record({ at, bytes, valid: false, errors: ["not JSON"], outcome: "rejected" });
        return reply(res, 400, { outcome: "rejected", reason: "not json" });
      }
      // Size first (rule 2), and the schema only for a body within it.
      const valid = !tooLarge && validate(body) === true;
      const errors = tooLarge
        ? [`larger than 256 KiB serialized: ${bytes} bytes, limit ${MAX_SNAPSHOT_BYTES}`]
        : valid
          ? []
          : validate.errors.map((e) => `${e.instancePath || "/"} ${e.message}`);
      // Rule 1 before rule 2: a run stored completed ignores even an invalid or oversized snapshot.
      const outcome = storedCompleted(body) ? "ignored" : valid ? outcomeFor(body) : "rejected";
      const status = outcome !== "rejected" ? 200 : tooLarge ? 413 : 400;
      record({
        at,
        run_id: body?.run_id,
        seq: body?.seq,
        status: body?.status,
        platform: body?.context?.platform,
        onboarding: body?.onboarding?.key,
        entries: Array.isArray(body?.steps) ? body.steps.length : undefined,
        truncated: body?.truncated === true,
        bytes,
        valid,
        errors,
        outcome,
      });
      return reply(res, status, outcome === "rejected" ? { outcome, reason: errors.join("; ") } : { outcome });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, resolve);
  });
  return {
    url: `http://${HOST}:${server.address().port}${ROUTE}`,
    schemaFile,
    received,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const port = Number(arg("--port") ?? 4319);
  const logFile = path.resolve(arg("--log") ?? "studio-sdk-collector.jsonl");
  const c = await startCollector({
    port,
    logFile,
    log: (e) =>
      console.log(
        `${e.valid ? "VALID  " : "INVALID"} ${e.outcome.padEnd(8)} ${e.platform ?? "-"} ${e.onboarding ?? "-"} run=${e.run_id ?? "-"} seq=${e.seq ?? "-"} ${e.status ?? "-"} entries=${e.entries ?? "-"} bytes=${e.bytes}${e.truncated ? " TRUNCATED" : ""}${e.errors.length ? ` errors=${JSON.stringify(e.errors)}` : ""}`,
      ),
  });
  console.log(`studio-sdk mock collector on ${c.url}`);
  console.log(`  schema: ${c.schemaFile}`);
  console.log(`  log:    ${logFile}`);
}
