#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_DIR}/logs"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

mkdir -p "${LOG_DIR}"
cd "${PROJECT_DIR}"

args=(
  run task -- ai scan
  --limit "${AI_SCAN_LIMIT:-10}"
)

if [[ "${AI_SCAN_SYNC_REMINDERS:-0}" == "1" ]]; then
  args+=(
    --sync-reminders
    --list "${REMINDERS_LIST_NAME:-AI Task Manager}"
    --daily-at "${AI_DAILY_AT:-21:00}"
    --decision-at "${AI_DECISION_AT:-10:00}"
  )
fi

"${NPM_BIN:-npm}" "${args[@]}" >> "${LOG_DIR}/ai-scan.log" 2>&1
