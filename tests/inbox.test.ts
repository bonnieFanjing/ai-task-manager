import { describe, expect, it } from 'vitest';
import { captureInbox, listInbox, updateInboxStatus } from '../src/services/inbox.js';
import { createTestDb } from './helpers/db.js';

describe('Inbox service', () => {
  it('TC-INBOX-001 captures raw Inbox item', () => {
    const { db, close } = createTestDb();
    try {
      const item = captureInbox(db, {
        rawText: '帮我记一下：明天下午还信用卡。',
        source: 'codex',
        now: '2026-05-17T01:00:00.000Z'
      });

      expect(item.raw_text).toBe('帮我记一下：明天下午还信用卡。');
      expect(item.source).toBe('codex');
      expect(item.status).toBe('new');
      expect(listInbox(db)).toHaveLength(1);
    } finally {
      close();
    }
  });

  it('TC-INBOX-003 excludes processed items from default Inbox', () => {
    const { db, close } = createTestDb();
    try {
      const item = captureInbox(db, { rawText: '处理后不应出现在默认 Inbox', source: 'web' });
      updateInboxStatus(db, item.id, 'processed', '2026-05-17T02:00:00.000Z');

      expect(listInbox(db)).toHaveLength(0);
      expect(listInbox(db, 'processed')).toHaveLength(1);
    } finally {
      close();
    }
  });
});

