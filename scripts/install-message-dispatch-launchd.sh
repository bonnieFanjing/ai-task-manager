#!/usr/bin/env bash
set -euo pipefail

LABEL="com.bonnie.ai-task-manager.message-dispatch"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"
USER_ID="$(id -u)"

mkdir -p "${PLIST_DIR}" "${PROJECT_DIR}/logs"

cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${PROJECT_DIR}/scripts/message-dispatch.sh</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>MESSAGE_DISPATCH_LIMIT</key>
    <string>20</string>
  </dict>

  <key>StartInterval</key>
  <integer>300</integer>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/logs/message-dispatch-launchd.log</string>

  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/logs/message-dispatch-launchd.err.log</string>
</dict>
</plist>
PLIST

chmod +x "${PROJECT_DIR}/scripts/message-dispatch.sh"

launchctl bootout "gui/${USER_ID}" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${USER_ID}" "${PLIST_PATH}"
launchctl enable "gui/${USER_ID}/${LABEL}"
launchctl kickstart -k "gui/${USER_ID}/${LABEL}"

echo "${LABEL} installed at ${PLIST_PATH}"
