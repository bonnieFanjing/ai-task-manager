import { describe, expect, it } from 'vitest';
import { FakeReminderProvider, syncTaskReminder } from '../src/services/reminders.js';
import { createTask } from '../src/services/tasks.js';
import { createTestDb } from './helpers/db.js';

describe('Reminder sync', () => {
  it('TC-REM-001 creates reminder sync row with fake provider', async () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(db, {
        title: '还信用卡',
        reminderAt: '2026-05-17T10:00:00.000Z'
      });
      const sync = await syncTaskReminder(db, task.id, new FakeReminderProvider());
      expect(sync.sync_status).toBe('synced');
      expect(sync.external_id).toBe(`fake-${task.id}`);
    } finally {
      close();
    }
  });

  it('TC-REM-002 sync is idempotent', async () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(db, {
        title: '还信用卡',
        reminderAt: '2026-05-17T10:00:00.000Z'
      });
      const provider = new FakeReminderProvider();
      await syncTaskReminder(db, task.id, provider);
      await syncTaskReminder(db, task.id, provider);
      const count = db
        .prepare('select count(*) as count from reminder_syncs where task_id = ?')
        .get(task.id) as { count: number };
      expect(count.count).toBe(1);
    } finally {
      close();
    }
  });
});

