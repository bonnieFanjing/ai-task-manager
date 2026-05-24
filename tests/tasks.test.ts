import { describe, expect, it } from 'vitest';
import { captureInbox, getInboxItem } from '../src/services/inbox.js';
import { completeTask, convertInboxToTask, createTask, listTodayTasks } from '../src/services/tasks.js';
import { createTestDb } from './helpers/db.js';

describe('Task service', () => {
  it('TC-CONVERT-001 converts Inbox item to task and records event', () => {
    const { db, close } = createTestDb();
    try {
      const inbox = captureInbox(db, { rawText: '明天下午还信用卡', source: 'codex' });
      const task = convertInboxToTask(
        db,
        inbox.id,
        {
          title: '还信用卡',
          deadlineAt: '2026-05-18T15:00:00.000Z',
          reminderAt: '2026-05-18T15:00:00.000Z'
        },
        'codex'
      );

      expect(task.source_inbox_id).toBe(inbox.id);
      expect(getInboxItem(db, inbox.id)?.status).toBe('processed');
      const events = db.prepare('select event_type from task_events where task_id = ?').all(task.id);
      expect(events.map((row) => row.event_type)).toContain('converted_from_inbox');
    } finally {
      close();
    }
  });

  it('infers deadline, reminder, and schedule from concrete Inbox time', () => {
    const { db, close } = createTestDb();
    try {
      const inbox = captureInbox(db, {
        rawText: '明年5月24日上午10点在山姆买五花肉',
        source: 'codex',
        now: '2026-05-23T16:52:00.000Z'
      });
      const task = convertInboxToTask(
        db,
        inbox.id,
        {
          title: '在山姆买五花肉',
          status: 'next',
          deadlineAt: null,
          reminderAt: null
        },
        'codex',
        '2026-05-23T16:52:00.000Z'
      );

      expect(task.deadline_at).toBe('2027-05-24T02:00:00.000Z');
      expect(task.reminder_at).toBe('2027-05-24T02:00:00.000Z');
      expect(task.start_at).toBe('2027-05-24T02:00:00.000Z');
      expect(task.status).toBe('scheduled');
    } finally {
      close();
    }
  });

  it('infers natural dates when creating a task directly', () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(
        db,
        {
          title: '明天下午3点还信用卡'
        },
        'codex',
        '2026-05-17T01:00:00.000Z'
      );

      expect(task.deadline_at).toBe('2026-05-18T07:00:00.000Z');
      expect(task.reminder_at).toBe('2026-05-18T07:00:00.000Z');
      expect(task.start_at).toBe('2026-05-18T07:00:00.000Z');
      expect(task.status).toBe('scheduled');
    } finally {
      close();
    }
  });

  it('TC-TASK-001 completes a task and removes it from Today', () => {
    const { db, close } = createTestDb();
    try {
      const task = createTask(db, {
        title: '今天完成',
        deadlineAt: '2026-05-17T08:00:00.000Z'
      });
      expect(listTodayTasks(db, '2026-05-17T01:00:00.000Z')).toHaveLength(1);

      completeTask(db, task.id, 'codex', '2026-05-17T02:00:00.000Z');
      expect(listTodayTasks(db, '2026-05-17T03:00:00.000Z')).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('TC-TODAY-002 excludes future scheduled tasks from Today', () => {
    const { db, close } = createTestDb();
    try {
      createTask(db, {
        title: '未来再做',
        status: 'scheduled',
        startAt: '2026-05-20T08:00:00.000Z'
      });
      expect(listTodayTasks(db, '2026-05-17T03:00:00.000Z')).toHaveLength(0);
    } finally {
      close();
    }
  });
});
