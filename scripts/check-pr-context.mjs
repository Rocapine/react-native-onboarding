#!/usr/bin/env node
// Asserts that `scripts/pr-context.sh` still collapses the round trips it exists
// to collapse.
//
//   node scripts/check-pr-context.mjs
//
// WHY THE CALL COUNT IS THE INVARIANT
//
// The script exists because review and fix agents each re-fetch the same
// unchanged PR: run wf_48bf5783-6b3 made 63 GitHub read calls for PR context —
// `gh pr view` ×19, `git diff <base>` ×18, `git show pr263:<file>` ×15,
// `gh pr diff` ×7, `gh run list` ×4 — and each one re-sends the agent's whole
// context as cache reads, so collapsing them is a cost lever and not only a
// latency one.
//
// A version of the script that quietly makes five calls per PR hands that saving
// straight back, and nothing else would notice: the OUTPUT would be identical.
// So what is asserted here is how many times it called `gh`, not only what it
// printed.
//
// WHY A NODE SCRIPT AND NOT A VITEST FILE
//
// Same reason `check-element-docs.mjs` is one: the root of this monorepo has no
// test runner, and a check that needs a toolchain is a check that gets skipped.
// The thing under test is a shell script, so there is no seam to inject either —
// a stub `gh` first on PATH is the only way to observe what it invoked.

import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/pr-context.sh");

const BODY =
  "Closes #263\\n\\nSee also refs #191 and Fixes #263 again.\\nA bare #999 is not a link.";

const VIEW = JSON.stringify({
  number: 263,
  title: "a title",
  state: "OPEN",
  isDraft: true,
  author: { login: "someone" },
  baseRefName: "main",
  headRefName: "topic",
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  url: "https://example.invalid/pull/263",
  body: BODY,
  files: [{ path: "scripts/x.sh", additions: 1, deletions: 0 }],
  statusCheckRollup: [{ name: "build", conclusion: "SUCCESS" }],
});

/**
 * Runs the script against a stub `gh` placed first on PATH, and returns both its
 * output and the argv of every `gh` call it made.
 */
function run(args) {
  const dir = mkdtempSync(join(tmpdir(), "pr-context-"));
  const log = join(dir, "calls.log");
  writeFileSync(
    join(dir, "gh"),
    [
      "#!/usr/bin/env bash",
      // One log line per call. `"$*"` verbatim would split a call across lines
      // whenever an argument contains a newline — `--jq` filters do — and every
      // continuation line would then read as another call.
      'argv="$*"',
      `printf '%s\\n' "\${argv//$'\\n'/ }" >> ${JSON.stringify(log)}`,
      'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
      `  cat <<'JSON'\n${VIEW}\nJSON`,
      'elif [ "$1" = "pr" ] && [ "$2" = "diff" ]; then',
      '  echo "a diff"',
      'elif [ "$1" = "issue" ] && [ "$2" = "view" ]; then',
      '  echo "an issue"',
      "fi",
      "exit 0",
    ].join("\n"),
  );
  chmodSync(join(dir, "gh"), 0o755);

  const stdout = execFileSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
  let calls = [];
  try {
    calls = readFileSync(log, "utf8")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.split(" "));
  } catch {
    calls = [];
  }
  return { stdout, calls };
}

/* ── checks ──────────────────────────────────────────────────────────── */

let failures = 0;
function pass(label) {
  console.log(`PASS  ${label}`);
}
function fail(label, detail) {
  failures++;
  console.log(`*** FAIL  ${label}`);
  for (const d of [].concat(detail)) console.log(`          ${d}`);
}
function check(label, fn) {
  try {
    const detail = fn();
    detail ? fail(label, detail) : pass(label);
  } catch (e) {
    fail(label, [e.message.split("\n")[0]]);
  }
}

check("reads the PR once, and gets checks and files from that same call", () => {
  // `gh pr checks` and `gh pr diff --name-only` would be two more round trips
  // for data `gh pr view --json` already returns.
  const { calls } = run(["263", "--no-diff"]);
  const views = calls.filter((argv) => argv[0] === "pr" && argv[1] === "view");
  if (views.length !== 1) return [`made ${views.length} \`gh pr view\` calls, expected 1`];
  if (calls.some((argv) => argv[1] === "checks")) return ["called `gh pr checks` separately"];
  return null;
});

check("still prints the checks and the file list", () => {
  // Collapsing the calls is only a saving if the data still arrives.
  const { stdout } = run(["263", "--no-diff"]);
  const missing = ["build\tSUCCESS", "scripts/x.sh", "MERGEABLE / CLEAN"].filter(
    (s) => !stdout.includes(s),
  );
  return missing.length ? missing.map((s) => `output is missing ${JSON.stringify(s)}`) : null;
});

check("fetches each linked ticket once, and only on a closing keyword", () => {
  // The body names #263 twice, #191 once behind `refs`, and #999 bare. Bare
  // numbers are as often run ids or quoted log lines as tickets, and fetching
  // them puts the round trips straight back.
  const { calls } = run(["263", "--no-diff"]);
  const issues = calls
    .filter((argv) => argv[0] === "issue" && argv[1] === "view")
    .map((argv) => argv[2]);
  const want = ["263", "191"];
  return issues.join(",") === want.join(",")
    ? null
    : [`fetched [${issues.join(", ")}], expected [${want.join(", ")}]`];
});

check("makes no diff call when asked not to", () => {
  const { calls } = run(["263", "--no-diff"]);
  return calls.some((argv) => argv[1] === "diff") ? ["called `gh pr diff` under --no-diff"] : null;
});

check("makes exactly one diff call otherwise", () => {
  const { calls, stdout } = run(["263"]);
  const diffs = calls.filter((argv) => argv[1] === "diff");
  if (diffs.length !== 1) return [`made ${diffs.length} diff calls, expected 1`];
  return stdout.includes("a diff") ? null : ["the diff never reached the output"];
});

check("passes --repo through to every call it makes", () => {
  // A board spanning two repos otherwise half-resolves against whichever repo
  // the agent's cwd happens to be.
  const { calls } = run(["263", "--repo", "o/r"]);
  const loose = calls.filter((argv) => !argv.join(" ").includes("--repo o/r"));
  return loose.length ? [`${loose.length} call(s) went out without --repo`] : null;
});

check("survives an empty --repo array on bash 3.2 semantics", () => {
  // `"${GH[@]}"` on an empty array is an unbound variable under `set -u` in the
  // bash macOS ships. CI's bash 5 does not reproduce it, so the script would die
  // only on developer machines.
  const { stdout } = run(["263", "--no-diff"]);
  return stdout.includes("=== PR 263 ===") ? null : ["the script produced no header"];
});

console.log("");
if (failures) {
  console.log(`*** ${failures} check(s) failed.`);
  console.log("scripts/pr-context.sh exists to make ONE round trip per PR —");
  console.log("fix the script, not this check, unless the contract itself changed.");
  process.exit(1);
}
console.log("pr-context.sh still collapses a PR's context into one round trip.");
