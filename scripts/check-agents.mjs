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
// - step 3 creates its first-build worktree (`-b <branch> origin/main`) in a
//   NAMED checkout whose remote it checks, and carries a fix-round clause (reuse
//   the worktree and branch the prompt names), so a Studio-launched or fix-round
//   dispatch cannot branch the wrong repo or abandon the PR branch (RNO#295); its
//   no-worktree fallback checks the checkout's remote, refuses the user's own
//   checkout, stops when its `worktree add` fails, checks `$WT` is on `$BR`
//   after the add (else `git -C "$WT"` walks up to the user's checkout), and
//   fast-forwards to the PR head (`merge --ff-only "origin/$BR"`);
// - step 7 opens a DRAFT and defers readiness to `## PR authority` (the third
//   block of the Studio test: a dropped `--draft` opens a ready PR before review,
//   and contract 2 cannot see it because nothing then forbids anything).
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
 * Root `npm run type:check` runs every workspace, `example` included, and
 * `example` already fails on a clean tree. Step 4 must say so, and say to compare
 * against origin/main, or a builder reads that red as its own regression.
 * @returns {string[]}
 */
export function checkStep4(text) {
  const flat = text.replace(/\s+/g, " ");
  const start = flat.indexOf("### 4. Test first, strictly");
  if (start === -1) return ["step 4 heading `### 4. Test first, strictly` not found"];
  const end = flat.indexOf("### 5.", start);
  const step = flat.slice(start, end === -1 ? undefined : end);
  if (!/npm run type:check(?! ?--workspace)/.test(step)) return [];
  return /\bexample\b[^]*?\bfails\b[^]*?\borigin\/main\b/.test(step)
    ? []
    : ["step 4 runs root `npm run type:check` without saying `example` already fails and to compare against origin/main"];
}

/**
 * Step 3 names the react-native-onboarding checkout and carries a fix-round
 * clause (RNO#295). Without the checkout, a builder dispatched from a Studio
 * session branches onboarding-studio and nothing errors until `npm ci`. Without
 * the clause, step 3's "branch fresh from origin/main" contradicts board-run's
 * fix-round prompt ("Work in the EXISTING worktree ... on the existing branch"),
 * and the builder either fails on `-b <existing-branch>` or abandons the PR
 * branch. Phrase-pinned like checkStep7.
 * @returns {string[]}
 */
export function checkStep3(text) {
  const flat = text.replace(/\s+/g, " ");
  const start = flat.indexOf("### 3. Worktree and branch");
  if (start === -1) return ["step 3 heading `### 3. Worktree and branch` not found"];
  const end = flat.indexOf("### 4.", start);
  const step = flat.slice(start, end === -1 ? undefined : end);
  const problems = [];
  if (!/\bin a fix round\b[^.]*\bworktree path the prompt names\b[^.]*\bexisting branch\b/i.test(step)) {
    problems.push("step 3 has no fix-round clause (`In a fix round, work in the worktree path the prompt names, on its existing branch`)");
  }
  if (!/git -C "\$RNO" remote get-url origin/.test(step)) {
    problems.push('step 3 does not check the checkout\'s remote (`git -C "$RNO" remote get-url origin`)');
  }
  // Anchored on the first build's own tokens (`-b <branch> origin/main`): the
  // no-worktree fix-round fallback also runs `git -C "$RNO" worktree add`, on an
  // existing branch, and must not stand in for this line (RNO#306 review r0-3).
  if (!/git -C "\$RNO" worktree add \S+ -b \S+ origin\/main/.test(step)) {
    problems.push('step 3 does not create the first-build worktree in the named checkout (`git -C "$RNO" worktree add <path> -b <branch> origin/main`)');
  }
  // The fallback must refuse when the user's own checkout is on the PR branch:
  // `git worktree list` prints that checkout first, so a branch match picks it.
  // `$RNO`-qualified because the named-worktree block checks `$WT`'s branch.
  if (!/git -C "\$RNO" branch --show-current/.test(step)) {
    problems.push('step 3 does not refuse a fix round on the user\'s own checkout (`git -C "$RNO" branch --show-current`)');
  }
  // A local branch can outlive its worktree and fall behind origin's PR head.
  if (!/merge --ff-only "origin\/\$BR"/.test(step)) {
    problems.push('step 3 does not fast-forward the fix-round worktree to the PR head (`merge --ff-only "origin/$BR"`)');
  }
  problems.push(...checkStep3Fallback(step));
  return problems;
}

/**
 * The no-worktree fix-round fallback (RNO#306 review r1-1/r1-2). When its
 * `worktree add` fails (the path already exists), `git -C "$WT"` walks up to the
 * user's own checkout and the fast-forward moves that checkout's branch. So the
 * add must stop on failure, and `$WT`'s branch must be checked AFTER the add:
 * the named-worktree block's identical check sits earlier in the text and must
 * not stand in for it. The fallback also runs in its own Bash call, so it needs
 * its own remote check, after the first build's.
 * @param {string} step step 3, whitespace-flattened
 * @returns {string[]}
 */
function checkStep3Fallback(step) {
  const add = 'worktree add "$WT" "$BR"';
  const at = step.indexOf(add);
  if (at === -1) return ['step 3 has no no-worktree fix-round fallback (`worktree add "$WT" "$BR"`)'];
  const problems = [];
  if (!/^ \|\| /.test(step.slice(at + add.length))) {
    problems.push('step 3\'s fix-round fallback does not stop when `worktree add "$WT" "$BR"` fails (`|| { ...; exit 1; }`)');
  }
  if (!/git -C "\$WT" branch --show-current\)" = "\$BR"/.test(step.slice(at))) {
    problems.push('step 3\'s fix-round fallback does not check `$WT` is on `$BR` after adding it (`git -C "$WT" branch --show-current)" = "$BR"`)');
  }
  const firstBuild = step.search(/worktree add \S+ -b \S+ origin\/main/);
  // `-C "$RNO"` or bare, never `-C "$WT"`: the named block's remote check sits
  // between the first build and the fallback, and checks a different tree.
  if (!/git (-C "\$RNO" )?remote get-url origin/.test(step.slice(firstBuild === -1 ? 0 : firstBuild, at))) {
    problems.push("step 3's fix-round fallback does not check the checkout's remote before adding a worktree (`remote get-url origin`)");
  }
  return problems;
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

/**
 * Under board-run the builder pushes and returns (roca-helm#21): Verify reads CI
 * by head SHA on every round and the Ship stage does the ready-up, so a builder
 * that waits for green CI first polls a run Verify polls again. `## PR authority`
 * must carve that case out before its hand-dispatch rule. And `gh pr ready` runs
 * alone (roca-helm#25): auto mode refuses a compound write whole, so a ready
 * chained to another write never happens. A backtick ends an inline command.
 * @returns {string[]}
 */
export function checkBoardRunReturn(text) {
  const problems = [];
  const auth = section(text, "## PR authority");
  if (auth !== null) {
    const flat = auth.replace(/\s+/g, " ");
    if (!/\bboard-run\b[^.]*\bpush and return\b/i.test(flat)) {
      problems.push("`## PR authority` does not say that under board-run you push and return");
    }
    if (!/\bVerify reads CI\b[^.]*\bhead SHA\b/.test(flat)) {
      problems.push("`## PR authority` does not say Verify reads CI by head SHA");
    }
  }
  text.split("\n").forEach((l, i) => {
    if (/gh pr ready[^`\n]*(&&|;|\|)/.test(l)) {
      problems.push(`line ${i + 1}: \`gh pr ready\` chained to another command`);
    }
  });
  return problems;
}

/**
 * The `projectItems` lookup's failure is not the issue's absence (#296). A
 * failed `gh api graphql` (no `read:project` scope, a rate limit, a transient
 * error) exits non-zero, and it can still print the error body to stdout, so
 * `ITEM` is neither reliably empty nor reliably an id. The block must branch on
 * the lookup's exit status, say `projectItems lookup failed` on failure, and
 * print "not on project" in, and only in, the success branch. The prose under the
 * block must name the failure case too, or it tells the agent to report every
 * "Status NOT written" as a missing card. The `if` must test the substitution
 * itself, with no `|| true` defeating it, and the Status write's own failure must
 * print a line of its own, or a write that never landed prints nothing at all.
 * @returns {string[]}
 */
export function checkLookupFailure(board) {
  const problems = [];
  const guard = board.search(/\bif ITEM=\$\(gh api graphql /);
  const absent = board.search(/is not on project #\$PN: Status NOT written/);
  const failed = board.search(/echo "projectItems lookup failed: Status NOT written"/);
  const failedWrite = board.search(/\|\| echo "updateProjectV2ItemFieldValue failed: Status NOT written"/);
  if (guard === -1) {
    problems.push("Board status does not branch on the projectItems lookup's exit status (`if ITEM=$(gh api graphql …); then`)");
  } else {
    // The `if` must test the substitution itself (review r1-4). `… ) || true; then`,
    // `… || true); then` or `…); true; then` all make it always succeed.
    const cond = board.slice(guard).match(/^[^]*?;\s*then\b/);
    if (!cond || cond[0].includes("||") || !/"\);\s*then$/.test(cond[0])) {
      problems.push("Board status's `if ITEM=$(…)` does not end `\"); then` with no `||`, so it no longer tests the lookup's exit status");
    }
  }
  if (failedWrite === -1 || (guard !== -1 && failedWrite < guard)) {
    problems.push("Board status's updateProjectV2ItemFieldValue call prints no `updateProjectV2ItemFieldValue failed: Status NOT written` line when the write fails");
  }
  if (failed === -1) {
    problems.push("Board status does not print `projectItems lookup failed: Status NOT written` when the lookup fails");
  }
  if (absent === -1) {
    problems.push("Board status never prints `is not on project #$PN: Status NOT written`, so a card missing from the board goes unreported");
  } else if (guard !== -1 && failed !== -1 && !(guard < absent && absent < failed)) {
    problems.push("Board status prints \"not on project\" outside the lookup's success branch");
  }
  const prose = board.replace(/```[^]*?```/g, "");
  if (!/lookup failed/.test(prose)) {
    problems.push("Board status prose does not tell a failed lookup apart from an issue missing from the board");
  }
  if (!/updateProjectV2ItemFieldValue failed/.test(prose)) {
    problems.push("Board status prose does not say what a failed Status write prints, so its absence can read as success");
  }
  return problems;
}

/** @returns {string[]} one message per broken expectation */
export function checkSdkBuilder(text) {
  const problems = [...checkStep3(text), ...checkStep7(text), ...checkPrAuthority(text), ...checkStep4(text), ...checkBoardRunReturn(text)];
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
    // A checkout whose fetch fails (offline git, expired credentials, a sandbox)
    // must still fall back to GitHub, not only a missing checkout.
    [/\[ -n "\$BJ" \] \|\| BJ=\$\(gh api /, "does not fall back to `gh api` whenever BJ is empty"],
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
  problems.push(...checkLookupFailure(board));
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

const STEP3_FIRST_BUILD = 'git -C "$RNO" worktree add "$RNO/.claude/worktrees/x" -b chore/1-x origin/main\n';
const STEP3_MAIN_GUARD = '[ "$(git -C "$RNO" branch --show-current)" != "$BR" ] || exit 1\n';
const STEP3_FF = 'git -C "$WT" merge --ff-only "origin/$BR"\n';
const STEP3_CLAUSE = "**In a fix round**, work in the worktree path the prompt names, on its existing\nbranch.\n";
const STEP3_REMOTE = 'git -C "$RNO" remote get-url origin\n';
const STEP3_WT_GUARD = '[ "$(git -C "$WT" branch --show-current)" = "$BR" ] || exit 1\n';
const STEP3_FALLBACK_ADD = 'git -C "$RNO" worktree add "$WT" "$BR" || exit 1\n';
const STEP3_OK =
  "### 3. Worktree and branch\n" + STEP3_CLAUSE +
  "```bash\n" + STEP3_REMOTE + STEP3_FIRST_BUILD + "```\n" +
  "Named worktree:\n```bash\n" + 'git -C "$WT" remote get-url origin\n' + STEP3_WT_GUARD + "```\n" +
  "If the fix prompt names no worktree:\n```bash\n" + STEP3_REMOTE + STEP3_MAIN_GUARD +
  STEP3_FALLBACK_ADD + STEP3_WT_GUARD + STEP3_FF + "```\n### 4. Test first, strictly\n";
const STEP3_FIXTURES = [
  [STEP3_OK, 0],
  // The clause deleted: the procedure again contradicts board-run's fix prompt.
  [STEP3_OK.replace(STEP3_CLAUSE, ""), 1],
  // A fix round mentioned, but not that it keeps the existing branch.
  [STEP3_OK.replace("on its existing\nbranch", "on a fresh branch"), 1],
  // Relative to cwd again everywhere: no remote check, no named first-build
  // checkout, no guard on the user's checkout.
  [STEP3_OK.replace(/git -C "\$RNO" /g, "git "), 3],
  // RNO#306 review r0-3: ONLY the first-build line reverted to cwd-relative. The
  // fallback's own `git -C "$RNO" worktree add` must not stand in for it.
  [STEP3_OK.replace(STEP3_FIRST_BUILD, "git worktree add .claude/worktrees/x -b chore/1-x origin/main\n"), 1],
  // r0-1/r0-4: the fallback no longer refuses when the user's checkout is on the
  // PR branch, so `worktree list` would hand back $RNO itself.
  [STEP3_OK.replace(STEP3_MAIN_GUARD, ""), 1],
  // r0-2: no fast-forward to origin, so a stale local branch is edited.
  [STEP3_OK.replace(STEP3_FF, ""), 1],
  // The clause after step 4 is not step 3's.
  [STEP3_OK.replace(STEP3_CLAUSE, "") + STEP3_CLAUSE, 1],
  // RNO#306 review r1-1/r1-2: the fallback's `worktree add` failing (path
  // already exists) no longer stops the block, so the fast-forward walks up to
  // the user's checkout and moves its branch.
  [STEP3_OK.replace(STEP3_FALLBACK_ADD, 'git -C "$RNO" worktree add "$WT" "$BR"\n'), 1],
  // r1-1/r1-2: the fallback's own `$WT` branch check deleted. The named block's
  // identical check, earlier in the text, must not stand in for it.
  [STEP3_OK.replace(STEP3_FALLBACK_ADD + STEP3_WT_GUARD, STEP3_FALLBACK_ADD), 1],
  // fixer-1: the fallback runs in its own Bash call and no longer checks the
  // checkout's remote; the first build's check does not stand in for it.
  [STEP3_OK.replace("names no worktree:\n```bash\n" + STEP3_REMOTE, "names no worktree:\n```bash\n"), 1],
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

const RETURN_OK =
  "## PR authority — ready yes\n**Under board-run, push and return.** Verify reads CI by the pushed head\nSHA, and the Ship stage does the ready-up.\n\n```bash\ngh pr ready <number>\n```\n\n## Output format\n";
const RETURN_FIXTURES = [
  [RETURN_OK, 0],
  [RETURN_OK.replace("push and return", "wait for CI"), 1],
  [RETURN_OK.replace("Verify reads CI by the pushed head\nSHA", "Verify checks it"), 1],
  // No section: checkSdkBuilder reports that; this check stays quiet.
  ["no section here", 0],
  ['## PR authority\nboard-run: push and return. Verify reads CI by head SHA.\n```bash\ngh pr ready 12 && gh pr comment 12 --body-file b.md\n```', 1],
  ["Run `gh pr ready 12` alone, then `gh pr comment 12 --body-file b.md`; never both in one call.", 0],
  ["gh pr ready 12; gh pr edit 12 --body x", 1],
];

const TABLE_OK =
  "## Board status\n| When | Set Status to |\n|---|---|\n| Started | `In progress` |\n| The gap is real but narrower — you commented a narrowed scope and stopped | `Prioritized` |\n| Blocked | `Refining` |\n| The gap does not exist — you recommended closing it | leave Status alone |\n";
const TABLE_FIXTURES = [
  [TABLE_OK, 0],
  [TABLE_OK.replace("The gap is real but narrower", "The ticket was wrong or narrower"), 1],
  [TABLE_OK.replace("| The gap does not exist — you recommended closing it | leave Status alone |\n", ""), 1],
];

const LOOKUP_OK = [
  "## Board status",
  "```bash",
  "  if ITEM=$(gh api graphql -f query='…' \\",
  '    -q "… | select(.project.number==$PN) | .id"); then',
  '    if [ -n "$ITEM" ]; then',
  "      gh api graphql -f query='mutation…' \\",
  '        || echo "updateProjectV2ItemFieldValue failed: Status NOT written" >&2',
  '    else echo "#<ISSUE> is not on project #$PN: Status NOT written"; fi',
  '  else echo "projectItems lookup failed: Status NOT written" >&2; fi',
  "```",
  "",
  "`not on project` means the lookup succeeded; `projectItems lookup failed` means it did not.",
  "`updateProjectV2ItemFieldValue failed` means the card was found and the write did not land.",
  "",
].join("\n");
// The pre-#296 block: an unguarded assignment, so a failed lookup reads as absent.
const LOOKUP_UNGUARDED = [
  "## Board status",
  "```bash",
  "  ITEM=$(gh api graphql -f query='…' \\",
  '    -q "… | select(.project.number==$PN) | .id")',
  '  if [ -n "$ITEM" ]; then',
  "    gh api graphql -f query='mutation…'",
  '  else echo "#<ISSUE> is not on project #$PN: Status NOT written"; fi',
  "```",
  "",
  "If `ITEM` comes back empty the issue is not on this board.",
  "",
].join("\n");
const LOOKUP_FIXTURES = [
  [LOOKUP_OK, 0],
  // No exit-status branch, no failure line for the lookup or the write, and prose
  // that names neither.
  [LOOKUP_UNGUARDED, 5],
  // Guarded, but the failure branch still says "not on project".
  [LOOKUP_OK.replace('echo "projectItems lookup failed: Status NOT written"', 'echo "#<ISSUE> is not on project #$PN: Status NOT written"'), 1],
  // "not on project" moved into the failure branch, after it.
  [
    LOOKUP_OK.replace('    else echo "#<ISSUE> is not on project #$PN: Status NOT written"; fi\n', "    fi\n").replace(
      ">&2; fi",
      '>&2; echo "#<ISSUE> is not on project #$PN: Status NOT written"; fi',
    ),
    1,
  ],
  // The "not on project" echo deleted outright: a card missing from the board is
  // then never reported, though the lookup succeeded (review r0-1).
  [LOOKUP_OK.replace('    else echo "#<ISSUE> is not on project #$PN: Status NOT written"; fi\n', "    fi\n"), 1],
  // The bash is right but the prose still equates empty with absent.
  [LOOKUP_OK.replace("`not on project` means the lookup succeeded; `projectItems lookup failed` means it did not.", "If `ITEM` comes back empty the issue is not on this board."), 1],
  // The exit-status branch defeated (review r1-4): each of these makes the `if`
  // always succeed, so a failed lookup reads as "not on project" again and an
  // error body on stdout reaches the mutation as the item id.
  [LOOKUP_OK.replace('.id"); then', '.id") || true; then'), 1],
  [LOOKUP_OK.replace('.id"); then', '.id" || true); then'), 1],
  [LOOKUP_OK.replace('.id"); then', '.id"); true; then'), 1],
  // The Status write's own failure prints no "Status NOT written" line (review r1-1).
  [LOOKUP_OK.replace(" \\\n        || echo \"updateProjectV2ItemFieldValue failed: Status NOT written\" >&2", ""), 1],
  // The bash prints it, but the prose does not say what it means (review r1-1).
  [LOOKUP_OK.replace("`updateProjectV2ItemFieldValue failed` means the card was found and the write did not land.\n", ""), 1],
];

function runFixtures() {
  const failures = [];
  for (const [text, want] of LOOKUP_FIXTURES) {
    const got = checkLookupFailure(text);
    if (got.length !== want) failures.push(`lookup-failure fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
  }
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
  for (const [text, want] of STEP3_FIXTURES) {
    const got = checkStep3(text);
    if (got.length !== want) failures.push(`step-3 fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
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
  for (const [text, want] of RETURN_FIXTURES) {
    const got = checkBoardRunReturn(text);
    if (got.length !== want) failures.push(`board-run-return fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
  }
  const step4 = [
    ["### 4. Test first, strictly\n```bash\nnpm run type:check   # both workspaces\n```\n### 5. Next", 1],
    ["### 4. Test first, strictly\n```bash\nnpm run type:check   # all three workspaces\n```\n`example` already fails on a clean tree; diff your errors against origin/main.\n### 5. Next", 0],
    ["### 4. Test first, strictly\n```bash\nnpm run type:check --workspace=packages/onboarding\n```\n### 5. Next", 0],
  ];
  for (const [text, want] of step4) {
    const got = checkStep4(text);
    if (got.length !== want) failures.push(`step-4 fixture ${JSON.stringify(text)}: want ${want} problem(s), got ${JSON.stringify(got)}`);
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
  console.log(`check-agents: ${files.length} agent file(s) in ${shown} clean (${FIXTURES.length + READY_FIXTURES.length + STEP3_FIXTURES.length + STEP7_FIXTURES.length + TABLE_FIXTURES.length + AUTH_FIXTURES.length + RETURN_FIXTURES.length + LOOKUP_FIXTURES.length + 4} fixtures pass)`);
}

main();
