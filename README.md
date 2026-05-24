# AI Task Manager

Local-first personal task manager inspired by Doit.im/GTD, built for people who
want a small task system that an AI assistant can safely read, query, and update.

The app stores tasks in SQLite, exposes a CLI and HTTP API, and includes a React
web UI for Inbox capture, task processing, Today, and "what should I do now?"
recommendations.

## Why this exists

Most task apps are useful for humans but awkward for AI-assisted workflows. This
project keeps the core data local and explicit:

- Inbox items preserve the original raw text.
- AI output is saved as suggestions until the user accepts it.
- State changes go through service functions and leave events.
- Recommendations explain their score with readable reasons.
- The default database is a local SQLite file, not a hosted service.

## Current MVP

Implemented:

- SQLite database with migrations.
- Inbox capture, listing, processing, and conversion to tasks.
- Task completion.
- Today query.
- "What should I do now?" recommendation engine.
- AI suggestion storage and explicit acceptance flow.
- Reminder sync framework with a fake provider for regression tests.
- AI-delegated task scan with `[AI]` labeling, progress digest, and decision reminders.
- Message dispatch outbox for scheduling task assignments through 企业微信 self-built app messages.
- Token-protected HTTP API.
- CLI for agent-friendly task operations.
- Web UI for Inbox, processing, Today, and recommendations.
- Unit, API, CLI, and Playwright E2E tests.

Not yet fully integrated:

- Real Apple Reminders sync to iPhone.
- Tailscale phone manual verification.
- Live AI provider token integration.

## Requirements

- Node.js 22.5.0 or newer.
- npm.

This project uses `node:sqlite`, so older Node versions will not work.

## Quick Start

```bash
npm install
npm run db:migrate
npm run dev
```

Web UI:

```text
http://127.0.0.1:5173
```

API:

```text
http://127.0.0.1:4010/api/health
```

## Regression Checks

```bash
npm run lint
npm test
npm run db:check
npm run build
npm run test:e2e
```

## CLI examples

Add Inbox item:

```bash
npm run task -- inbox add "明天下午还信用卡"
```

List Inbox:

```bash
npm run task -- inbox list
```

Convert Inbox item:

```bash
npm run task -- inbox convert <inbox-id> "还信用卡"
```

View Today:

```bash
npm run task -- today
```

Recommend now:

```bash
npm run task -- recommend --commute --minutes 20
npm run task -- recommend --computer --minutes 45 --location home
```

Scan AI-delegated tasks and optionally sync active task reminders plus Reminder digests:

```bash
npm run task -- ai scan
npm run task -- ai scan --sync-reminders --list "AI Task Manager"
npm run ai:scan:install
```

Sync every active task with `reminder_at`, including overdue unfinished tasks:

```bash
npm run task -- reminder sync-active --list "AI Task Manager"
```

Queue and dispatch 企业微信 task messages:

```bash
npm run task -- message recipient add "Alice" --wecom-user alice.userid
npm run task -- message queue <task-id> --to <recipient-id> --at 2026-05-24T10:00:00.000Z
npm run task -- message outbox
npm run task -- message dispatch
npm run message:dispatch:install
```

Use `--fake` on recipient creation and dispatch for local dry-run testing. Real
dispatch uses 企业微信自建应用 credentials from `WECOM_CORP_ID`,
`WECOM_AGENT_SECRET`, and `WECOM_AGENT_ID`. The integration sends through the
official 企业微信 application message API; it does not automate the personal
WeChat desktop client or bypass WeChat interaction limits.

## API examples

When `API_TOKEN` is not set, local API requests are unauthenticated:

```bash
curl http://127.0.0.1:4010/api/health
```

With `API_TOKEN` set:

```bash
curl -H "x-api-token: $API_TOKEN" http://127.0.0.1:4010/api/health
```

Capture Inbox text:

```bash
curl -X POST http://127.0.0.1:4010/api/inbox \
  -H "content-type: application/json" \
  -d '{"rawText":"明天下午还信用卡","source":"api"}'
```

## Data

Default database:

```text
data/tasks.sqlite
```

Override path:

```bash
TASK_DB_PATH=/path/to/tasks.sqlite npm run task -- inbox list
```

Personal SQLite data is intentionally ignored by Git. The repository keeps only
`data/.gitkeep`; `data/tasks.sqlite` and local backups should never be committed.

## API auth

If `API_TOKEN` is set, API requests require one of:

```text
x-api-token: <token>
Authorization: Bearer <token>
```

For Tailscale use, set `API_TOKEN` before exposing the server to the phone.

## Deployment

See `DEPLOYMENT.md` for local development, private personal deployment, Tailscale
notes, static web build notes, and data privacy checks.

## Contributing

See `CONTRIBUTING.md`. The short version: keep changes mapped to the planning
docs, add or update tests, and never commit personal SQLite data.

## License

MIT.

## Development process

Read before coding:

- `AGENTS.md`
- `DEVELOPMENT_PROCESS.md`
- `PROJECT_STATUS.md`
- `TASK_BREAKDOWN.md`
- `TEST_CASES.md`
