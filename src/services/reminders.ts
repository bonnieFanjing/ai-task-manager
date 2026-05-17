import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/connection.js';
import { getTask } from './tasks.js';

type Row = Record<string, unknown>;

export interface ReminderSync {
  id: string;
  task_id: string;
  provider: 'apple_reminders' | 'telegram' | 'email' | 'fake';
  external_id: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'disabled';
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderProvider {
  provider: ReminderSync['provider'];
  upsertReminder(input: {
    taskId: string;
    title: string;
    notes: string | null;
    reminderAt: string;
    externalId: string | null;
  }): Promise<{ externalId: string }>;
}

export class FakeReminderProvider implements ReminderProvider {
  provider = 'fake' as const;

  async upsertReminder(input: {
    taskId: string;
    title: string;
    notes: string | null;
    reminderAt: string;
    externalId: string | null;
  }): Promise<{ externalId: string }> {
    return { externalId: input.externalId ?? `fake-${input.taskId}` };
  }
}

function toReminderSync(row: Row): ReminderSync {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    provider: row.provider as ReminderSync['provider'],
    external_id: row.external_id ? String(row.external_id) : null,
    sync_status: row.sync_status as ReminderSync['sync_status'],
    last_synced_at: row.last_synced_at ? String(row.last_synced_at) : null,
    last_error: row.last_error ? String(row.last_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

export function getReminderSync(
  db: DatabaseSync,
  taskId: string,
  provider: ReminderSync['provider']
): ReminderSync | null {
  const row = db
    .prepare('select * from reminder_syncs where task_id = ? and provider = ?')
    .get(taskId, provider) as Row | undefined;
  return row ? toReminderSync(row) : null;
}

export async function syncTaskReminder(
  db: DatabaseSync,
  taskId: string,
  provider: ReminderProvider,
  at = nowIso()
): Promise<ReminderSync> {
  const task = getTask(db, taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!task.reminder_at) throw new Error(`Task has no reminder_at: ${taskId}`);

  const existing = getReminderSync(db, taskId, provider.provider);

  try {
    const result = await provider.upsertReminder({
      taskId,
      title: task.title,
      notes: task.notes,
      reminderAt: task.reminder_at,
      externalId: existing?.external_id ?? null
    });

    if (existing) {
      db.prepare(
        `
          update reminder_syncs
          set external_id = ?, sync_status = 'synced', last_synced_at = ?,
              last_error = null, updated_at = ?
          where id = ?
        `
      ).run(result.externalId, at, at, existing.id);
    } else {
      db.prepare(
        `
          insert into reminder_syncs (
            id, task_id, provider, external_id, sync_status, last_synced_at,
            last_error, created_at, updated_at
          )
          values (?, ?, ?, ?, 'synced', ?, null, ?, ?)
        `
      ).run(randomUUID(), taskId, provider.provider, result.externalId, at, at, at);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (existing) {
      db.prepare(
        `
          update reminder_syncs
          set sync_status = 'failed', last_error = ?, updated_at = ?
          where id = ?
        `
      ).run(message, at, existing.id);
    } else {
      db.prepare(
        `
          insert into reminder_syncs (
            id, task_id, provider, external_id, sync_status, last_synced_at,
            last_error, created_at, updated_at
          )
          values (?, ?, ?, null, 'failed', null, ?, ?, ?)
        `
      ).run(randomUUID(), taskId, provider.provider, message, at, at);
    }
  }

  const sync = getReminderSync(db, taskId, provider.provider);
  if (!sync) throw new Error('Reminder sync row was not created.');
  return sync;
}

