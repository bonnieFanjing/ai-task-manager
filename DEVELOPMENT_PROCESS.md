# Development Process

## Decision

Use a hybrid workflow:

```text
Spec-driven planning + acceptance-test-driven implementation
```

This is the best fit for this project.

## Why not pure TDD

Pure TDD is useful for small functions, but this product has many user workflows and system boundaries:

- Codex/GPT command entry.
- SQLite persistence.
- Web UI.
- AI suggestions.
- Apple Reminders sync.
- Tailscale phone access.

For these, we first need a clear behavioral specification: what should happen, what must not happen, and how the user verifies it.

## Why not pure Spec-driven development

Pure specification can become documentation without enforcement. This project needs executable checks because AI will write much of the code.

Every spec must connect to:

- A test case ID.
- A task ID.
- A verification command or manual checklist.

## Workflow gates

No implementation should start unless these gates are satisfied.

### Gate 1: Spec ready

Required:

- Requirement exists in `REQUIREMENTS.md` or a linked document.
- Test case exists in `TEST_CASES.md`.
- Task exists in `TASK_BREAKDOWN.md`.
- Acceptance criteria are clear.

Output:

```text
Requirement -> Test Case -> Task
```

### Gate 2: Test ready

Required:

- Automated test planned or written first.
- If automation is impossible, manual test steps are documented.

Examples:

- Database/API/service behavior: automated test required.
- Real iPhone notification: manual checklist allowed.

Output:

```text
Test Case -> Automated test or Manual checklist
```

### Gate 3: Implementation

Required:

- Implement only the current task slice.
- Use migrations for schema changes.
- Use service functions for state changes.
- Keep AI output as suggestions until accepted.
- Avoid unrelated refactors.

Output:

```text
Code change -> linked test case
```

### Gate 4: Verification

Required:

- Run available regression commands.
- Record missing commands if project skeleton does not have them yet.
- Do not mark task done if relevant tests fail.

Standard commands once available:

```bash
npm run lint
npm test
npm run test:e2e
npm run db:check
```

Output:

```text
Verification result -> pass/fail/not available
```

### Gate 5: Record

Required:

- Update `PROJECT_STATUS.md`.
- Record task ID, test case IDs, files changed, tests run, result, known issues, and next step.

Output:

```text
Current project state recoverable by the next AI session
```

## Slice template

Every implementation slice should look like this:

```md
Task:

- TASK-xxxx

Requirement:

- Link or short description.

Acceptance cases:

- TC-xxxx

Planned files:

- ...

Tests first:

- ...

Implementation:

- ...

Verification:

- ...

Status update:

- ...
```

## Current execution readiness

The project is ready to start implementation of Phase 0.

Ready:

- Product direction is documented.
- Access strategy is documented.
- Reminder strategy is documented.
- Database direction is documented.
- Test strategy and test cases are documented.
- Task breakdown is documented.
- AI workflow is documented.

Not yet ready:

- There is no code skeleton.
- Regression commands do not exist yet.
- No migration runner exists yet.

Therefore the first implementation slice should be:

```text
TASK-0001: Create project skeleton
```

Then:

```text
TASK-0002: Add migration runner and db check
```

Do not start Inbox feature code before Phase 0 exists, because the regression gate and database migration path need to be in place first.

## When to pause and re-align

Pause before implementation if:

- A task has no test case.
- A database field is unclear.
- A feature requires a real external account or phone behavior.
- A change would modify architecture outside the current slice.
- The implementation would require storing AI provider tokens.

