#!/usr/bin/env bash
set -euo pipefail

LABEL="com.bonnie.ai-task-manager.ai-scan"
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
    <string>${PROJECT_DIR}/scripts/ai-scan-reminders.sh</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>AI_SCAN_SYNC_REMINDERS</key>
    <string>1</string>
    <key>AI_SCAN_LIMIT</key>
    <string>10</string>
    <key>AI_DAILY_AT</key>
    <string>21:00</string>
    <key>AI_DECISION_AT</key>
    <string>10:00</string>
    <key>REMINDERS_LIST_NAME</key>
    <string>AI Task Manager</string>
    <key>REMINDERS_TIMEOUT_MS</key>
    <string>30000</string>
  </dict>

  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>13</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/logs/ai-scan-launchd.log</string>

  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/logs/ai-scan-launchd.err.log</string>
</dict>
</plist>
PLIST

chmod +x "${PROJECT_DIR}/scripts/ai-scan-reminders.sh"

launchctl bootout "gui/${USER_ID}" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${USER_ID}" "${PLIST_PATH}"
launchctl enable "gui/${USER_ID}/${LABEL}"
launchctl kickstart -k "gui/${USER_ID}/${LABEL}"

echo "${LABEL} installed at ${PLIST_PATH}"
