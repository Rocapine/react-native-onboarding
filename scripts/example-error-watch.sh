#!/usr/bin/env bash
#
# example-error-watch.sh — headless error detector for the example app.
#
# Three modes:
#
#   (default / one-shot)  Start (or reuse) Metro, force a bundle compile per
#                         platform, report bundling/resolve/syntax errors, exit.
#
#   metro                 Run Metro for example/ in the foreground, mirroring all
#                         output to a logfile. Long-lived — launch as a background
#                         shell so it keeps serving while you work. Runtime errors
#                         from a connected sim/device land in this log too.
#
#   until                 Tail a Metro logfile and EXIT 1 the moment a NEW error
#                         line appears (writing an error report). Launch as a
#                         background shell: its exit is the wake signal for the
#                         agent to step in, warn, and diagnose. Re-launch after.
#
# ── one-shot ────────────────────────────────────────────────────────────────
#   scripts/example-error-watch.sh [--build] [--platforms ios,android,web]
#                                  [--port 8081] [--report FILE]
#
# ── agent flow (the "background agent" wrap) ─────────────────────────────────
#   # shell A (long-lived):
#   scripts/example-error-watch.sh metro --log .metro.log --port 8081
#   # shell B (wake trigger — exits 1 on first error):
#   scripts/example-error-watch.sh until --log .metro.log --report .metro-error.txt
#
# Exit codes: 0 = clean / no error yet · 1 = error(s) detected · 2 = setup failure.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$REPO_ROOT/example"

# Error line patterns (runtime red-box + bundle-time), and lines to ignore.
ERR_PAT='unable to resolve module|syntaxerror|transformerror|invariant violation|render error|\[runtime not ready\]|failed building javascript bundle|bundling failed|cannot find module|unexpected token|^error |error:|^ *error  |console\.error'
IGNORE_PAT='warn|deprecat|^ *log |\(node:|errorutils|possible unhandled promise'

# ─────────────────────────────── mode: metro ────────────────────────────────
mode_metro() {
  local PORT=8081 LOG="$REPO_ROOT/.metro.log"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port) PORT="$2"; shift 2 ;;
      --log)  LOG="$2";  shift 2 ;;
      *) echo "metro: unknown arg $1" >&2; exit 2 ;;
    esac
  done
  : > "$LOG"
  echo "▶ Metro starting — port $PORT, log → $LOG"
  cd "$EXAMPLE_DIR" || exit 2
  exec env CI=1 EXPO_NO_TELEMETRY=1 npx expo start --port "$PORT" 2>&1 | tee -a "$LOG"
}

# ─────────────────────────────── mode: until ────────────────────────────────
mode_until() {
  local LOG="" REPORT=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --log)    LOG="$2";    shift 2 ;;
      --report) REPORT="$2"; shift 2 ;;
      *) echo "until: unknown arg $1" >&2; exit 2 ;;
    esac
  done
  [[ -z "$LOG" ]] && { echo "until: --log FILE required" >&2; exit 2; }

  # wait for the logfile to exist (Metro shell may still be booting)
  for _ in $(seq 1 120); do [[ -f "$LOG" ]] && break; sleep 1; done
  [[ -f "$LOG" ]] || { echo "until: log $LOG never appeared" >&2; exit 2; }

  echo "👁  until: watching $LOG for new errors…"

  # -n0: only lines appended AFTER we start (ignore pre-existing log content).
  # When we exit on match, the tail child gets SIGPIPE and dies.
  while IFS= read -r line; do
    if printf '%s' "$line" | grep -qiE "$ERR_PAT" \
       && ! printf '%s' "$line" | grep -qiE "$IGNORE_PAT"; then
      local ts; ts="$(date '+%Y-%m-%d %H:%M:%S')"
      {
        echo "═══ Metro error detected — $ts ═══"
        echo "TRIGGER LINE:"
        echo "  $line"
        echo
        echo "CONTEXT (last 40 log lines):"
        tail -n 40 "$LOG" | sed 's/^/  /'
        echo "RESULT: ERRORS_DETECTED"
      } | tee "${REPORT:-/dev/stdout}"
      exit 1
    fi
  done < <(tail -n0 -F "$LOG" 2>/dev/null)
}

# ───────────────────────────── mode: one-shot ───────────────────────────────
mode_oneshot() {
  local PLATFORMS="ios,android,web" PORT=8081 DO_BUILD=0 REPORT_FILE=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --build) DO_BUILD=1; shift ;;
      --platforms) PLATFORMS="$2"; shift 2 ;;
      --port) PORT="$2"; shift 2 ;;
      --report) REPORT_FILE="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
  done

  local METRO_LOG; METRO_LOG="$(mktemp -t metro-watch.XXXXXX)"
  local STARTED_METRO=0 METRO_PID=""
  emit() { printf '%s\n' "$*"; [[ -n "$REPORT_FILE" ]] && printf '%s\n' "$*" >> "$REPORT_FILE"; }
  cleanup() {
    if [[ "$STARTED_METRO" == "1" && -n "$METRO_PID" ]]; then
      kill "$METRO_PID" 2>/dev/null; pkill -P "$METRO_PID" 2>/dev/null
    fi
    rm -f "$METRO_LOG"
  }
  trap cleanup EXIT

  metro_running() { curl -s -m 3 "http://localhost:$PORT/status" 2>/dev/null | grep -q "packager-status:running"; }
  start_metro() {
    if metro_running; then echo "↺ Reusing Metro on port $PORT"; return 0; fi
    if [[ "$DO_BUILD" == "1" ]]; then echo "▶ Building SDK packages…"; ( cd "$REPO_ROOT" && npm run build >/dev/null 2>&1 ); fi
    echo "▶ Starting Metro (port $PORT)…"
    ( cd "$EXAMPLE_DIR" && CI=1 EXPO_NO_TELEMETRY=1 npx expo start --port "$PORT" >"$METRO_LOG" 2>&1 ) &
    METRO_PID=$!; STARTED_METRO=1
    for _ in $(seq 1 90); do
      metro_running && { echo "✔ Metro ready"; return 0; }
      kill -0 "$METRO_PID" 2>/dev/null || { echo "✘ Metro exited early:"; tail -n 30 "$METRO_LOG"; return 2; }
      sleep 1
    done
    echo "✘ Metro not ready within 90s"; return 2
  }
  bundle_url_for() {
    local platform="$1" manifest url
    manifest="$(curl -s -m 10 -H "expo-platform: $platform" -H "Accept: application/json" "http://localhost:$PORT/" 2>/dev/null)"
    url="$(printf '%s' "$manifest" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("launchAsset",{}).get("url",""))
except Exception: print("")' 2>/dev/null)"
    printf '%s' "$url"
  }
  check_platform() {
    local platform="$1" url body http
    url="$(bundle_url_for "$platform")"
    [[ -z "$url" ]] && url="http://localhost:$PORT/index.bundle?platform=$platform&dev=true&minify=false"
    body="$(curl -s -m 180 -w $'\n__HTTP__%{http_code}' "$url" 2>/dev/null)"
    http="${body##*__HTTP__}"; body="${body%$'\n'__HTTP__*}"
    if [[ "$http" == "200" ]]; then emit "  ✔ $platform — bundle compiled cleanly"; return 0; fi
    HAD_ERROR=1
    emit "  ✘ $platform — bundle FAILED (HTTP ${http:-?})"
    printf '%s' "$body" | python3 -c '
import sys,json
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print("      "+(raw.strip()[:1500] or "<empty response>")); sys.exit()
def line(s): print("      "+s)
if d.get("type"): line("type: "+str(d["type"]))
for l in str(d.get("message","")).splitlines()[:25]: line(l)
for e in (d.get("errors") or [])[:10]:
    fn=e.get("filename",""); ln=e.get("lineNumber","")
    loc=(fn+(":"+str(ln) if ln else "")) if fn else ""
    line(("• "+loc) if loc else "•")
    for l in str(e.get("description","")).splitlines()[:15]: line("    "+l)
' 2>/dev/null
    return 1
  }

  HAD_ERROR=0
  local ts; ts="$(date '+%Y-%m-%d %H:%M:%S')"
  [[ -n "$REPORT_FILE" ]] && : > "$REPORT_FILE"
  emit "═══ Metro error report — $ts ═══"
  start_metro || { emit "RESULT: SETUP_FAILED (Metro)"; exit 2; }
  IFS=',' read -ra PLATS <<< "$PLATFORMS"
  for p in "${PLATS[@]}"; do p="$(echo "$p" | tr -d ' ')"; [[ -z "$p" ]] && continue; check_platform "$p"; done
  if [[ "$HAD_ERROR" == "1" ]]; then emit "RESULT: ERRORS_DETECTED"; exit 1; fi
  emit "RESULT: CLEAN"; exit 0
}

# ─────────────────────────────── dispatch ───────────────────────────────────
case "${1:-}" in
  metro) shift; mode_metro "$@" ;;
  until) shift; mode_until "$@" ;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) mode_oneshot "$@" ;;
esac
