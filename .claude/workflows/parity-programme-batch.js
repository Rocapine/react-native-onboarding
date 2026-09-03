/**
 * parity-programme-batch — drain the native-onboarding parity backlog, a batch at a time.
 *
 *   Workflow({name: 'parity-programme-batch'})                          // next 2 ready tickets, full run
 *   Workflow({name: 'parity-programme-batch', args: {batchSize: 4}})    // next 4
 *   Workflow({name: 'parity-programme-batch', args: {mode: 'triage-only', batchSize: 8}})
 *   Workflow({name: 'parity-programme-batch', args: {tickets: [
 *     {issue: 231, repo: 'Rocapine/react-native-onboarding', agentType: 'sdk-parity-dev',
 *      title: '...', priority: 'prio:P1', labels: ['parity-gap','need:B']}
 *   ]}})                                                                 // skip selection
 *
 * Modes:
 *   'full'        (default) Select -> Triage -> Build -> Review
 *   'triage-only'           Select -> Triage. Cheap. Use it to find out how much of the
 *                           backlog is real before committing anyone to building it —
 *                           the original audit overstated a third of its own findings.
 *
 * The dedicated agents own their own board-status transitions (In progress / In review /
 * Ready / Backlog on org project #1), so this script deliberately does not write Status.
 */

export const meta = {
  name: 'parity-programme-batch',
  description: 'Pick the next ready parity tickets off the board, triage each against the re-audit verdict, build the survivors test-first in isolated worktrees, then review each PR',
  whenToUse: 'Draining the native-onboarding parity backlog (142 board items across react-native-onboarding and onboarding-studio). Re-run per batch; pass {mode:"triage-only"} to audit ticket validity without building.',
  phases: [
    { title: 'Select', detail: 'query both repos for the next unblocked parity tickets' },
    { title: 'Triage', detail: 'reconcile each ticket against the verdict file and the real code' },
    { title: 'Build', detail: 'implement survivors test-first via the repo-dedicated agent' },
    { title: 'Review', detail: 'confidence-scored review of each resulting PR' },
  ],
}

const BATCH = (args && args.batchSize) || 2
const MODE = (args && args.mode) || 'full'
const GIVEN = (args && args.tickets) || null

const PROGRAMME = `
## The parity programme (context you do not otherwise have)

Every Expo app in the Rocapine GitHub org was scanned: 127 apps, only 5 depend on the
onboarding SDK, 122 have hand-coded onboardings. 64 distinct native flows were read
against the SDK schema, producing 103 catalogued needs, decomposed into 46 atoms
(SDK primitives, in \`Rocapine/react-native-onboarding\`) and 21 cells (Studio
composable templates, in \`Rocapine/onboarding-studio\`). 142 board items exist across
the two repos. Board: https://github.com/orgs/Rocapine/projects/1 ("Composable items")

Each repo's \`CLAUDE.md\` on **origin/main** carries a
\`## Native onboarding parity programme\` section. Read it. Note that the local
checkouts sit on unrelated long-lived feature branches, so read CLAUDE.md via
\`git show origin/main:CLAUDE.md\` rather than from the working tree.

**The audit overstated a third of its own findings.** \`~/Developer/onboarding-parity-recheck.md\`
is the authority: it classifies all 103 needs as CORRECT (59) / OVERSTATED (36) /
FALSE (7) / RENDERER-GAP (1). It is keyed by **need-section letter + need title**
(e.g. \`### E | Time-of-day picker\`), NOT by issue number — grepping it for an issue
number finds nothing. Map a ticket to its entry via the ticket's \`need:A\`-\`need:J\`
label plus its title.

**Two tickets block most of the rest:**
- \`Rocapine/react-native-onboarding#217\` — \`evaluateLeaf\` used \`condition.value\`
  verbatim, so no condition could compare two variables, even though
  \`screens/elements/RepeatElement.ts\` documents \`value: "{{zodiacSign}}"\` as *the*
  way to make \`Repeat\` a switch. Root cause behind seven catalogued needs.
- \`Rocapine/react-native-onboarding#209\` — \`UIElementSchema\` is a throwing
  \`z.discriminatedUnion\`, so publishing any new element type makes apps on older SDK
  versions throw at render. Gates all 17 new-element tickets.

Neither blocker has a paired Studio sub-issue; both are pure SDK work.
`

const SELECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tickets', 'rationale'],
  properties: {
    rationale: { type: 'string', description: 'Why these tickets, in order, and what you deliberately skipped' },
    skipped: { type: 'array', items: { type: 'string' }, description: 'Tickets that looked ready but are gated, with the gate' },
    tickets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['issue', 'repo', 'agentType', 'title', 'priority', 'labels'],
        properties: {
          issue: { type: 'number' },
          repo: { type: 'string', description: 'owner/name' },
          agentType: { type: 'string', enum: ['sdk-parity-dev', 'studio-parity-dev'] },
          title: { type: 'string' },
          priority: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          boardStatus: { type: 'string', description: 'Current Status on project #1, or NOT-ON-BOARD' },
          existingBranch: { type: 'string', description: 'A remote branch already carrying work for this ticket, if any' },
          existingWorktree: { type: 'string', description: 'A local worktree already on that branch, if any' },
          note: { type: 'string', description: 'Anything the implementer must know before starting' },
        },
      },
    },
  },
}

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issue', 'verdict', 'actualScope', 'evidence'],
  properties: {
    issue: { type: 'number' },
    verdict: { type: 'string', enum: ['BUILD', 'RESCOPE', 'CLOSE', 'GATED'] },
    verdictFileEntry: { type: 'string', description: 'The "### X | Title" heading this need maps to, or NOT-FOUND' },
    verdictFileClass: { type: 'string', description: 'CORRECT | OVERSTATED | FALSE | RENDERER-GAP | NOT-CLASSIFIED' },
    actualScope: { type: 'string', description: 'What is genuinely missing, in one paragraph' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'file:line facts you read yourself' },
    overstated: { type: 'array', items: { type: 'string' }, description: 'Ticket claims that are false or narrower than stated' },
    gatedBy: { type: 'string' },
    commentUrl: { type: 'string', description: 'If you posted a re-scoping comment, its URL' },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issue', 'outcome', 'summary'],
  properties: {
    issue: { type: 'number' },
    outcome: { type: 'string', enum: ['IMPLEMENTED', 'RE-SCOPED', 'RECOMMENDED_CLOSE', 'BLOCKED', 'FAILED'] },
    summary: { type: 'string' },
    prUrl: { type: 'string' },
    branch: { type: 'string' },
    worktree: { type: 'string' },
    testCommand: { type: 'string' },
    testResult: { type: 'string', description: 'Exact pass/fail counts, and any pre-existing failures you did NOT cause' },
    bothHalvesChecked: { type: 'string', description: 'How you verified schema AND renderer, or why not applicable' },
    pairedStudioIssue: { type: 'string' },
    followUps: { type: 'array', items: { type: 'string' } },
    couldNotCover: { type: 'array', items: { type: 'string' }, description: 'Anything in scope you did not do, and why' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issue', 'verdict', 'findings'],
  properties: {
    issue: { type: 'number' },
    verdict: { type: 'string', enum: ['APPROVE', 'CHANGES_REQUESTED', 'BLOCKED'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'confidence'],
        properties: {
          summary: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          line: { type: 'number' },
          failureScenario: { type: 'string' },
        },
      },
    },
  },
}

// ---------------------------------------------------------------- Select

let selection
if (GIVEN) {
  log(`Explicit batch of ${GIVEN.length} — skipping selection.`)
  selection = { tickets: GIVEN, rationale: 'Supplied via args.tickets' }
} else {
  phase('Select')
  selection = await agent(
    `Select the next ${BATCH} parity-programme tickets that are genuinely ready to implement, and return them in the order they should be worked.

${PROGRAMME}

## How to select

Use \`gh\` on the command line. Look at BOTH repos:
- \`gh issue list --repo Rocapine/react-native-onboarding --label parity-gap --state open --limit 200 --json number,title,labels\`
- \`gh issue list --repo Rocapine/onboarding-studio --label parity-gap --state open --limit 200 --json number,title,labels\`

Rules, in priority order:

1. **The two blockers come first.** If \`react-native-onboarding#217\` or \`#209\` is
   still open, they ARE the batch (in that order — #217 first, it shrinks the
   backlog). Do not select anything else while either is open, because #209 gates
   all 17 new-element tickets and #217 is the root cause behind seven needs.
2. Otherwise prefer \`prio:P0\`, then P1.
3. Never select a ticket that introduces a new SDK element *type* while #209 is open.
4. Never select a ticket whose need is rooted in #217 while #217 is open.
5. Skip anything already \`In review\` or \`Done\` on the board — someone is on it.
6. Map \`agentType\`: tickets in \`react-native-onboarding\` -> \`sdk-parity-dev\`;
   tickets in \`onboarding-studio\` -> \`studio-parity-dev\`.

## Report each ticket's current board status

Project #1 is \`PVT_kwDOCkEdDc4BiOsT\`; its \`Status\` field is
\`PVTSSF_lADOCkEdDc4BiOsTzhhHfgE\` (Backlog / Ready / In progress / In review / Done).
Read each candidate's current Status into \`boardStatus\`:

\`\`\`bash
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){projectItems(first:10){nodes{project{number} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}' \\
  -F o=Rocapine -F r=<repo> -F n=<issue>
\`\`\`

Report \`NOT-ON-BOARD\` if the issue has no item on project #1 — that is a bookkeeping
gap someone needs to know about. Do not add it yourself.

## Work already in flight — you must detect this

Some tickets already have a branch. Check with
\`gh api repos/<owner>/<repo>/branches --paginate -q '.[].name'\` and, for any branch
that looks related, \`git -C ~/Developer/<repo> log --oneline origin/main..origin/<branch>\`.
Also run \`git -C ~/Developer/<repo> worktree list\` for both repos to find local
worktrees already checked out on such a branch. Report both in \`existingBranch\` /
\`existingWorktree\` — an implementer that re-does committed work is a failure of this step.

Do not modify anything. Read-only. Return the structured selection.`,
    { label: 'select:board', phase: 'Select', schema: SELECT_SCHEMA }
  )
}

if (!selection || !selection.tickets || !selection.tickets.length) {
  log('No ready tickets — stopping.')
  return { selection, results: [] }
}

log(`Batch: ${selection.tickets.map(t => `${t.repo}#${t.issue}`).join(', ')}`)
if (selection.skipped && selection.skipped.length) {
  log(`Deliberately skipped ${selection.skipped.length}: ${selection.skipped.slice(0, 4).join(' | ')}`)
}

// ---------------------------------------------------------------- Triage

const triageStage = (t) => agent(
  `Triage ${t.repo}#${t.issue} — "${t.title}" — and decide whether it should be built at all. Do NOT implement anything in this task.

${PROGRAMME}

## Your job

1. Read the ticket: \`gh issue view ${t.issue} --repo ${t.repo}\`.
2. Map it to its entry in \`~/Developer/onboarding-parity-recheck.md\` via its
   \`need:X\` label (labels: ${t.labels.join(', ')}) plus its title. Read §1, §2 and
   §2.1 of that file before concluding the need is absent from it — §2.1 is a table
   of 16 factually false statements that were made in ticket bodies.
3. **Verify the claimed gap against the real code yourself.** The original audit
   failed precisely because it trusted a summary instead of reading the schema files
   and the renderers. Read the element schema in full, its UI mirror, and the
   renderer. Two recurring traps: nested props read as "missing" when they are
   fields of an object (\`WheelPicker.range.{min,max,step,unit}\`), and enums read as
   empty when the audit dropped them.
4. Decide: BUILD (the gap is real and the scope is right), RESCOPE (real but
   materially narrower than claimed), CLOSE (not a gap at all), or GATED (blocked by
   #209 or #217 — note that being #209 or #217 *itself* is never GATED; those are
   the work).
5. If RESCOPE or CLOSE, post a comment on the issue with your verdict, the
   recheck-file section it came from, and the \`file:line\` evidence you read
   yourself — then return its URL. Comment only; never close the issue.

A verdict of RESCOPE or CLOSE is a successful, valuable outcome. Roughly a third of
these tickets overstate their gap; finding that is the point of this step, not a
failure to deliver.

${t.note ? `Selector's note: ${t.note}` : ''}
${t.existingBranch ? `Work already exists on branch \`${t.existingBranch}\`${t.existingWorktree ? ` (worktree \`${t.existingWorktree}\`)` : ''} — read it before judging what remains.` : ''}

Return the structured triage.`,
  { label: `triage:#${t.issue}`, phase: 'Triage', schema: TRIAGE_SCHEMA }
)

// ---------------------------------------------------------------- Build

const buildStage = (tri, t) => {
  if (!tri) return { ticket: t, triage: null, build: null }
  if (tri.verdict !== 'BUILD') {
    log(`#${t.issue}: triage says ${tri.verdict} — no code. ${String(tri.actualScope).slice(0, 120)}`)
    return { ticket: t, triage: tri, build: null }
  }
  const wt = t.existingWorktree || `/tmp/parity-${t.issue}`
  const repoName = t.repo.split('/')[1]
  return agent(
    `Implement ${t.repo}#${t.issue} — "${t.title}".

Triage has already run and cleared this ticket to BUILD. Its findings:

- Verdict-file entry: ${tri.verdictFileEntry || 'not found'} (${tri.verdictFileClass || 'unclassified'})
- **Actual scope to build:** ${tri.actualScope}
- Evidence already gathered: ${(tri.evidence || []).join(' | ')}
${(tri.overstated || []).length ? `- Ticket claims found to be overstated, do NOT build these: ${tri.overstated.join(' | ')}` : ''}

Build exactly that actual scope — not the ticket's original wording where the two differ.

## Worktree — use this exact path, do not create another

Work in \`${wt}\`.
${t.existingWorktree
  ? `That worktree already exists and is already checked out on \`${t.existingBranch}\`, which already carries committed work for this ticket. \`cd\` into it, read \`git log --oneline origin/main..HEAD\` and the diff, verify the existing tests still pass, and build only what remains. Do NOT redo the committed work and do NOT create a second worktree or branch.`
  : `Create it with \`git -C ~/Developer/${repoName} worktree add ${wt} -b <branch> origin/main\`, branching from \`origin/main\` — never from the working tree, which sits on an unrelated long-lived feature branch. Never push to main, never force-push, never merge.`}

## Non-negotiables

- **TDD.** Failing test first, watch it fail for the right reason, then minimal code.
- **A schema without a renderer is not a feature.** Check both halves. Four of the
  six release-critical bugs in this programme were schema/renderer mismatches that
  shipped silently — no validation error, just a placeholder or wrong output.
- Open a **draft** PR referencing the issue. Never merge it, never mark it ready,
  never bump a version, never publish.
- Move the board Status as you go, per your own instructions (In progress on pickup,
  In review once the draft PR is open). Never set Done.
- Report the paired Studio issue's status if one exists, and whether it is now
  unblocked. Closing an SDK half alone recreates the divergence the audit found.
- If part of the scope turns out to be blocked, do every other part in full and say
  exactly what you left out and why in \`couldNotCover\`. Report test results
  faithfully, including pre-existing failures you did not cause.

Return the structured build report.`,
    { label: `build:#${t.issue}`, phase: 'Build', agentType: t.agentType, schema: BUILD_SCHEMA }
  ).then(build => ({ ticket: t, triage: tri, build }))
}

// ---------------------------------------------------------------- Review

const reviewStage = (r) => {
  if (!r || !r.build || r.build.outcome !== 'IMPLEMENTED' || !r.build.prUrl) return r
  return agent(
    `Review the pull request ${r.build.prUrl} (issue ${r.ticket.repo}#${r.ticket.issue}).

It was built against this agreed scope: ${r.triage.actualScope}

Report only findings you are confident are real defects. Weight these especially,
because they are how this codebase has actually broken before:

- **Schema/renderer mismatch.** A schema change with no matching renderer change (or
  the reverse) ships silently — no validation error, just a placeholder or wrong
  output. Drift runs both ways: the UI element mirrors re-declare their own Zod
  schemas and prop types, so TypeScript does NOT catch it, and a variant added only
  to the UI mirror still throws \`invalid_union\` because the headless schema
  validates the payload.
- **Rules of hooks.** Reanimated hooks must be called unconditionally, before any
  \`variant\` branch, or the element breaks when it changes shape.
- Tests that would still pass if the production change were reverted.

The implementer reported: ${r.build.summary}
Tests: ${r.build.testCommand || 'unstated'} -> ${r.build.testResult || 'unstated'}
Both halves: ${r.build.bothHalvesChecked || 'unstated'}

Do not modify code. Return the structured review.`,
    { label: `review:#${r.ticket.issue}`, phase: 'Review', agentType: 'pr-review-scorer', schema: REVIEW_SCHEMA }
  ).then(review => ({ ...r, review }))
}

// ---------------------------------------------------------------- Run

const stages = MODE === 'triage-only'
  ? [triageStage]
  : [triageStage, buildStage, reviewStage]

if (MODE === 'triage-only') log('triage-only mode: no code will be written.')

const raw = await pipeline(selection.tickets, ...stages)
const results = raw.filter(Boolean)

const tally = { BUILD: 0, RESCOPE: 0, CLOSE: 0, GATED: 0, dropped: 0 }
for (const r of results) {
  const v = MODE === 'triage-only' ? (r && r.verdict) : (r && r.triage && r.triage.verdict)
  if (v && tally[v] !== undefined) tally[v]++
  else tally.dropped++
}
log(`Triage tally — build ${tally.BUILD}, rescope ${tally.RESCOPE}, close ${tally.CLOSE}, gated ${tally.GATED}, dropped ${tally.dropped}`)
if (raw.length !== results.length) log(`${raw.length - results.length} ticket chain(s) failed outright and returned nothing.`)

return { mode: MODE, selection, tally, results }
