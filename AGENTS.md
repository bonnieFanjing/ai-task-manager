# AI Agent Instructions

This repository uses:

```text
Spec-driven planning + acceptance-test-driven implementation
```

Before implementing code, read these files:

1. `PROJECT_STATUS.md`
2. `DEVELOPMENT_PROCESS.md`
3. `TASK_BREAKDOWN.md`
4. `TEST_CASES.md`
5. `DATABASE_DESIGN.md`
6. `REQUIREMENTS.md`

## Hard rules

- Do not implement a feature unless it maps to a task ID in `TASK_BREAKDOWN.md`.
- Do not mark a feature done unless it maps to test case IDs in `TEST_CASES.md`.
- Database schema changes must use migrations.
- State changes must go through service functions, not direct UI writes.
- Preserve raw Inbox text.
- AI output must be stored as suggestions unless the user explicitly accepts it.
- Keep each implementation slice small.
- Avoid unrelated refactors.
- Update `PROJECT_STATUS.md` at the end of each implementation session.

## Personal task queries

When the user asks what they should do today, what is urgent, what is suitable to do now, or asks about their personal todo list, check the local task database before giving advice.

Use the existing CLI:

```bash
npm run task -- today
npm run task -- recommend --computer --minutes 45 --location home
```

Map context into flags conservatively:

- At home, at a desk, or computer available: use `--computer`.
- Commuting or phone-only attention: use `--commute`.
- If available time is provided, use `--minutes <n>`; otherwise default to `45`.
- If the user says they are at home, use `--location home`; use `--location hospital` for hospital/clinic contexts.

Do not answer these questions from generic life advice until the project task data has been read.

## Verification

Run the available checks before finishing:

```bash
npm run lint
npm test
npm run test:e2e
npm run db:check
```

If a command does not exist yet, say so in the final response and record it in `PROJECT_STATUS.md`.

## Current first implementation step

Start with:

```text
TASK-0001: Create project skeleton
```

Then:

```text
TASK-0002: Add migration runner and db check
```

Do not start Inbox feature implementation until the skeleton and database check path exist.
