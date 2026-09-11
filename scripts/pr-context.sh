#!/usr/bin/env bash
#
# Everything a reviewer needs about a pull request, in one invocation.
#
# Review and fix agents were each re-fetching the same unchanged PR. Run
# wf_48bf5783-6b3 made 63 PR-context calls — `gh pr view` ×19, `git diff <base>`
# ×18, `git show pr263:<file>` ×15, `gh pr diff` ×7, `gh run list` ×4 — and most
# returned a byte-identical answer. Each is a round trip that re-sends the
# agent's whole context as cache reads, so collapsing them is a cost lever and
# not only a latency one.
#
# Usage: scripts/pr-context.sh <pr-number> [--repo <owner/name>] [--no-diff]
#
set -euo pipefail

PR=""
REPO=""
WITH_DIFF=1

while [ $# -gt 0 ]; do
	case "$1" in
		--repo) REPO="${2:-}"; shift 2 ;;
		--no-diff) WITH_DIFF=0; shift ;;
		-h|--help) sed -n '2,13p' "$0"; exit 0 ;;
		-*) echo "pr-context: unknown flag $1" >&2; exit 2 ;;
		*) PR="$1"; shift ;;
	esac
done

if [ -z "$PR" ]; then
	echo "pr-context: need a PR number" >&2
	exit 2
fi

# Passed to every `gh` call, so a board spanning two repos — this one and
# `rocapine/onboarding-studio`, which is how every parity atom is paired —
# cannot half-resolve against whichever one the agent's cwd happens to be.
# Expanded as ${GH[@]+"${GH[@]}"} everywhere below, not "${GH[@]}": macOS ships
# bash 3.2, where an EMPTY array under `set -u` is an unbound variable and the
# script dies before its first call. CI's bash 5 does not reproduce it.
GH=()
[ -n "$REPO" ] && GH=(--repo "$REPO")

# One call, not five. `statusCheckRollup` is what `gh pr checks` reads, and
# `files` is what `gh pr diff --name-only` reads, so asking for both here is
# two fewer round trips.
VIEW=$(gh pr view "$PR" ${GH[@]+"${GH[@]}"} --json \
	number,title,state,isDraft,author,baseRefName,headRefName,mergeable,mergeStateStatus,url,body,files,statusCheckRollup)

printf '=== PR %s ===\n' "$PR"
printf '%s\n' "$VIEW" | jq -r '
	"title:      \(.title)",
	"url:        \(.url)",
	"author:     \(.author.login)",
	"state:      \(.state)\(if .isDraft then " (draft)" else "" end)",
	"base:       \(.baseRefName) <- \(.headRefName)",
	"mergeable:  \(.mergeable) / \(.mergeStateStatus)"
'

printf '\n=== CHECKS ===\n'
printf '%s\n' "$VIEW" | jq -r '
	(.statusCheckRollup // [])
	| if length == 0 then "no checks reported"
	  else .[] | "\(.name // .context)\t\(.conclusion // .state // "PENDING")"
	  end
'

printf '\n=== FILES (%s) ===\n' "$(printf '%s\n' "$VIEW" | jq -r '.files | length')"
printf '%s\n' "$VIEW" | jq -r '.files[] | "\(.additions)+ \(.deletions)-\t\(.path)"'

printf '\n=== BODY ===\n'
printf '%s\n' "$VIEW" | jq -r '.body // ""'

# Linked tickets. Only the closing/reference keywords count — `Refs #N` is what
# every PR here opens with. A bare `#123` in prose is as often a run number or a
# quoted log line as a ticket, and fetching those puts the round trips back.
LINKED=$(
	printf '%s\n' "$VIEW" | jq -r '.body // ""' \
		| grep -Eoi '(refs|closes|close|closed|fixes|fix|fixed|resolves|resolve|resolved)[[:space:]]+#[0-9]+' \
		| grep -Eo '[0-9]+' \
		| awk '!seen[$0]++'
)

for ISSUE in $LINKED; do
	printf '\n=== LINKED ISSUE #%s ===\n' "$ISSUE"
	gh issue view "$ISSUE" ${GH[@]+"${GH[@]}"} --json number,title,state,labels,body --jq '
		"title:  \(.title)",
		"state:  \(.state)",
		"labels: \([.labels[].name] | join(", "))",
		"",
		(.body // "")
	'
done

if [ "$WITH_DIFF" -eq 1 ]; then
	printf '\n=== DIFF ===\n'
	gh pr diff "$PR" ${GH[@]+"${GH[@]}"}
fi
