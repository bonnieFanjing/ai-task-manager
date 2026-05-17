# Acceptance Tests

This document defines user-level scenarios that must keep working as the project grows.

## Test layers

### Unit tests

Use for:

- Date parsing.
- Recommendation ranking.
- Task state transitions.
- AI suggestion parsing with mock responses.

Tool: Vitest.

### API tests

Use for:

- Creating Inbox items.
- Listing Inbox items.
- Converting Inbox items to tasks.
- Updating task status.
- Querying Today and Scheduled views.

Tool: Vitest or a lightweight HTTP test helper.

### End-to-end tests

Use for:

- Opening the web app.
- Adding an Inbox item from the UI.
- Processing an Inbox item.
- Viewing Today.

Tool: Playwright.

## Core acceptance scenarios

### A1: Capture to Inbox

Given the user says:

```text
帮我记一下：明天下午还信用卡。
```

Then:

- A new Inbox item exists.
- `raw_text` contains the original sentence.
- `source` is `codex`.
- The item appears in Inbox.
- No user data is lost if AI parsing fails.

### A2: List Inbox

Given there are three unprocessed Inbox items.

When the user asks:

```text
帮我看一下 Inbox。
```

Then:

- The system returns all unprocessed Inbox items.
- Items are sorted newest first.
- Processed and trashed items are excluded by default.

### A3: Convert Inbox to Task

Given an Inbox item:

```text
明天下午还信用卡
```

When the user accepts conversion to task.

Then:

- A task is created.
- The task links to the Inbox item.
- The Inbox item becomes processed.
- A `converted_from_inbox` event is recorded.

### A4: Today deadlines

Given a task has `deadline_at` today and is not completed.

When the user asks:

```text
今天有什么必须完成？
```

Then:

- The task appears in the response.
- Completed tasks do not appear.
- Future tasks do not appear unless already marked Today.

### A5: Context recommendation

Given:

- Task A requires a computer.
- Task B can be done on commute.
- User says they are on a bus with 20 minutes.

Then:

- Task B ranks above Task A.
- The recommendation explains the reason.

### A6: Waiting tasks excluded

Given a task is waiting for another person.

When recommending what to do now.

Then:

- The task is excluded unless the user explicitly asks for waiting items.

### A7: AI suggestion does not overwrite data

Given AI suggests a deadline or context.

Then:

- The suggestion is stored in `ai_suggestions`.
- The task is changed only after user acceptance or an explicit command.

### A8: Reminder sync is idempotent

Given a task has already been synced to Apple Reminders.

When sync runs again.

Then:

- It updates the existing reminder or skips it.
- It does not create duplicate reminders.

### A9: Regression command

Before marking a feature done:

```bash
npm run lint
npm test
npm run test:e2e
npm run db:check
```

Then:

- All commands pass, or the failure is documented in `PROJECT_STATUS.md`.

## Manual QA checklist

Before using with real personal data:

- Create a fresh database.
- Add three Inbox items from CLI/API.
- Add one Inbox item from Web UI.
- Convert one item to a task.
- Set a deadline for today.
- View Today.
- Mark one task completed.
- Confirm completed task disappears from Today.
- Trigger AI suggestion with a mock or manual response.
- Confirm raw Inbox text remains unchanged.

