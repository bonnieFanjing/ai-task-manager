# Engineering Plan

## Complexity assessment

Overall complexity: medium.

This is not hard because of algorithms. It is hard because it touches several boundaries:

- Local SQLite data model.
- Web UI.
- Local API/CLI.
- Codex/GPT natural-language workflow.
- AI suggestions and manual review.
- Phone access through Tailscale.
- Apple Reminders sync for real iPhone notifications.
- Regression risk across task states, reminders, and recommendations.

The project is manageable if built in small vertical slices. It becomes risky if we build many screens and AI features before the task model, migrations, and tests are stable.

## Recommended technical stack

First-version recommendation:

- Language: TypeScript.
- App: Vite + React for the web UI.
- API: Node.js local server.
- Database: SQLite.
- DB access: start with explicit SQL or a small query layer. Consider Prisma or Drizzle only if schema churn becomes painful.
- Date parsing: `chrono-node` for deterministic date extraction, with AI as an optional supplement.
- Unit tests: Vitest.
- End-to-end tests: Playwright.
- Reminder sync: start by evaluating `reminders-cli`; fall back to AppleScript/JXA/EventKit if needed.

Reasoning:

- TypeScript lets the API, UI, and tests share types.
- SQLite is easy to inspect, back up, and use from Codex.
- Explicit SQL keeps the first schema understandable and avoids over-abstracting too early.

References checked:

- Playwright: https://playwright.dev/docs/intro
- Vitest: https://main.vitest.dev/guide/
- Prisma Migrate: https://www.prisma.io/docs/orm/prisma-migrate
- Drizzle SQLite docs: https://orm.drizzle.team/docs/get-started

## Build strategy

Use vertical slices instead of building layers in isolation.

Each slice must include:

- Database schema or migration.
- API/CLI behavior.
- UI if relevant.
- Tests.
- Acceptance checklist.
- Status update in `PROJECT_STATUS.md`.

## Milestones

### M0: Project skeleton

Goal: create the basic TypeScript app, test runner, and database migration structure.

Done when:

- The app starts locally.
- SQLite database can be created from migrations.
- `npm test` runs.
- `npm run test:e2e` can run at least one smoke test.

### M1: Inbox core

Goal: make Inbox useful before everything else.

Done when:

- CLI/API can add Inbox items.
- Web UI can list Inbox items.
- Original input text, source, and created time are preserved.
- Inbox items can be marked processed or trashed.
- Tests cover add/list/process flows.

### M2: Task conversion

Goal: convert Inbox items into real tasks.

Done when:

- Inbox item can become a task.
- Task has status, title, deadline, reminder, priority, importance, urgency.
- Event history records conversion.
- Tests confirm original Inbox text is not lost.

### M3: GTD views

Goal: provide the basic Doit.im-like workflow.

Done when:

- Today, Next, Scheduled, Waiting, Projects, Contexts are visible.
- State transitions are tested.
- Filters do not break Inbox behavior.

### M4: AI-assisted classification

Goal: AI suggests fields, but the user remains in control.

Done when:

- AI suggestion is stored separately from the accepted task fields.
- User can accept, edit, or ignore suggestions.
- The raw task remains usable without AI.
- Tests use mock AI responses, not live model calls.

### M5: Recommendation engine

Goal: answer "what should I do now?"

Done when:

- Recommendation can filter by available time, context, device, deadline, importance, urgency.
- Recommendation explains why a task was selected.
- Tests cover deadline-first, context-matching, and waiting/dependency exclusions.

### M6: Apple Reminders sync

Goal: deliver real reminders to iPhone.

Done when:

- A task with `reminder_at` can be manually synced to Apple Reminders.
- Sync status is stored.
- Duplicate reminders are not created on repeated sync.
- Failure state is visible.

### M7: Private phone access

Goal: use the app from phone through Tailscale.

Done when:

- Server binds safely for Tailscale access.
- Auth token or login protects the API.
- Phone browser can open and use Inbox.

## Anti-regression rules

To avoid "fix A, break B":

- No feature is done without tests for the affected behavior.
- Every bug fix gets a regression test before or with the fix.
- Task state transitions must go through one service function, not scattered UI mutations.
- Database changes must be migrations, not ad hoc schema edits.
- AI output must be treated as suggestions, not blindly trusted writes.
- E2E smoke tests must cover the core paths after UI changes.

## Definition of done

A feature is done only when:

- It has a documented acceptance scenario.
- It has tests or a clear reason why it cannot be tested yet.
- It updates `PROJECT_STATUS.md`.
- It does not break existing tests.
- It preserves existing user data.

## Recommended command contract

Once implemented, these commands should become the regression gate:

```bash
npm run lint
npm test
npm run test:e2e
npm run db:migrate
npm run db:check
```

The exact commands may change after scaffolding, but the project should always keep one obvious verification path.

## AI handoff protocol

Every implementation session should start by reading:

1. `REQUIREMENTS.md`
2. `PROJECT_STATUS.md`
3. `ENGINEERING_PLAN.md`
4. `DATABASE_DESIGN.md`

Every implementation session should end by updating:

- Completed tasks.
- New files changed.
- Tests run.
- Known issues.
- Next recommended step.

This is the main protection against session limits and AI losing track of what has been done.

