#!/usr/bin/env node
// Asserts that the in-repo agent definitions under `.claude/agents/` keep two
// contracts that nothing else would notice them breaking.
//
//   node scripts/check-agents.mjs              # scans .claude/agents/
//   node scripts/check-agents.mjs <dir>        # scans <dir>/*.md instead
//
// 1. NO INLINED BOARD ID. An agent that moves a card on the GitHub project reads
//    the project id, Status field id, project number and option ids from
//    onboarding-studio's `origin/main:.claude/board.json` at run time. Before
//    that, each agent carried its own copy of the old board's ids, so moving the
//    board meant hand-editing every copy, and a missed copy wrote Status to the
//    wrong project with no error. A board move must stay a one-file edit to
//    board.json, so an id written back inline into ANY agent fails here.
//
// 2. PR AUTHORITY POINTS ONE WAY. An agent with a `## PR authority` section is
//    told to take its own verified PR out of draft. A copied sentence elsewhere
//    in the same file saying "do not mark it ready" made the agent's behaviour
//    depend on which of two opposite instructions it weighted. Any file with
//    that section must never forbid marking its PR ready.
//
// Plus, for `rno-sdk.md` (this repo's SDK builder):
// - the shape of its `## Board status` block: fetch before reading board.json,
//   read all four ids from it, select the item by `$PN`, look the issue up in
//   this repo; and a table whose `Prioritized` row cannot also match a ticket
//   recommended for close (a close set to Prioritized is re-selected by every
//   board run);
// - step 7 opens a DRAFT and defers readiness to `## PR authority` (the third
//   block of the Studio test: a dropped `--draft` opens a ready PR before review,
//   and contract 2 cannot see it because nothing then forbids anything);
// - step 1 sets aside root CLAUDE.md's `## Native onboarding parity programme`
//   section WHOLESALE. That section also says builders may not take a PR out of
//   draft and should move cards on the legacy board, which is contract 2's
//   two-opposite-instructions failure from outside the agents directory.
//
// Both contracts are ported from onboarding-studio's `agentBoardIds.test.ts` and
// `parityAgentsPrAuthority.test.ts`, which could see the SDK builder only while
// it lived in that repo.
//
// WHAT THIS CANNOT SEE
//
// - board.json itself. It lives in onboarding-studio, which is private, so CI
//   here cannot read it. The Studio test collects the CURRENT board's option ids
//   from board.json; this script uses a generic rule instead (any standalone
//   8-hex token holding at least one digit, the shape of every single-select
//   option id). For the same reason it cannot check that each status in an
//   agent's table exists on the board.
// - A literal bound through a GraphQL variable (`-F p=5` into
//   `projectV2(number:$p)`) is indistinguishable from `-F n=448`.
// - `gh project view --web 5`: a boolean flag right before the number reads as
//   that flag's value. A number on a `\`-continued line is also missed.
//
// WHY A NODE SCRIPT AND NOT A VITEST FILE
//
// Same reason as `check-element-docs.mjs` and `check-pr-context.mjs`: the root of
// this monorepo has no test runner, and the agents are not part of either
// package. Node builtins only, so CI runs it before `npm ci`.
//
// The fixture assertions at the bottom run on every invocation, so a regex that
// stops matching what it exists to catch fails this script before any agent is
// scanned.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_DIR = process.argv[2]
  ? resolve(process.argv[2])
  : join(ROOT, ".claude/agents");

/** The agent whose file this repo owns and whose Board status block is pinned. */
const SDK_BUILDER = "rno-sdk.md";

// ---------------------------------------------------------------------------
// Contract 1: no inlined board id
// ---------------------------------------------------------------------------

// A literal project number is a violation in each form below:
// - jq `.project.number==N`, any spacing
// - GraphQL `projectV2(number:N)`
// - REST `projectsV2/N`
// - a hardcoded `PN=N`, the variable every Status template reads
// - `gh project <verb> ... N`, see ghProjectNumbers
//
// Matching the bare `PVT_` prefix would be wrong: every agent keeps a guard,
// `$PROJ == PVT_* && $SF == PVTSSF_*`, that holds the prefix as a glob. Only an
// id LITERAL (prefix plus a body) is a violation.
const RULES = [
  { re: /\bPVT(SSF|F)?_[A-Za-z0-9_-]{8,}/g, why: "board node id" },
  { re: /project\.number\s*==\s*\d+/g, why: "literal project number" },
  { re: /projectV2\(\s*number\s*:\s*\d+/g, why: "literal project number" },
  { re: /\bprojectsV2\/\d+/g, why: "literal project number" },
  { re: /\bPN=["']?\d+/g, why: "literal project number" },
  // Single-select option ids are 8 lowercase hex. Requiring a digit keeps
  // all-letter hex words ("deadbeef", "acceded") out. The guards keep out the
  // other 8-hex shapes: a word character on either side (a 40-char sha, a
  // `wf_48bf5783` run id), a `#` before (an RGBA colour, `#00000080`), or a `-`
  // on either side (a UUID's first segment, `550e8400-e29b-…`).
  { re: /(?<![#\w-])(?=[0-9a-f]*\d)[0-9a-f]{8}(?![\w-])/g, why: "single-select option id" },
];

// gh takes flags before or after the positional project number, so a regex on
// "verb then number" misses `item-list --owner Rocapine 5`. Tokenize the rest of
// the command instead: a bare integer is the project number unless the token
// before it is a flag taking it as a value (`--limit 200`, `-L 100`,
// `item-edit --number 3`). `--owner=X 5` is still caught, since that flag
// already holds its value.
function ghProjectNumbers(line) {
  const out = [];
  for (const m of line.matchAll(/\bgh project [a-z-]+/g)) {
    const rest = line
      .slice(m.index + m[0].length)
      .split(/[|;&)]/)[0]
      // Pair quotes left to right; a multi-word string is one opaque token.
      .replace(/"[^"]*"|'[^']*'/g, (q) => (/\s/.test(q) ? "_" : q));
    const tokens = rest.split(/\s+/).filter(Boolean);
    tokens.forEach((t, i) => {
      const prev = tokens[i - 1];
      const isFlagValue = prev !== undefined && /^--?[A-Za-z][\w-]*$/.test(prev);
      if (/^["']?\d+["']?$/.test(t) && !isFlagValue) out.push(t);
    });
  }
  return out;
}

/** @returns {{line: number, match: string, why: string}[]} */
export function findInlineBoardIds(text) {
  const out = [];
  text.split("\n").forEach((l, i) => {
    for (const { re, why } of RULES) {
      for (const m of l.matchAll(re)) out.push({ line: i + 1, match: m[0], why });
    }
    for (const n of ghProjectNumbers(l)) {
      out.push({ line: i + 1, match: n, why: "literal project number" });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Contract 2: a file with `## PR authority` never forbids marking ready
// ---------------------------------------------------------------------------

// Run on whitespace-collapsed text: the phrase wraps across lines in the source.
// "Out of draft" is the same act as "mark ready" in other words; the section's
// own instruction uses it.
const FORBIDS_READY =
  /\b(neither may|may not|must not|do not|don.t|never)\b[^.;]*?\b(mark\b[^.;]*?\bready|take\b[^.;]*?\bout of draft)\b/gi;

export function findReadyForbidden(text) {
  const flat = text.replace(/\s+/g, " ");
  if (!flat.includes("## PR authority")) return [];
  return [...flat.matchAll(FORBIDS_READY)].map((m) => m[0]);
}

// ---------------------------------------------------------------------------
// rno-sdk.md: the Board status block reads every id from board.json
// ---------------------------------------------------------------------------

/** A `## Heading` section, matched on the heading's leading words (`## PR authority — …`). */
function section(text, heading) {
  const m = new RegExp(`^${heading}\\b.*$`, "m").exec(text);
  if (m === null) return null;
  const start = m.index;
  const end = text.indexOf("\n## ", start + 1);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

/**
 * Step 7 opens a draft PR and defers readiness to `## PR authority`. Ported from
 * the `sdk-parity-dev step 7` block of onboarding-studio's
 * parityAgentsPrAuthority.test.ts, on whitespace-collapsed text like the original.
 * @returns {string[]}
 */
export function checkStep7(text) {
  const flat = text.replace(/\s+/g, " ");
  const start = flat.indexOf("### 7. Commit, PR, report");
  if (start === -1) return ["step 7 heading `### 7. Commit, PR, report` not found"];
  // The heading itself, not the backticked mention of it inside step 7.
  const rel = flat.slice(start).search(/(?<!`)## PR authority/);
  if (rel === -1) return ["no `## PR authority` heading after step 7"];
  const step = flat.slice(start, start + rel);
  const problems = [];
  if (!/gh pr create --draft --base main/.test(step)) {
    problems.push("step 7 does not open a draft (`gh pr create --draft --base main`)");
  }
  if (!/out of draft per `## PR authority`/.test(step)) {
    problems.push("step 7 does not defer readiness (`out of draft per ## PR authority`)");
  }
  return problems;
}

/**
 * Root CLAUDE.md's parity section is set aside as a whole, not item by item: it
 * also carries a readiness rule and a legacy-board card rule that contradict this
 * agent's own `## PR authority` and `## Board status`.
 * @returns {string[]}
 */
export function checkParityCarveOut(text) {
  const flat = text.replace(/\s+/g, " ");
  return /`## Native onboarding parity programme`[^]*?\bnone of (it|that section) applies to you\b/i.test(flat)
    ? []
    : ["step 1 does not set aside root CLAUDE.md's `## Native onboarding parity programme` section as a whole (`none of it applies to you`)"];
}

/**
 * The `Prioritized` row is for a narrowed scope only. A ticket recommended for
 * close must not also match it, or the card goes back to the selectable column.
 * @returns {string[]}
 */
export function checkStatusTable(board) {
  const rows = board
    .split("\n")
    .filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const prioritized = rows.filter(([, status]) => status === "`Prioritized`");
  const problems = [];
  if (prioritized.length !== 1) {
    problems.push(`Board status table has ${prioritized.length} \`Prioritized\` rows, want 1`);
  }
  for (const [when] of prioritized) {
    if (!/narrow/i.test(when) || /\b(wrong|does not exist|clos)/i.test(when)) {
      problems.push(`Board status \`Prioritized\` row must be for a narrowed scope only, and must not also match a close: "${when}"`);
    }
  }
  if (!rows.some(([when, status]) => /clos/i.test(when) && /leave Status alone/.test(status))) {
    problems.push("Board status table has no close row that leaves Status alone");
  }
  return problems;
}

/**
 * The `## PR authority` section still authorizes readiness, positively.
 * @returns {string[]}
 */
export function checkPrAuthority(text) {
  // Contract 2 only finds sentences that forbid; a section reworded to say
  // nothing, or the command deleted, would pass it. Pin the instruction and the
  // command inside the section. Phrase-pinned like checkStep7: it guards this
  // wording, not every wording with the same meaning.
  const auth = section(text, "## PR authority");
  if (auth === null) return []; // reported by checkSdkBuilder
  const problems = [];
  if (!/\*\*Take the PR out of draft yourself\*\*/.test(auth)) {
    problems.push("`## PR authority` does not say `**Take the PR out of draft yourself**`");
  }
  if (!/^gh pr ready\b/m.test(auth)) {
    problems.push("`## PR authority` does not carry the `gh pr ready` command");
  }
  return problems;
}

/** @returns {string[]} one message per broken expectation */
export function checkSdkBuilder(text) {
  const problems = [...checkStep7(text), ...checkParityCarveOut(text), ...checkPrAuthority(text)];
  if (!/^---\n(?:.*\n)*?name: rno-sdk\n(?:.*\n)*?---\n/.test(text)) {
    problems.push("frontmatter does not declare `name: rno-sdk`");
  }
  if (section(text, "## PR authority") === null) {
    problems.push(
      "no `## PR authority` section (renaming it would make the ready check pass vacuously)",
    );
  }
  const board = section(text, "## Board status");
  if (board === null) {
    problems.push("no `## Board status` section");
    return problems;
  }
  const must = [
    [/fetch -q origin main/, "does not fetch origin main before reading board.json"],
    [/show origin\/main:\.claude\/board\.json/, "does not read origin/main:.claude/board.json"],
    // Double quotes: single quotes would hand jq a literal `$PN` and fail the lookup.
    [/-q "[^"]*select\(\.project\.number==\$PN\)/, "does not select the item by $PN inside a double-quoted jq filter"],
    [/-F r=react-native-onboarding /, "does not look the issue up in react-native-onboarding"],
    [/Never set `Shipped`/, "does not say `Never set \\`Shipped\\``"],
  ];
  for (const [re, msg] of must) if (!re.test(board)) problems.push(`Board status ${msg}`);
  for (const key of [
    ".board.projectId",
    ".board.statusFieldId",
    ".board.projectNumber",
    ".board.statusOptions",
  ]) {
    if (!board.includes(key)) problems.push(`Board status does not read \`${key}\``);
  }
  if (/\|\s*`(In review|Shipped|Done)`\s*\|/.test(board)) {
    problems.push("Board status table sets In review, Shipped or Done");
  }
  problems.push(...checkStatusTable(board));
  return problems;
}

// ---------------------------------------------------------------------------
// Fixtures: the detectors still catch what they exist to catch
// ---------------------------------------------------------------------------

// Synthetic ids only. This repo is public, and a real id here would make a board
// move a two-repo edit.
const FIXTURES = [
  // [text, expected matches]
  ["if [[ $PN =~ ^[0-9]+$ && $PROJ == PVT_* && $SF == PVTSSF_* && -n $OPT && $OPT != null ]]; then", []],
  ['-q ".data.repository.issue.projectItems.nodes[] | select(.project.number==$PN) | .id")', []],
  ['PN=$(jq -r .board.projectNumber <<<"$BJ"); OPT=$(jq -r --arg s "$STATUS" \'.board.statusOptions[$s]\' <<<"$BJ")', []],
  ["organization(login:$o){projectV2(number:$pn){id}}", []],
  ["repository(owner:$o,name:$r){issue(number:$n){projectItems(first:10){nodes{id project{number}}}}}", []],
  ['gh project item-list "$PN" --owner Rocapine --limit 200', []],
  ['gh project item-list "$PN" --owner Rocapine -L 100', []],
  ["gh project item-edit --id $ITEM --field-id $F --project-id $PROJ --number 3", []],
  ["gh api orgs/Rocapine/projectsV2/$PN/items", []],
  ["run wf_48bf5783-6b3 made 63 calls; HEAD 130c790; sha 130c790a1b2c3d4e5f60718293a4b5c6d7e8f901", []],
  ["deadbeef and acceded are words, not ids", []],
  ['PROJ="PVT_kwSYNTHETICxx01"', ["PVT_kwSYNTHETICxx01"]],
  ["SF=PVTSSF_lSYNTHETICxx02\nF=PVTF_lSYNTHETICxx03", ["PVTSSF_lSYNTHETICxx02", "PVTF_lSYNTHETICxx03"]],
  ["select(.project.number==1)", ["project.number==1"]],
  ["select(.project.number == 5)", ["project.number == 5"]],
  ['organization(login:"Rocapine"){projectV2(number:5){id}}', ["projectV2(number:5"]],
  ["gh api orgs/Rocapine/projectsV2/5/items", ["projectsV2/5"]],
  ['PN="5"', ['PN="5']],
  ["export PN=1", ["PN=1"]],
  ["gh project item-list 5 --owner Rocapine", ["5"]],
  ["gh project item-list --owner Rocapine 5 --format json", ["5"]],
  ["gh project item-list --owner=Rocapine 5", ["5"]],
  ["-F v=1a2b3c4d", ["1a2b3c4d"]],
  ["OPT=9f8e7d6c", ["9f8e7d6c"]],
  ['"Prioritized": "47fc9ee4",', ["47fc9ee4"]],
  // An 8-digit RGBA colour and a UUID's first segment are 8 hex too.
  ['Use `backgroundColor: "#00000080"` for a 50% scrim', []],
  ["id 550e8400-e29b-41d4-a716-446655440000", []],
];

const READY_FIXTURES = [
  ["## PR authority\nTake it out of draft yourself.", []],
  ["## PR authority\nDo not merge it and do not bump a version.", []],
  ["## PR authority\nOpen a draft PR. Do not merge it and do not mark it\nready.", ["Do not merge it and do not mark it ready"]],
  ["## PR authority\nNeither may merge, mark a PR ready, or bump.", ["Neither may merge, mark a PR ready"]],
  ["## PR authority\nNever take the PR out of draft yourself.", ["Never take the PR out of draft"]],
  // A semicolon ends the forbidding clause: this is sdk-parity-dev's step 7.
  ["## PR authority\nDo not bump a version; take it out of draft per `## PR authority` below.", []],
  ["## PR authority\nDo not leave a verified PR sitting in draft.", []],
  // No PR authority section: the contract does not apply.
  ["Do not mark it ready.", []],
];

const STEP7_OK =
  "### 7. Commit, PR, report\nOpen a **draft** PR (`gh pr create --draft --base main`). Take it out of\ndraft per `## PR authority` below.\n\n## PR authority — ready yes\nTake it out of draft.";
const STEP7_FIXTURES = [
  // The backticked mention of `## PR authority` inside step 7 is not the heading.
  [STEP7_OK, []],
  [STEP7_OK.replace("--draft ", ""), ["step 7 does not open a draft (`gh pr create --draft --base main`)"]],
  [STEP7_OK.replace("out of\ndraft per `## PR authority`", "ready"), ["step 7 does not defer readiness (`out of draft per ## PR authority`)"]],
  [STEP7_OK.replace("\n## PR authority — ready yes", "\n## Authority"), ["no `## PR authority` heading after step 7"]],
];

const AUTH_OK =
  "## PR authority — ready yes\n**Take the PR out of draft yourself** once verified.\n\n```bash\ngh pr ready <number>\n```\n\n## Output format\ngh pr ready";
const AUTH_FIXTURES = [
  [AUTH_OK, 0],
  // The review's reproduction: the instruction inverted, the command deleted.
  [AUTH_OK.replace("**Take", "**Never take").replace("gh pr ready <number>\n", ""), 2],
  [AUTH_OK.replace("**Take", "**Never take"), 1],
  // The command outside the section does not count.
  [AUTH_OK.replace("gh pr ready <number>\n", ""), 1],
];

const TABLE_OK =
  "## Board status\n| When | Set Status to |\n|---|---|\n| Started | `In progress` |\n| The gap is real but narrower — you commented a narrowed scope and stopped | `Prioritized` |\n| Blocked | `Refining` |\n| The gap does not exist — you recommended closing it | leave Status alone |\n";
const TABLE_FIXTURES = [
  [TABLE_OK, 0],
  [TABLE_OK.replace("The gap is real but narrower", "The ticket was wrong or narrower"), 1],
  [TABLE_OK.replace("| The gap does not exist — you recommended closing it | leave Status alone |\n", ""), 1],
];

function runFixtures() {
  const failures = [];
  for (const [text, want] of FIXTURES) {
    const got = findInlineBoardIds(text).map((v) => v.match);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(`board-id fixture ${JSON.stringify(text)}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }
  const lines = findInlineBoardIds("ok\nok\nPROJ=PVT_kwSYNTHETICxx01").map((v) => v.line);
  if (JSON.stringify(lines) !== "[3]") failures.push(`board-id fixture line number: want [3], got ${JSON.stringify(lines)}`);
  for (const [text, want] of READY_FIXTURES) {
    const got = findReadyForbidden(text);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(`ready fixture ${JSON.stringify(text)}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }
  for (const [text, want] of STEP7_FIXTURES) {
    const got = checkStep7(text);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(`step-7 fixture ${JSON.stringify(text)}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }
  for (const [text, want] of TABLE_FIXTURES) {
    const got = checkStatusTable(text);
    if (got.length !== want) {
      failures.push(`status-table fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
    }
  }
  for (const [text, want] of AUTH_FIXTURES) {
    const got = checkPrAuthority(text);
    if (got.length !== want) failures.push(`pr-authority fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
  }
  const carve = [
    ["Root `CLAUDE.md` carries a `## Native onboarding parity programme` section. None of it applies to you.", 0],
    ["Root `CLAUDE.md` carries a `## Native onboarding parity programme` section. Its verdict file does not apply to you; the rest does.", 1],
  ];
  for (const [text, want] of carve) {
    const got = checkParityCarveOut(text);
    if (got.length !== want) failures.push(`carve-out fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const fixtureFailures = runFixtures();
  if (fixtureFailures.length) {
    console.error("check-agents: the detectors themselves are broken:\n" + fixtureFailures.join("\n"));
    process.exit(1);
  }

  const rel = relative(process.cwd(), AGENTS_DIR);
  const shown = rel === "" ? "." : rel.startsWith("..") ? AGENTS_DIR : rel;
  const files = existsSync(AGENTS_DIR)
    ? readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md")).sort()
    : [];
  const errors = [];
  if (!files.includes(SDK_BUILDER)) {
    errors.push(`${shown}/${SDK_BUILDER}: missing — the SDK builder must be versioned in this repo`);
  }

  for (const file of files) {
    const text = readFileSync(join(AGENTS_DIR, file), "utf8");
    for (const v of findInlineBoardIds(text)) {
      errors.push(`${shown}/${file}:${v.line}: ${v.why} \`${v.match}\` — read it from onboarding-studio's .claude/board.json at run time instead`);
    }
    for (const hit of findReadyForbidden(text)) {
      errors.push(`${shown}/${file}: has \`## PR authority\` but forbids marking its PR ready: "${hit}"`);
    }
    if (file === SDK_BUILDER) {
      for (const p of checkSdkBuilder(text)) errors.push(`${shown}/${file}: ${p}`);
    }
  }

  if (errors.length) {
    console.error(`check-agents: ${errors.length} problem(s)\n` + errors.join("\n"));
    process.exit(1);
  }
  console.log(`check-agents: ${files.length} agent file(s) in ${shown} clean (${FIXTURES.length + READY_FIXTURES.length + STEP7_FIXTURES.length + TABLE_FIXTURES.length + AUTH_FIXTURES.length + 3} fixtures pass)`);
}

main();
