import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/connection.js';
import type {
  MessageChannel,
  MessageOutboxItem,
  MessageProviderName,
  MessageRecipient,
  Task
} from '../domain/types.js';
import { recordTaskEvent, withTransaction } from './events.js';
import { getTask } from './tasks.js';

type Row = Record<string, unknown>;

export interface MessageProvider {
  provider: MessageProviderName;
  sendText(input: {
    outboxId: string;
    recipient: MessageRecipient;
    body: string;
  }): Promise<{ externalId: string }>;
}

export interface MessageRecipientInput {
  displayName: string;
  provider: MessageProviderName;
  channel: MessageChannel;
  externalId: string;
  metadata?: Record<string, unknown> | null;
}

export interface QueueTaskMessageInput {
  taskId?: string | null;
  recipientId: string;
  provider?: MessageProviderName;
  body?: string | null;
  scheduledAt?: string | null;
}

export interface DispatchMessagesOptions {
  now?: string;
  limit?: number;
  createdBy?: string;
}

export interface MessageDispatchResult {
  item: MessageOutboxItem;
  status: 'sent' | 'failed';
  error?: string;
}

const DEFAULT_DISPATCH_LIMIT = 20;

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function toRecipient(row: Row): MessageRecipient {
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    provider: row.provider as MessageProviderName,
    channel: row.channel as MessageChannel,
    external_id: String(row.external_id),
    metadata_json: nullableString(row.metadata_json),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function toOutboxItem(row: Row): MessageOutboxItem {
  return {
    id: String(row.id),
    task_id: nullableString(row.task_id),
    recipient_id: String(row.recipient_id),
    provider: row.provider as MessageProviderName,
    message_type: 'text',
    body: String(row.body),
    scheduled_at: String(row.scheduled_at),
    send_status: row.send_status as MessageOutboxItem['send_status'],
    external_id: nullableString(row.external_id),
    attempt_count: Number(row.attempt_count),
    last_error: nullableString(row.last_error),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    sent_at: nullableString(row.sent_at)
  };
}

function assertNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
}

function assertValidIso(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function formatTaskMessage(task: Task): string {
  const lines = [`任务分发：${task.title}`];
  if (task.deadline_at) lines.push(`截止时间：${task.deadline_at}`);
  if (task.start_at) lines.push(`开始时间：${task.start_at}`);
  if (task.notes) lines.push('', task.notes);
  lines.push('', `Task ID: ${task.id}`);
  return lines.join('\n').trim();
}

export function createMessageRecipient(
  db: DatabaseSync,
  input: MessageRecipientInput,
  at = nowIso()
): MessageRecipient {
  const id = randomUUID();
  db.prepare(
    `
      insert into message_recipients (
        id, display_name, provider, channel, external_id, metadata_json, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    assertNonEmpty(input.displayName, 'displayName'),
    input.provider,
    input.channel,
    assertNonEmpty(input.externalId, 'externalId'),
    input.metadata ? JSON.stringify(input.metadata) : null,
    at,
    at
  );

  const recipient = getMessageRecipient(db, id);
  if (!recipient) throw new Error('Failed to create message recipient.');
  return recipient;
}

export function getMessageRecipient(db: DatabaseSync, id: string): MessageRecipient | null {
  const row = db.prepare('select * from message_recipients where id = ?').get(id) as Row | undefined;
  return row ? toRecipient(row) : null;
}

export function listMessageRecipients(db: DatabaseSync): MessageRecipient[] {
  return db
    .prepare(
      `
        select *
        from message_recipients
        order by display_name asc, created_at asc
      `
    )
    .all()
    .map((row) => toRecipient(row as Row));
}

export function queueTaskMessage(
  db: DatabaseSync,
  input: QueueTaskMessageInput,
  createdBy = 'api',
  at = nowIso()
): MessageOutboxItem {
  return withTransaction(db, () => {
    const recipient = getMessageRecipient(db, input.recipientId);
    if (!recipient) throw new Error(`Message recipient not found: ${input.recipientId}`);

    const task = input.taskId ? getTask(db, input.taskId) : null;
    if (input.taskId && !task) throw new Error(`Task not found: ${input.taskId}`);

    const provider = input.provider ?? recipient.provider;
    if (provider !== recipient.provider) {
      throw new Error(`Recipient provider is ${recipient.provider}, not ${provider}.`);
    }

    const scheduledAt = input.scheduledAt ?? task?.reminder_at ?? task?.start_at ?? at;
    assertValidIso(scheduledAt, 'scheduledAt');
    const body = assertNonEmpty(input.body ?? (task ? formatTaskMessage(task) : ''), 'message body');
    const id = randomUUID();

    db.prepare(
      `
        insert into message_outbox (
          id, task_id, recipient_id, provider, message_type, body, scheduled_at,
          send_status, external_id, attempt_count, last_error, created_at, updated_at, sent_at
        )
        values (?, ?, ?, ?, 'text', ?, ?, 'pending', null, 0, null, ?, ?, null)
      `
    ).run(id, task?.id ?? null, recipient.id, provider, body, scheduledAt, at, at);

    if (task) {
      recordTaskEvent(db, {
        taskId: task.id,
        eventType: 'message_queued',
        newValue: { outboxId: id, recipientId: recipient.id, provider, scheduledAt },
        createdBy,
        at
      });
    }

    const item = getMessageOutboxItem(db, id);
    if (!item) throw new Error('Failed to queue message.');
    return item;
  });
}

export function getMessageOutboxItem(db: DatabaseSync, id: string): MessageOutboxItem | null {
  const row = db.prepare('select * from message_outbox where id = ?').get(id) as Row | undefined;
  return row ? toOutboxItem(row) : null;
}

export function listMessageOutbox(db: DatabaseSync, limit = 50): MessageOutboxItem[] {
  return db
    .prepare(
      `
        select *
        from message_outbox
        order by scheduled_at desc, created_at desc
        limit ?
      `
    )
    .all(Math.max(1, limit))
    .map((row) => toOutboxItem(row as Row));
}

function claimDueMessages(
  db: DatabaseSync,
  provider: MessageProviderName,
  now: string,
  limit: number
): MessageOutboxItem[] {
  const candidates = db
    .prepare(
      `
        select *
        from message_outbox
        where provider = ?
          and send_status = 'pending'
          and scheduled_at <= ?
        order by scheduled_at asc, created_at asc
        limit ?
      `
    )
    .all(provider, now, Math.max(1, limit))
    .map((row) => toOutboxItem(row as Row));

  const claimed: MessageOutboxItem[] = [];
  for (const item of candidates) {
    const result = db
      .prepare(
        `
          update message_outbox
          set send_status = 'sending', attempt_count = attempt_count + 1, updated_at = ?
          where id = ? and send_status = 'pending'
        `
      )
      .run(now, item.id);
    if (result.changes > 0) {
      const claimedItem = getMessageOutboxItem(db, item.id);
      if (claimedItem) claimed.push(claimedItem);
    }
  }
  return claimed;
}

export async function dispatchDueMessages(
  db: DatabaseSync,
  provider: MessageProvider,
  options: DispatchMessagesOptions = {}
): Promise<MessageDispatchResult[]> {
  const at = options.now ?? nowIso();
  assertValidIso(at, 'now');
  const dueItems = claimDueMessages(db, provider.provider, at, options.limit ?? DEFAULT_DISPATCH_LIMIT);
  const results: MessageDispatchResult[] = [];

  for (const item of dueItems) {
    const recipient = getMessageRecipient(db, item.recipient_id);
    if (!recipient) {
      const updated = markMessageFailed(db, item, 'Message recipient no longer exists.', at);
      results.push({ item: updated, status: 'failed', error: updated.last_error ?? undefined });
      continue;
    }

    try {
      const sent = await provider.sendText({
        outboxId: item.id,
        recipient,
        body: item.body
      });
      const updated = markMessageSent(db, item, sent.externalId, at, options.createdBy ?? 'message-dispatch');
      results.push({ item: updated, status: 'sent' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = markMessageFailed(db, item, message, at, options.createdBy ?? 'message-dispatch');
      results.push({ item: updated, status: 'failed', error: message });
    }
  }

  return results;
}

function markMessageSent(
  db: DatabaseSync,
  item: MessageOutboxItem,
  externalId: string,
  at: string,
  createdBy: string
): MessageOutboxItem {
  db.prepare(
    `
      update message_outbox
      set send_status = 'sent', external_id = ?, last_error = null, sent_at = ?, updated_at = ?
      where id = ?
    `
  ).run(externalId, at, at, item.id);
  recordMessageEvent(db, item, 'message_sent', { externalId }, createdBy, at);
  return getMessageOutboxItem(db, item.id) ?? item;
}

function markMessageFailed(
  db: DatabaseSync,
  item: MessageOutboxItem,
  error: string,
  at: string,
  createdBy = 'message-dispatch'
): MessageOutboxItem {
  db.prepare(
    `
      update message_outbox
      set send_status = 'failed', last_error = ?, updated_at = ?
      where id = ?
    `
  ).run(error, at, item.id);
  recordMessageEvent(db, item, 'message_failed', { error }, createdBy, at);
  return getMessageOutboxItem(db, item.id) ?? item;
}

function recordMessageEvent(
  db: DatabaseSync,
  item: MessageOutboxItem,
  eventType: string,
  newValue: Record<string, unknown>,
  createdBy: string,
  at: string
): void {
  if (!item.task_id) return;
  recordTaskEvent(db, {
    taskId: item.task_id,
    eventType,
    newValue: { outboxId: item.id, ...newValue },
    createdBy,
    at
  });
}

export class FakeMessageProvider implements MessageProvider {
  provider = 'fake' as const;

  async sendText(input: {
    outboxId: string;
    recipient: MessageRecipient;
    body: string;
  }): Promise<{ externalId: string }> {
    if (!input.body.trim()) throw new Error('Cannot send empty message body.');
    return { externalId: `fake-${input.outboxId}` };
  }
}

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json(): Promise<unknown>;
  }>;
}

export class WeComAppMessageProvider implements MessageProvider {
  provider = 'wecom_app' as const;
  private token: { value: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly corpId = process.env.WECOM_CORP_ID ?? '',
    private readonly agentSecret = process.env.WECOM_AGENT_SECRET ?? '',
    private readonly agentId = Number(process.env.WECOM_AGENT_ID),
    private readonly fetcher: FetchLike = fetch
  ) {}

  async sendText(input: {
    outboxId: string;
    recipient: MessageRecipient;
    body: string;
  }): Promise<{ externalId: string }> {
    if (!['wecom_user', 'wecom_party', 'wecom_tag'].includes(input.recipient.channel)) {
      throw new Error(`Unsupported WeCom recipient channel: ${input.recipient.channel}`);
    }
    const accessToken = await this.getAccessToken();
    const payload: Record<string, unknown> = {
      msgtype: 'text',
      agentid: this.agentId,
      text: { content: input.body },
      enable_duplicate_check: 1,
      duplicate_check_interval: 1800
    };
    if (input.recipient.channel === 'wecom_user') payload.touser = input.recipient.external_id;
    if (input.recipient.channel === 'wecom_party') payload.toparty = input.recipient.external_id;
    if (input.recipient.channel === 'wecom_tag') payload.totag = input.recipient.external_id;

    const result = await this.postJson(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`,
      payload
    );
    assertWeComOk(result, 'send message');
    const invalid = ['invaliduser', 'invalidparty', 'invalidtag', 'unlicenseduser']
      .map((field) => [field, result[field]] as const)
      .filter(([, value]) => typeof value === 'string' && value.length > 0);
    if (invalid.length > 0) {
      throw new Error(
        `WeCom rejected recipient: ${invalid.map(([field, value]) => `${field}=${value}`).join(', ')}`
      );
    }
    return { externalId: `wecom_app-${input.outboxId}` };
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAtMs > Date.now()) return this.token.value;
    if (!this.corpId || !this.agentSecret || !Number.isFinite(this.agentId)) {
      throw new Error('WECOM_CORP_ID, WECOM_AGENT_SECRET, and WECOM_AGENT_ID are required.');
    }

    const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');
    url.searchParams.set('corpid', this.corpId);
    url.searchParams.set('corpsecret', this.agentSecret);
    const result = await this.getJson(url.toString());
    assertWeComOk(result, 'get access token');
    const accessToken = typeof result.access_token === 'string' ? result.access_token : '';
    const expiresIn = Number(result.expires_in);
    if (!accessToken) throw new Error('WeCom did not return access_token.');
    this.token = {
      value: accessToken,
      expiresAtMs: Date.now() + Math.max(60, expiresIn - 300) * 1000
    };
    return accessToken;
  }

  private async getJson(url: string): Promise<Record<string, unknown>> {
    const response = await this.fetcher(url);
    return readJsonResponse(response, url);
  }

  private async postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return readJsonResponse(response, url);
  }
}

async function readJsonResponse(
  response: Awaited<ReturnType<FetchLike>>,
  url: string
): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
  }
  const json = await response.json();
  if (!json || typeof json !== 'object') {
    throw new Error(`Invalid JSON response from ${url}`);
  }
  return json as Record<string, unknown>;
}

function assertWeComOk(result: Record<string, unknown>, action: string): void {
  const errcode = Number(result.errcode ?? 0);
  if (errcode !== 0) {
    const errmsg = typeof result.errmsg === 'string' ? result.errmsg : 'unknown error';
    throw new Error(`WeCom ${action} failed: ${errcode} ${errmsg}`);
  }
}
