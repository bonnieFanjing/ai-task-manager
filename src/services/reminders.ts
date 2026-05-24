import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { nowIso } from '../db/connection.js';
import { completeTask, getTask, listActiveTasksWithReminders } from './tasks.js';

type Row = Record<string, unknown>;
const execFileAsync = promisify(execFile);
const DEFAULT_APPLE_REMINDERS_LIST = 'AI Task Manager';
const DEFAULT_APPLE_REMINDERS_TIMEOUT_MS = 30_000;

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

export interface ReminderUpsertResult {
  externalId: string;
  completed?: boolean;
}

export interface ReminderProvider {
  provider: ReminderSync['provider'];
  upsertReminder(input: {
    taskId: string;
    title: string;
    notes: string | null;
    reminderAt: string;
    externalId: string | null;
  }): Promise<ReminderUpsertResult>;
}

export async function upsertStandaloneReminder(
  provider: ReminderProvider,
  input: {
    id: string;
    title: string;
    notes: string | null;
    reminderAt: string;
  }
): Promise<ReminderUpsertResult> {
  return provider.upsertReminder({
    taskId: input.id,
    title: input.title,
    notes: input.notes,
    reminderAt: input.reminderAt,
    externalId: null
  });
}

export class FakeReminderProvider implements ReminderProvider {
  provider = 'fake' as const;

  async upsertReminder(input: {
    taskId: string;
    title: string;
    notes: string | null;
    reminderAt: string;
    externalId: string | null;
  }): Promise<ReminderUpsertResult> {
    return { externalId: input.externalId ?? `fake-${input.taskId}` };
  }
}

export class AppleRemindersProvider implements ReminderProvider {
  provider = 'apple_reminders' as const;

  constructor(
    private readonly listName = process.env.REMINDERS_LIST_NAME ?? DEFAULT_APPLE_REMINDERS_LIST,
    private readonly timeoutMs = readTimeoutMs(process.env.REMINDERS_TIMEOUT_MS)
  ) {}

  async upsertReminder(input: {
    taskId: string;
    title: string;
    notes: string | null;
    reminderAt: string;
    externalId: string | null;
  }): Promise<ReminderUpsertResult> {
    const reminderDate = new Date(input.reminderAt);
    if (Number.isNaN(reminderDate.getTime())) {
      throw new Error(`Invalid reminder_at: ${input.reminderAt}`);
    }

    const { stdout } = await execFileAsync(
      '/usr/bin/osascript',
      [
        '-e',
        APPLE_REMINDERS_SCRIPT,
        input.taskId,
        input.title,
        input.notes ?? '',
        input.externalId ?? '',
        this.listName,
        String(reminderDate.getFullYear()),
        String(reminderDate.getMonth() + 1),
        String(reminderDate.getDate()),
        String(reminderDate.getHours()),
        String(reminderDate.getMinutes())
      ],
      { timeout: this.timeoutMs }
    );

    const result = parseAppleReminderOutput(stdout);
    const externalId = result.externalId;
    if (!externalId) {
      throw new Error('Apple Reminders did not return an external id.');
    }
    return result;
  }
}

function parseAppleReminderOutput(stdout: string): ReminderUpsertResult {
  const lines = stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0] === 'completed') return { externalId: lines.slice(1).join('\n'), completed: true };
  if (lines[0] === 'active') return { externalId: lines.slice(1).join('\n'), completed: false };
  return { externalId: stdout.trim(), completed: false };
}

function readTimeoutMs(value: string | undefined): number {
  if (!value) return DEFAULT_APPLE_REMINDERS_TIMEOUT_MS;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_APPLE_REMINDERS_TIMEOUT_MS;
}

const APPLE_REMINDERS_SCRIPT = `
on run argv
  set taskId to item 1 of argv
  set titleText to item 2 of argv
  set notesText to item 3 of argv
  set externalId to item 4 of argv
  set listName to item 5 of argv
  set dueYear to (item 6 of argv) as integer
  set dueMonth to (item 7 of argv) as integer
  set dueDay to (item 8 of argv) as integer
  set dueHour to (item 9 of argv) as integer
  set dueMinute to (item 10 of argv) as integer

  set reminderDate to current date
  set year of reminderDate to dueYear
  set month of reminderDate to dueMonth
  set day of reminderDate to dueDay
  set time of reminderDate to (dueHour * hours + dueMinute * minutes)

  set marker to "Task ID: " & taskId
  if notesText is "" then
    set noteBody to marker
  else if notesText contains marker then
    set noteBody to notesText
  else
    set noteBody to notesText & return & marker
  end if

  tell application "Reminders"
    if not (exists list listName) then
      make new list with properties {name:listName}
    end if

    set targetList to list listName
    set targetReminder to missing value

    if externalId is not "" then
      repeat with candidate in reminders of targetList
        try
          if id of candidate is externalId and body of candidate contains marker then
            set targetReminder to candidate
            exit repeat
          end if
        end try
      end repeat
    end if

    if targetReminder is missing value then
      repeat with candidate in reminders of targetList
        try
          if body of candidate contains marker then
            set targetReminder to candidate
            exit repeat
          end if
        end try
      end repeat
    end if

    if targetReminder is missing value then
      set targetReminder to make new reminder at end of reminders of targetList with properties {name:titleText, body:noteBody, remind me date:reminderDate, due date:reminderDate}
    else
      if completed of targetReminder is true then
        return "completed" & linefeed & id of targetReminder
      end if
      set name of targetReminder to titleText
      set body of targetReminder to noteBody
      set remind me date of targetReminder to reminderDate
      set due date of targetReminder to reminderDate
    end if

    repeat with candidate in reminders of targetList
      try
        if body of candidate contains marker then
          if completed of candidate is true then
            return "completed" & linefeed & id of candidate
          end if
          return "active" & linefeed & id of candidate
        end if
      end try
    end repeat

    return "active" & linefeed & id of targetReminder
  end tell
end run
`;

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

    if (result.completed) {
      completeTask(db, taskId, 'reminder-sync', at);
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

export async function syncActiveTaskReminders(
  db: DatabaseSync,
  provider: ReminderProvider,
  at = nowIso()
): Promise<ReminderSync[]> {
  const tasks = listActiveTasksWithReminders(db);
  const synced: ReminderSync[] = [];
  for (const task of tasks) {
    synced.push(await syncTaskReminder(db, task.id, provider, at));
  }
  return synced;
}
