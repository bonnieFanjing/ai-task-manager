import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/connection.js';
import type { Task } from '../domain/types.js';
import { recordTaskEvent, withTransaction } from './events.js';
import { type ReminderProvider, upsertStandaloneReminder } from './reminders.js';
import { getTask, listAiDelegatedTasks, listCompletedAiDelegatedTasksSince } from './tasks.js';

const DEFAULT_AI_LABEL = '[AI]';
const DEFAULT_READY_LIMIT = 10;

export interface AiScanOptions {
  now?: string;
  labelPrefix?: string;
  readyLimit?: number;
  createdBy?: string;
}

export interface AiScanReport {
  generatedAt: string;
  labelPrefix: string;
  labeledTasks: Task[];
  completedTasks: Task[];
  activeTasks: Task[];
  readyTasks: Task[];
  futureTasks: Task[];
  decisionTasks: Task[];
}

export interface SyncedAiReminder {
  kind: 'daily_report' | 'decision';
  taskId: string;
  title: string;
  reminderAt: string;
  externalId: string | null;
  syncStatus: 'synced' | 'failed';
  error?: string;
}

export interface SyncAiReminderOptions {
  now?: string;
  dailyAt?: string;
  decisionAt?: string;
}

function hasAiLabel(title: string, labelPrefix: string): boolean {
  const trimmed = title.trimStart();
  return trimmed.startsWith(`${labelPrefix} `) || trimmed.startsWith(`${labelPrefix}:`);
}

function withAiLabel(title: string, labelPrefix: string): string {
  return hasAiLabel(title, labelPrefix) ? title : `${labelPrefix} ${title}`;
}

function isInactive(task: Task): boolean {
  return ['completed', 'canceled', 'trash'].includes(task.status);
}

function isFutureIso(value: string | null, now: string): boolean {
  if (!value) return false;
  const valueMs = Date.parse(value);
  const nowMs = Date.parse(now);
  return !Number.isNaN(valueMs) && !Number.isNaN(nowMs) && valueMs > nowMs;
}

function isFutureScheduled(task: Task, now: string): boolean {
  if (task.status !== 'scheduled') return false;
  return isFutureIso(task.start_at ?? task.reminder_at ?? task.deadline_at, now);
}

function needsUserDecision(task: Task): boolean {
  if (task.status === 'waiting' || task.waiting_for) return true;
  const notes = task.notes ?? '';
  return /待确认|待决策|需.{0,8}确认|需.{0,8}决策|需要决策|需要你|需你判断|需要我|需我判断|需本人|需要判断/.test(
    notes
  );
}

function sortAiTasks(a: Task, b: Task): number {
  const statusRank = new Map([
    ['today', 0],
    ['next', 1],
    ['scheduled', 2],
    ['waiting', 3],
    ['someday', 4]
  ]);
  return (
    (statusRank.get(a.status) ?? 9) - (statusRank.get(b.status) ?? 9) ||
    b.urgency - a.urgency ||
    b.importance - a.importance ||
    a.created_at.localeCompare(b.created_at)
  );
}

function parseClock(value: string | undefined, fallback: string): { hour: number; minute: number } {
  const source = value ?? fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(source);
  if (!match) return parseClock(fallback, '21:00');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return parseClock(fallback, '21:00');
  return { hour, minute };
}

function nextLocalClock(now: string, clock: string | undefined, fallback: string): string {
  const { hour, minute } = parseClock(clock, fallback);
  const base = new Date(now);
  const candidate = new Date(base);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= base.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString();
}

function dayKey(now: string): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDayIso(now: string): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function taskLine(task: Task): string {
  const note = task.notes?.split('\n').find((line) => line.startsWith('AI协作:'));
  return `- ${task.title}${note ? `（${note.replace(/^AI协作:\s*/, '')}）` : ''}`;
}

async function tryUpsertStandaloneReminder(
  provider: ReminderProvider,
  input: {
    id: string;
    title: string;
    notes: string | null;
    reminderAt: string;
  }
): Promise<{ externalId: string | null; syncStatus: 'synced' | 'failed'; error?: string }> {
  try {
    const result = await upsertStandaloneReminder(provider, input);
    return { externalId: result.externalId, syncStatus: 'synced' };
  } catch (error) {
    return {
      externalId: null,
      syncStatus: 'failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function labelAiDelegatedTasks(
  db: DatabaseSync,
  labelPrefix = DEFAULT_AI_LABEL,
  createdBy = 'ai-scan',
  at = nowIso()
): Task[] {
  return withTransaction(db, () => {
    const changed: Task[] = [];
    for (const task of listAiDelegatedTasks(db)) {
      if (isInactive(task) || hasAiLabel(task.title, labelPrefix)) continue;

      const nextTitle = withAiLabel(task.title, labelPrefix);
      db.prepare('update tasks set title = ?, updated_at = ? where id = ?').run(nextTitle, at, task.id);
      recordTaskEvent(db, {
        taskId: task.id,
        eventType: 'ai_label_added',
        oldValue: { title: task.title },
        newValue: { title: nextTitle },
        createdBy,
        at
      });

      const updated = getTask(db, task.id);
      if (updated) changed.push(updated);
    }
    return changed;
  });
}

export function scanAiTasks(db: DatabaseSync, options: AiScanOptions = {}): AiScanReport {
  const generatedAt = options.now ?? nowIso();
  const labelPrefix = options.labelPrefix ?? DEFAULT_AI_LABEL;
  const readyLimit = options.readyLimit ?? DEFAULT_READY_LIMIT;
  const labeledTasks = labelAiDelegatedTasks(db, labelPrefix, options.createdBy ?? 'ai-scan', generatedAt);
  const completedTasks = listCompletedAiDelegatedTasksSince(db, startOfLocalDayIso(generatedAt));
  const activeTasks = listAiDelegatedTasks(db).filter((task) => !isInactive(task)).sort(sortAiTasks);
  const decisionTasks = activeTasks.filter(needsUserDecision).sort(sortAiTasks);
  const futureTasks = activeTasks.filter((task) => isFutureScheduled(task, generatedAt)).sort(sortAiTasks);
  const blockedIds = new Set([...decisionTasks, ...futureTasks].map((task) => task.id));
  const readyTasks = activeTasks
    .filter((task) => !blockedIds.has(task.id))
    .sort(sortAiTasks)
    .slice(0, Math.max(0, readyLimit));

  return {
    generatedAt,
    labelPrefix,
    labeledTasks,
    completedTasks,
    activeTasks,
    readyTasks,
    futureTasks,
    decisionTasks
  };
}

export function buildAiDailyReportNotes(report: AiScanReport): string {
  const lines = [
    `扫描时间：${report.generatedAt}`,
    `AI任务总数：${report.activeTasks.length}`,
    `今日已完成：${report.completedTasks.length}`,
    `本次新加标签：${report.labeledTasks.length}`,
    `待AI推进：${report.readyTasks.length}`,
    `定时未来任务：${report.futureTasks.length}`,
    `需要你判断：${report.decisionTasks.length}`,
    ''
  ];

  if (report.completedTasks.length > 0) {
    lines.push('今日已完成：', ...report.completedTasks.map(taskLine), '');
  }
  if (report.labeledTasks.length > 0) {
    lines.push('本次新加AI标签：', ...report.labeledTasks.map(taskLine), '');
  }
  if (report.readyTasks.length > 0) {
    lines.push('下一批AI可推进：', ...report.readyTasks.map(taskLine), '');
  }
  if (report.decisionTasks.length > 0) {
    lines.push('需要你判断：', ...report.decisionTasks.map(taskLine), '');
  }
  if (report.futureTasks.length > 0) {
    lines.push('已排期，暂不提前处理：', ...report.futureTasks.slice(0, 5).map(taskLine), '');
  }

  return lines.join('\n').trim();
}

export async function syncAiScanReminders(
  report: AiScanReport,
  provider: ReminderProvider,
  options: SyncAiReminderOptions = {}
): Promise<SyncedAiReminder[]> {
  const now = options.now ?? report.generatedAt;
  const synced: SyncedAiReminder[] = [];
  const dailyReminderAt = nextLocalClock(now, options.dailyAt, '21:00');
  const dailyTaskId = `ai-daily-${dayKey(dailyReminderAt)}`;
  const dailyTitle = `AI任务日报：完成 ${report.completedTasks.length} / 待推进 ${report.readyTasks.length} / 需判断 ${report.decisionTasks.length}`;
  const dailyResult = await tryUpsertStandaloneReminder(provider, {
    id: dailyTaskId,
    title: dailyTitle,
    notes: buildAiDailyReportNotes(report),
    reminderAt: dailyReminderAt
  });
  synced.push({
    kind: 'daily_report',
    taskId: dailyTaskId,
    title: dailyTitle,
    reminderAt: dailyReminderAt,
    externalId: dailyResult.externalId,
    syncStatus: dailyResult.syncStatus,
    error: dailyResult.error
  });

  for (const task of report.decisionTasks) {
    const reminderAt =
      task.reminder_at && isFutureIso(task.reminder_at, now)
        ? task.reminder_at
        : nextLocalClock(now, options.decisionAt, '10:00');
    const title = `AI任务需要你判断：${task.title}`;
    const result = await tryUpsertStandaloneReminder(provider, {
      id: `ai-decision-${task.id}`,
      title,
      notes: task.notes,
      reminderAt
    });
    synced.push({
      kind: 'decision',
      taskId: task.id,
      title,
      reminderAt,
      externalId: result.externalId,
      syncStatus: result.syncStatus,
      error: result.error
    });
  }

  return synced;
}
