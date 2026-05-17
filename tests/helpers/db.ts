import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';

export function createTestDb(): { db: DatabaseSync; path: string; close: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'ai-task-manager-'));
  const path = join(dir, 'test.sqlite');
  const db = openDatabase(path);
  runMigrations(db, '2026-05-17T00:00:00.000Z');
  return {
    db,
    path,
    close: () => db.close()
  };
}

