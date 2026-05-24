import { describe, expect, it } from 'vitest';
import {
  FakeReminderProvider,
  type ReminderProvider,
  syncActiveTaskReminders,
  syncTaskReminder
} from '../src/services/reminders.js';
import { completeTask, createTask, getTask } from '../src/services/tasks.js';
import { createTestDb } from './helpers/db.js';

class CompletedReminderProvider implements ReminderProvider {
  provider = 'fake' as const;

  async upsertReminder(input: {
    taskId: string;
    title: string;
    notes: string | null;
    reminderAt: string;
    externalId: string | null;
  }): Promise<{ externalId: string; completed: true }> {
    return { externalId: input.externalId ?? `fake-${input.taskId}`, completed: true };
  }
}

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

  it('syncs overdue active reminders and skips completed tasks', async () => {
    const { db, close } = createTestDb();
    try {
      const overdue = createTask(db, {
        title: '0520 猫咪驱虫',
        reminderAt: '2026-05-20T09:00:00+08:00'
      });
      const future = createTask(db, {
        title: '下周复查',
        reminderAt: '2026-05-30T09:00:00+08:00'
      });
      const completed = createTask(db, {
        title: '已经做完的提醒',
        reminderAt: '2026-05-19T09:00:00+08:00'
      });
      completeTask(db, completed.id, 'test', '2026-05-24T08:00:00+08:00');

      const syncs = await syncActiveTaskReminders(
        db,
        new FakeReminderProvider(),
        '2026-05-24T09:00:00+08:00'
      );

      expect(syncs.map((sync) => sync.task_id).sort()).toEqual([future.id, overdue.id].sort());
      expect(syncs.every((sync) => sync.sync_status === 'synced')).toBe(true);
      expect(syncs.find((sync) => sync.task_id === overdue.id)?.external_id).toBe(`fake-${overdue.id}`);
    } finally {
      close();
    }
  });

  it('marks the local task completed when the external reminder is completed', async () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(db, {
        title: '从提醒事项点完成',
        reminderAt: '2026-05-24T09:00:00+08:00'
      });

      const sync = await syncTaskReminder(
        db,
        task.id,
        new CompletedReminderProvider(),
        '2026-05-24T09:30:00+08:00'
      );
      const updated = getTask(db, task.id);

      expect(sync.sync_status).toBe('synced');
      expect(updated?.status).toBe('completed');
      expect(updated?.completed_at).toBe('2026-05-24T09:30:00+08:00');
    } finally {
      close();
    }
  });
});
