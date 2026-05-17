import { describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/db.js';

describe('database migrations', () => {
  it('TC-DB-001 creates a fresh database schema', () => {
    const { db, close } = createTestDb();
    try {
      const tables = db
        .prepare("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => String(row.name));

      expect(tables).toContain('inbox_items');
      expect(tables).toContain('tasks');
      expect(tables).toContain('task_events');
      expect(tables).toContain('ai_suggestions');
      expect(tables).toContain('reminder_syncs');
    } finally {
      close();
    }
  });
});

