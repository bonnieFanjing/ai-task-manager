import { describe, expect, it } from 'vitest';
import { acceptAiSuggestionForTask, createAiSuggestion } from '../src/services/aiSuggestions.js';
import { createTask, getTask } from '../src/services/tasks.js';
import { createTestDb } from './helpers/db.js';

describe('AI suggestions', () => {
  it('TC-AI-001 stores suggestion without overwriting task', () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(db, { title: '给房东转账' });
      createAiSuggestion(db, {
        targetType: 'task',
        targetId: task.id,
        suggestion: { deadlineAt: '2026-05-22T15:00:00.000Z' }
      });

      expect(getTask(db, task.id)?.deadline_at).toBeNull();
    } finally {
      close();
    }
  });

  it('TC-AI-002 accepts suggestion through service layer', () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(db, { title: '给房东转账' });
      const suggestion = createAiSuggestion(db, {
        targetType: 'task',
        targetId: task.id,
        suggestion: { deadlineAt: '2026-05-22T15:00:00.000Z' }
      });

      const accepted = acceptAiSuggestionForTask(
        db,
        suggestion.id,
        task.id,
        { deadlineAt: '2026-05-22T15:00:00.000Z' },
        'codex'
      );

      expect(accepted.accepted_at).not.toBeNull();
      expect(getTask(db, task.id)?.deadline_at).toBe('2026-05-22T15:00:00.000Z');
    } finally {
      close();
    }
  });
});

