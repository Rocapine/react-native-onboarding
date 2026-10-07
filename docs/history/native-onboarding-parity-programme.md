# Native onboarding parity programme (retired)

> **Retired 2026-10-07.** Kept as history, not as a plan. This text was the
> `## Native onboarding parity programme` section of the root `CLAUDE.md` until
> [#293](https://github.com/Rocapine/react-native-onboarding/issues/293) moved it
> here. None of it is a current instruction: the verdict-file triage, the paired
> Studio-ticket duty, the two parity builders and their card moves on the old board
> have all ended. `Layer: SDK` tickets are now built by `.claude/agents/rno-sdk.md`,
> whose own `## PR authority` and `## Board status` sections are the rules; see
> `## How SDK tickets are built` in the root `CLAUDE.md`.
>
> The text below is the section as it stood on `main` at retirement, with one edit:
> an absolute home-directory path in the `board-run` snippet is shortened to `~`.
> Issue states quoted in it are as of that date, not now — check an issue before
> relying on anything it says is open or closed.

## Native onboarding parity programme

Context for the parity tickets in this repo. Full audit and component matrix:
**https://claude.ai/code/artifact/abfedd04-6784-41e5-9c2d-67d25906b76c**
Board: **https://github.com/orgs/Rocapine/projects/1** ("Composable items")

**Where it came from.** Every Expo app in the org was scanned: 127 apps, of which only 5 depend on this SDK and 122 have hand-coded onboardings. 64 distinct native flows were read against this SDK's schema, producing 103 catalogued needs, decomposed into 46 atoms (SDK primitives) and 21 cells (Studio templates over those atoms).

**Read the verdict file before picking up a ticket.** `~/Developer/onboarding-parity-recheck.md` classifies all 103 needs as CORRECT (59) / OVERSTATED (36) / FALSE (7) / RENDERER-GAP (1). The original audit ran against an incomplete baseline and overstated a third of its findings; ticket bodies have been corrected, but the verdict file is the authority on what is actually missing. **Do not trust a ticket that has not been reconciled against it.**

**Two tickets block the rest:**

- **[#217](https://github.com/Rocapine/react-native-onboarding/issues/217) — no condition can compare two variables.** `evaluateLeaf` uses `condition.value` verbatim (`evaluateCondition.ts`), yet `screens/elements/RepeatElement.ts` documents `value: "{{zodiacSign}}"` as *the* way to make `Repeat` a switch. That comparison never matches, silently. It is the root cause behind seven catalogued needs, so fixing it should **shrink** the backlog — do it before building anything new.
- **[#209](https://github.com/Rocapine/react-native-onboarding/issues/209) — unknown-element forward compatibility.** Gated all 17 new-element tickets; the SDK half has landed — an unknown element type is now omitted at the ComposableScreen boundary rather than throwing, so a new element type no longer breaks older apps' screens. See step 6 of the schema procedure above for what an older app now does. The **capability floor** half is not done: no `sdkVersion` is transmitted, so Studio still cannot warn or block at publish time.

Also open and easy to miss, all found by verifying renderers rather than schemas: `pickerType` accepts `gender`/`age`/`coach` and renders a "not yet implemented" placeholder ([#210](https://github.com/Rocapine/react-native-onboarding/issues/210)); `Loader variant:"texts_fading"` silently renders bars ([#218](https://github.com/Rocapine/react-native-onboarding/issues/218)); `Input.variableName` is write-only after mount ([#219](https://github.com/Rocapine/react-native-onboarding/issues/219)); `Repeat` rows cannot vary a numeric prop so nothing repeated can be staggered ([#220](https://github.com/Rocapine/react-native-onboarding/issues/220)).

**A schema without a renderer is not a feature.** Four of the six bugs above are schema/renderer mismatches that ship silently — no validation error, no warning. When adding anything, check both halves, and prefer failing loudly at publish time over rendering a placeholder.

**Every atom here has a paired Studio ticket** in `rocapine/onboarding-studio`, linked as a cross-repo sub-issue, so an atom reads `Sub-issues 0/1` until it is authorable. That pairing is the tracked version of step 5's mirror prompt — closing the SDK half alone recreates the divergence the audit found (`Commitment` and `replayWhen` both ship here and have zero references in Studio).

**How this backlog gets worked.** Two dedicated agents each take one issue number,
triage it against the verdict file *before* writing code, then build test-first in their
own worktree and open a draft PR: `sdk-parity-dev` for this repo, `studio-parity-dev` for
`onboarding-studio`. Neither may merge, mark a PR ready, bump a version, or publish. They
move their own card on project #1 (`In progress` on pickup, `In review` once the draft PR
is open) and never set `Done`, because that follows a merge. The batch workflow that drives
them is `board-run`, shared by every `~/Developer` repo and living at
`~/Developer/.claude/workflows/board-run.mjs`; the programme's own config — both repos, the
selection rules, the routing — is `.claude/board.json` in **`onboarding-studio`**, because
that repo holds most of the board. Run it from there, by **path** rather than by name
(`Workflow({name: …})` does not resolve — the registry only carries built-ins plus the
workflows of the repo the session was launched in):

```js
Workflow({scriptPath: '~/Developer/.claude/workflows/board-run.mjs',
          args: {limit: 2}})
```

Do not write a second workflow or a second `board.json` here — a copy of either is what
the shared spine replaced.

**Ticket conventions.** Labels: `parity-gap` on everything; tier is `atom:element|prop|logic|action|chrome` or `cell`; `need:A`–`need:J` maps to the audit's need sections; `prio:P0`–`P3`. Priority is *also* set on the org-level `Priority` **issue field** (Urgent/High/Medium/Low) — that is an issue field, not a project field, so it is written with the `setIssueFieldValue` GraphQL mutation, never `updateProjectV2Field`.
