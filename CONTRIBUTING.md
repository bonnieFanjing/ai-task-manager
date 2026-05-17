# Contributing

This project uses spec-driven planning plus acceptance-test-driven
implementation. Before changing behavior, read:

- `AGENTS.md`
- `DEVELOPMENT_PROCESS.md`
- `PROJECT_STATUS.md`
- `TASK_BREAKDOWN.md`
- `TEST_CASES.md`
- `DATABASE_DESIGN.md`
- `REQUIREMENTS.md`

## Development Rules

- Map each feature to a task ID in `TASK_BREAKDOWN.md`.
- Map completion to test case IDs in `TEST_CASES.md`.
- Put schema changes in migrations.
- Route state changes through service functions.
- Preserve raw Inbox text.
- Store AI output as suggestions unless the user explicitly accepts it.
- Keep personal SQLite data out of commits.

## Checks

```bash
npm run lint
npm test
npm run db:check
npm run build
npm run test:e2e
```
