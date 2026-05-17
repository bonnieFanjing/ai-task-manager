import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso, stringifyJson } from '../db/connection.js';
import type { InboxItem, InboxSource, InboxStatus } from '../domain/types.js';

type Row = Record<string, unknown>;

function toInboxItem(row: Row): InboxItem {
  return {
    id: String(row.id),
    raw_text: String(row.raw_text),
    source: row.source as InboxSource,
    status: row.status as InboxStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    processed_at: row.processed_at ? String(row.processed_at) : null,
    metadata_json: row.metadata_json ? String(row.metadata_json) : null
  };
}

export interface CaptureInboxInput {
  rawText: string;
  source: InboxSource;
  metadata?: unknown;
  now?: string;
}

export function captureInbox(db: DatabaseSync, input: CaptureInboxInput): InboxItem {
  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error('Inbox text is required.');
  }

  const at = input.now ?? nowIso();
  const id = randomUUID();
  db.prepare(
    `
      insert into inbox_items (
        id, raw_text, source, status, created_at, updated_at, processed_at, metadata_json
      )
      values (?, ?, ?, 'new', ?, ?, null, ?)
    `
  ).run(id, rawText, input.source, at, at, stringifyJson(input.metadata));

  const row = db.prepare('select * from inbox_items where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error('Failed to create Inbox item.');
  return toInboxItem(row);
}

export function listInbox(db: DatabaseSync, status: InboxStatus = 'new'): InboxItem[] {
  return db
    .prepare(
      `
        select *
        from inbox_items
        where status = ?
        order by created_at desc
      `
    )
    .all(status)
    .map((row) => toInboxItem(row as Row));
}

export function getInboxItem(db: DatabaseSync, id: string): InboxItem | null {
  const row = db.prepare('select * from inbox_items where id = ?').get(id) as Row | undefined;
  return row ? toInboxItem(row) : null;
}

export function updateInboxStatus(
  db: DatabaseSync,
  id: string,
  status: InboxStatus,
  at = nowIso()
): InboxItem {
  const processedAt = status === 'processed' || status === 'trashed' ? at : null;
  db.prepare(
    `
      update inbox_items
      set status = ?, updated_at = ?, processed_at = ?
      where id = ?
    `
  ).run(status, at, processedAt, id);

  const item = getInboxItem(db, id);
  if (!item) throw new Error(`Inbox item not found: ${id}`);
  return item;
}

