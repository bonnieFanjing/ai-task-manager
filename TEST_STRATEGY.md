# Test Strategy

## Principle

This project should use acceptance-test-driven development.

Before implementing a feature, define:

- What user scenario it supports.
- What database changes should happen.
- What API/CLI result should be visible.
- What UI state should change.
- What regression test proves it still works later.

This is especially important because most implementation will be done with AI assistance. Tests and status docs are the guardrails that prevent "implemented halfway" or "fixed A, broke B".

## Test pyramid

### 1. Database tests

Purpose:

- Verify migrations create the expected schema.
- Verify constraints protect data.
- Verify core queries return the right records.

Examples:

- Inbox insert preserves raw text.
- Processed Inbox items are not returned in default Inbox query.
- Converted task links back to source Inbox item.
- Task event is created during conversion.

Automation:

- Run against a temporary SQLite database.
- Reset database before each test.

### 2. Service tests

Purpose:

- Verify business rules in one place.
- Prevent UI/API/Codex from each implementing their own logic.

Examples:

- `captureInbox(rawText, source)` creates a valid Inbox item.
- `convertInboxToTask(id, fields)` updates Inbox and creates task atomically.
- `completeTask(id)` updates task state and writes event log.
- `recommendNow(context)` excludes waiting/completed/future tasks.

Automation:

- Vitest unit/integration tests.
- Use fake clock for date-sensitive logic.

### 3. API tests

Purpose:

- Verify HTTP contract for Web App, Shortcuts, and future integrations.

Examples:

- `POST /api/inbox` creates an Inbox item.
- `GET /api/inbox` returns unprocessed items.
- `POST /api/inbox/:id/convert` converts to task.
- `GET /api/tasks/today` returns deadline/today items.

Automation:

- Start app in test mode or call request handlers directly.
- Use temporary SQLite database.

### 4. CLI tests

Purpose:

- Verify Codex-friendly command surface.

Examples:

- `task inbox add "明天下午还信用卡"` adds an Inbox item.
- `task inbox list` shows unprocessed Inbox items.
- `task today` shows today's deadline items.

Automation:

- Run CLI with test database path.
- Assert stdout and database state.

### 5. UI end-to-end tests

Purpose:

- Verify the user-facing Web App works.

Examples:

- Open Inbox page.
- Add Inbox item.
- See item immediately.
- Convert item to task.
- See it leave Inbox and appear in Today/Scheduled if relevant.

Automation:

- Playwright.
- Use deterministic test database seed.

### 6. AI behavior tests

Purpose:

- Verify AI integration cannot corrupt user data.

Examples:

- Mock AI suggests deadline/context.
- Suggestion is stored in `ai_suggestions`.
- Real task fields do not change until accepted.
- Failed AI call leaves Inbox item intact.

Automation:

- Never call live AI in normal tests.
- Use fixture responses.

### 7. Reminder sync tests

Purpose:

- Verify reminder logic before touching real Apple Reminders.

Examples:

- Task with reminder creates pending sync row.
- Repeated sync does not create duplicate external reminders.
- Sync failure records error.

Automation:

- Unit test sync planner with fake provider.
- Manual test real Apple Reminders only after fake provider passes.

## Regression gate

Before marking any feature done, run:

```bash
npm run lint
npm test
npm run test:e2e
npm run db:check
```

If a command does not exist yet, `PROJECT_STATUS.md` must say so.

If a command fails, the feature is not done unless the failure is unrelated and documented.

## Test data

Use stable scenario data:

- Credit card repayment: deadline and reminder.
- Bus/commute task: context recommendation.
- Computer-required task: context exclusion.
- Delegated/waiting task: recommendation exclusion.
- Completed task: Today exclusion.
- Raw thought note: Inbox item that does not become a task.

## Manual verification

Some behavior cannot be fully automated in MVP:

- iPhone actually receiving Apple Reminders notification.
- Tailscale access from the user's phone.
- Real Codex conversation writing to local SQLite.

For these, keep manual checklists in `TEST_CASES.md` and record results in `PROJECT_STATUS.md`.

