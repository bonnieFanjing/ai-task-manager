import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso, stringifyJson } from '../db/connection.js';
import type { TaskInput } from '../domain/types.js';
import { recordTaskEvent } from './events.js';
import { updateTaskFields } from './tasks.js';

type Row = Record<string, unknown>;

export interface AiSuggestion {
  id: string;
  target_type: 'inbox_item' | 'task' | 'project';
  target_id: string;
  provider: string;
  model: string;
  prompt_version: string;
  suggestion_json: string;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

export interface SuggestionInput {
  targetType: AiSuggestion['target_type'];
  targetId: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  suggestion: unknown;
  now?: string;
}

function toSuggestion(row: Row): AiSuggestion {
  return {
    id: String(row.id),
    target_type: row.target_type as AiSuggestion['target_type'],
    target_id: String(row.target_id),
    provider: String(row.provider),
    model: String(row.model),
    prompt_version: String(row.prompt_version),
    suggestion_json: String(row.suggestion_json),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    rejected_at: row.rejected_at ? String(row.rejected_at) : null,
    created_at: String(row.created_at)
  };
}

export function createAiSuggestion(db: DatabaseSync, input: SuggestionInput): AiSuggestion {
  const at = input.now ?? nowIso();
  const id = randomUUID();
  db.prepare(
    `
      insert into ai_suggestions (
        id, target_type, target_id, provider, model, prompt_version, suggestion_json,
        accepted_at, rejected_at, created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, null, null, ?)
    `
  ).run(
    id,
    input.targetType,
    input.targetId,
    input.provider ?? 'mock',
    input.model ?? 'manual',
    input.promptVersion ?? 'v1',
    stringifyJson(input.suggestion),
    at
  );

  const row = db.prepare('select * from ai_suggestions where id = ?').get(id) as Row | undefined;
  if (!row) throw new Error('Failed to create AI suggestion.');
  return toSuggestion(row);
}

export function getAiSuggestion(db: DatabaseSync, id: string): AiSuggestion | null {
  const row = db.prepare('select * from ai_suggestions where id = ?').get(id) as Row | undefined;
  return row ? toSuggestion(row) : null;
}

export function acceptAiSuggestionForTask(
  db: DatabaseSync,
  suggestionId: string,
  taskId: string,
  fields: Partial<TaskInput>,
  createdBy = 'api',
  at = nowIso()
): AiSuggestion {
  const suggestion = getAiSuggestion(db, suggestionId);
  if (!suggestion) throw new Error(`AI suggestion not found: ${suggestionId}`);
  if (suggestion.accepted_at) throw new Error(`AI suggestion already accepted: ${suggestionId}`);

  updateTaskFields(db, taskId, fields, createdBy, at);
  db.prepare('update ai_suggestions set accepted_at = ? where id = ?').run(at, suggestionId);
  recordTaskEvent(db, {
    taskId,
    eventType: 'ai_suggestion_accepted',
    newValue: { suggestionId, fields },
    createdBy,
    at
  });

  const updated = getAiSuggestion(db, suggestionId);
  if (!updated) throw new Error(`AI suggestion not found after accept: ${suggestionId}`);
  return updated;
}
