---
name: watch-example-errors
description: Run the example app's Metro bundler and watch for errors — either a one-shot bundle check, or a live background agent that wakes the session and diagnoses the moment a runtime/bundle error hits the Metro log. Use when the user wants to "run the example app and detect errors", "set up an error-watch background agent", "warn me while I work on features", check the example bundles cleanly, or after changing packages/.
user-invocable: true
argument-hint: "[oneshot | agent] [--platforms ios,android,web]"
---

Error-detection agent for the example app. **Report-only: warn + diagnose +
propose a fix. Never auto-apply edits.**

Script: `scripts/example-error-watch.sh` (repo root). Three modes: `oneshot`
(default), `metro`, `until`.

## Mode 1 — one-shot bundle check

For a quick "does it still build" after editing `packages/`:
```bash
scripts/example-error-watch.sh                 # all platforms
scripts/example-error-watch.sh --platforms ios # faster
scripts/example-error-watch.sh --build         # rebuild SDK dist first
```
Exit `0` clean · `1` errors · `2` setup fail. Catches bundle-time errors only
(unresolved modules, syntax, transform). Does not execute JS.

## Mode 2 — live background agent (warn me while I work)

This is the "wrap a background shell with an agent that re-enters the session"
setup. Two background shells + the agent (you):

```
[shell A] metro → logfile        (long-lived; owns Metro; runtime + bundle errors land here)
[shell B] until → exit 1         (tails logfile; dies on first NEW error = wake signal)
   │ on exit → harness re-enters this session
   ▼
 you: restate error → read offending file → root-cause → propose patch (diff) → RELAUNCH shell B
```

Because shell B's metro is the one the sim/device connects to, this tier catches
**runtime red-box errors** (`console.error`, `Invariant Violation`, render
crashes) too — not just bundle-time. The user must point their dev build / sim at
this Metro's port (default 8081); the watcher owns it.

### Launching (must run where deps exist — repo root / main checkout, not a fresh worktree)

Start both shells with the Bash tool's `run_in_background: true`:

```bash
# shell A — long-lived Metro → logfile
scripts/example-error-watch.sh metro --log .metro.log --port 8081

# shell B — wake trigger; exits 1 on first new error, writes report
scripts/example-error-watch.sh until --log .metro.log --report .metro-error.txt
```

`.metro.log` / `.metro-error.txt` are transient — gitignored or under a tmp dir.

### The wake / relaunch protocol — what to do when shell B exits

A background shell **re-invokes this session when it exits**. That exit IS the
alert; you do not poll. When shell B exits non-zero:

1. **Restate** the error in your own text — file, error type, the TRIGGER LINE
   from `.metro-error.txt`. (Do this even though a tool printed it — the user
   sees only your prose.)
2. **Diagnose**: read the offending file + CONTEXT block. Common causes:
   - `Unable to resolve module X` → missing dep in `example/package.json`, or a
     local package export not built (`npm run build`, or `--build`).
   - error inside `packages/*/dist` → stale build.
   - syntax / transform / `Invariant Violation` / render error in `*/src` → real bug.
3. **Propose, don't apply**: give the fix as a diff. The user fixes (report-only).
4. **Relaunch shell B** (`run_in_background`) so watching resumes. Leave shell A
   (Metro) running — only restart it if it died.

If shell B exits `2` it's a setup failure (logfile never appeared / Metro not up),
not a code error — check shell A.

### Tearing down

Kill both background shells (TaskStop / kill the jobs). Metro is owned by shell A,
so stopping it stops Metro.

## Recurring / unattended variants

- `/loop` the one-shot for periodic CI-style checks.
- `/schedule` a cron routine running the one-shot, notify on exit 1.
The reaction policy stays warn + diagnose + propose — never auto-edit.
