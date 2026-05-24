import { describe, expect, it } from 'vitest';
import {
  createMessageRecipient,
  dispatchDueMessages,
  FakeMessageProvider,
  queueTaskMessage,
  WeComAppMessageProvider
} from '../src/services/messages.js';
import { createTask } from '../src/services/tasks.js';
import { createTestDb } from './helpers/db.js';

describe('Message dispatch', () => {
  it('queues and dispatches a due task message with the fake provider', async () => {
    const { db, close } = createTestDb();
    try {
      const recipient = createMessageRecipient(db, {
        displayName: 'Alice',
        provider: 'fake',
        channel: 'wecom_user',
        externalId: 'alice'
      });
      const task = createTask(db, {
        title: '整理项目状态',
        notes: '请今天发一版摘要',
        reminderAt: '2026-05-17T10:00:00.000Z'
      });

      const queued = queueTaskMessage(
        db,
        {
          taskId: task.id,
          recipientId: recipient.id
        },
        'test',
        '2026-05-17T09:00:00.000Z'
      );

      expect(queued.scheduled_at).toBe('2026-05-17T10:00:00.000Z');
      expect(queued.body).toContain('任务分发：整理项目状态');

      const results = await dispatchDueMessages(db, new FakeMessageProvider(), {
        now: '2026-05-17T10:00:00.000Z'
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('sent');
      expect(results[0].item.send_status).toBe('sent');
      expect(results[0].item.external_id).toBe(`fake-${queued.id}`);

      const events = db
        .prepare('select event_type from task_events where task_id = ?')
        .all(task.id)
        .map((row) => row.event_type);
      expect(events).toContain('message_queued');
      expect(events).toContain('message_sent');
    } finally {
      close();
    }
  });

  it('does not dispatch future messages', async () => {
    const { db, close } = createTestDb();
    try {
      const recipient = createMessageRecipient(db, {
        displayName: 'Alice',
        provider: 'fake',
        channel: 'wecom_user',
        externalId: 'alice'
      });
      const task = createTask(db, { title: '明天提醒 Alice' });
      queueTaskMessage(
        db,
        {
          taskId: task.id,
          recipientId: recipient.id,
          scheduledAt: '2026-05-18T10:00:00.000Z'
        },
        'test',
        '2026-05-17T09:00:00.000Z'
      );

      const results = await dispatchDueMessages(db, new FakeMessageProvider(), {
        now: '2026-05-17T10:00:00.000Z'
      });

      expect(results).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('uses WeCom token and message endpoints for self-built app messages', async () => {
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const fetcher = async (
      url: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string }
    ) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async json() {
          if (url.includes('/gettoken')) {
            return { errcode: 0, errmsg: 'ok', access_token: 'token-1', expires_in: 7200 };
          }
          return { errcode: 0, errmsg: 'ok' };
        }
      };
    };
    const provider = new WeComAppMessageProvider('corp-id', 'secret', 1000002, fetcher);

    const result = await provider.sendText({
      outboxId: 'outbox-1',
      recipient: {
        id: 'recipient-1',
        display_name: 'Alice',
        provider: 'wecom_app',
        channel: 'wecom_user',
        external_id: 'alice',
        metadata_json: null,
        created_at: '2026-05-17T00:00:00.000Z',
        updated_at: '2026-05-17T00:00:00.000Z'
      },
      body: 'hello'
    });

    expect(result.externalId).toBe('wecom_app-outbox-1');
    expect(calls[0].url).toContain('/cgi-bin/gettoken');
    expect(calls[1].url).toContain('/cgi-bin/message/send');
    expect(calls[1].body).toMatchObject({
      touser: 'alice',
      msgtype: 'text',
      agentid: 1000002,
      text: { content: 'hello' }
    });
  });
});
