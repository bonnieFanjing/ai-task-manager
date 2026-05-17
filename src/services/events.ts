import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso, stringifyJson } from '../db/connection.js';

export interface EventInput {
  taskId: string;
  eventType: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdBy: string;
  at?: string;
}

export function recordTaskEvent(db: DatabaseSync, input: EventInput): void {
  const at = input.at ?? nowIso();
  db.prepare(
    `
      insert into task_events (
        id, task_id, event_type, old_value_json, new_value_json, created_by, created_at
      )
      values (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    randomUUID(),
    input.taskId,
    input.eventType,
    stringifyJson(input.oldValue),
    stringifyJson(input.newValue),
    input.createdBy,
    at
  );
}

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

