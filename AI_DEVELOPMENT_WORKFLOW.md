# AI Development Workflow

## Goal

Make AI-assisted development predictable, traceable, and testable.

The project should not depend on one long AI session remembering everything. The repository itself must hold the state.

## Chosen workflow

Use a hybrid workflow:

```text
Spec-driven planning + acceptance-test-driven implementation
```

Product behavior is defined as specs and test cases first. Implementation only starts after the current slice has a task ID and acceptance case IDs.

Detailed gate rules live in `DEVELOPMENT_PROCESS.md`.

## Workflow

### 1. Specify

Before code:

- Update requirements if behavior changes.
- Add or update test cases in `TEST_CASES.md`.
- Add acceptance criteria to the relevant task.

### 2. Plan a small slice

Each implementation slice should be small enough to finish in one session.

Good slice examples:

- Add Inbox table migration and database check.
- Add CLI command to create Inbox item.
- Add API endpoint to list Inbox items.
- Add Web Inbox page.
- Add fake-provider reminder sync test.

Bad slice examples:

- Build the whole task manager.
- Add AI to everything.
- Implement all GTD views at once.

### 3. Write tests first when practical

For business logic and API behavior:

- Write failing test.
- Implement code.
- Run test.
- Update status.

For UI:

- Define Playwright scenario first.
- Implement UI.
- Run E2E.

For Apple Reminders/iPhone notification:

- Write fake-provider tests first.
- Then run manual real-device test.

### 4. Implement

Implementation rules:

- Keep changes scoped to the current slice.
- Use migrations for schema changes.
- Route state changes through service functions.
- Do not let AI suggestions directly mutate core task fields.
- Do not add unrelated refactors.

### 5. Verify

Run the available regression gate:

```bash
npm run lint
npm test
npm run test:e2e
npm run db:check
```

If some commands do not exist yet, write that in `PROJECT_STATUS.md`.

### 6. Record

After every session, update `PROJECT_STATUS.md`:

- What changed.
- Files changed.
- Tests added.
- Tests run.
- Failures or skipped checks.
- Known issues.
- Next recommended slice.

## Task record template

Use this format in `PROJECT_STATUS.md` or future issue files:

```md
### YYYY-MM-DD - Short task name

Goal:

- ...

Changed:

- ...

Tests:

- Added: ...
- Ran: ...
- Result: ...

Acceptance cases:

- TC-INBOX-001: pass/fail/not run

Known issues:

- ...

Next:

- ...
```

## Traceability

Every meaningful implementation should be traceable:

```text
Requirement -> Test case -> Code change -> Verification result
```

Example:

```text
Inbox raw capture
-> TC-INBOX-001
-> inbox_items migration + captureInbox service + POST /api/inbox
-> npm test passes
```

## AI rule files

If this project is later opened in Cursor, add Cursor project rules under:

```text
.cursor/rules/
```

Suggested rules:

- Always read `PROJECT_STATUS.md` before implementation.
- Do not implement without a test case or documented acceptance case.
- Keep slices small.
- Update `PROJECT_STATUS.md` after changes.
- Never bypass service layer for task state changes.

For Codex, the equivalent is to keep these instructions in repository docs and start each coding session by reading them.

## Tool notes

Useful ideas from current AI development tools:

- Cursor Rules: project-level rules stored in `.cursor/rules`.
- Codex: use tests as evidence for completion and ask it to add targeted tests after implementation.
- OpenBox: can run coding agents in isolated containers and sync changes back; useful later if we want isolated experimental changes.
- Spec-driven development: use requirements and testable specs as the primary artifact before code.

References:

- Cursor Rules: https://docs.cursor.com/en/context
- Codex overview: https://platform.openai.com/docs/codex/overview
- OpenBox: https://openbox.sh/
- Spec-driven development overview: https://openreview.net/pdf?id=bw5mNj75h9

## Human review checklist

Before accepting an AI change:

- Does it satisfy the named test cases?
- Did it change files outside the slice?
- Did it add migrations for database changes?
- Did it preserve raw Inbox data?
- Did it add or update tests?
- Did it run the regression gate?
- Did it update `PROJECT_STATUS.md`?
