#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_DIR}/logs"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

mkdir -p "${LOG_DIR}"
cd "${PROJECT_DIR}"

args=(
  run task -- message dispatch
  --limit "${MESSAGE_DISPATCH_LIMIT:-20}"
)

if [[ "${MESSAGE_DISPATCH_FAKE:-0}" == "1" ]]; then
  args+=(--fake)
fi

"${NPM_BIN:-npm}" "${args[@]}" >> "${LOG_DIR}/message-dispatch.log" 2>&1
