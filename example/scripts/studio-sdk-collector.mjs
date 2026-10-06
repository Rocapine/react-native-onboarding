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

  // The contract's acceptance rules, reduced to what the check needs: a
  // completed run is final, and a snapshot replaces the stored one only with a
  // higher seq.
  const outcomeFor = (body) => {
    const current = stored.get(body.run_id);
    if (current?.status === "completed") return "ignored";
    if (current && body.seq <= current.seq) return "ignored";
    stored.set(body.run_id, body);
    return "accepted";
  };

  const reply = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/summary") {
      const valid = received.filter((r) => r.valid).length;
      return reply(res, 200, { schema: schemaFile, received: received.length, valid, invalid: received.length - valid, last: received.slice(-10) });
    }
    if (req.method !== "POST" || req.url !== ROUTE) return reply(res, 404, { error: "not found" });
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const at = new Date().toISOString();
      const bytes = Buffer.byteLength(raw, "utf8");
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        record({ at, bytes, valid: false, errors: ["not JSON"], outcome: "rejected" });
        return reply(res, 400, { outcome: "rejected", reason: "not json" });
      }
      const valid = validate(body) === true;
      const errors = valid ? [] : validate.errors.map((e) => `${e.instancePath || "/"} ${e.message}`);
      const outcome = valid ? outcomeFor(body) : "rejected";
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
      return reply(res, outcome === "rejected" ? 400 : 200, valid ? { outcome } : { outcome, reason: errors.join("; ") });
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
