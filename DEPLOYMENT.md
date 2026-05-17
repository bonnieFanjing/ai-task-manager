# Deployment

AI Task Manager is local-first. The default deployment target is a personal
Mac or private server with a local SQLite database.

## Requirements

- Node.js 22.5.0 or newer.
- npm.
- A writable directory for the SQLite database.

## Local Development

```bash
npm install
npm run db:migrate
npm run dev
```

Open the web UI:

```text
http://127.0.0.1:5173
```

The API listens on:

```text
http://127.0.0.1:4010
```

## Private Personal Deployment

Use an explicit database path and API token:

```bash
export TASK_DB_PATH="$HOME/.local/share/ai-task-manager/tasks.sqlite"
export API_TOKEN="replace-with-a-long-random-token"
export PORT=4010
npm run build
npm run dev:api
```

For phone access, expose the machine through a private network such as Tailscale
and keep `API_TOKEN` enabled. Do not expose this API directly to the public
internet without adding production-grade authentication, TLS termination,
backups, and monitoring.

## Static Web Build

Build the React frontend:

```bash
npm run build
```

The frontend bundle is written to `dist/`. The current app expects the API to be
available from the same host, so use a reverse proxy when serving it outside the
Vite development server.

## Data Privacy

The local database lives at `data/tasks.sqlite` by default. The repository
ignores everything under `data/` except `data/.gitkeep`, so personal tasks and
SQLite backups are not committed.

Before pushing, verify:

```bash
git status --short --ignored
git check-ignore data/tasks.sqlite
```

## Regression Checks

Run these before deploying or publishing changes:

```bash
npm run lint
npm test
npm run db:check
npm run build
npm run test:e2e
```
