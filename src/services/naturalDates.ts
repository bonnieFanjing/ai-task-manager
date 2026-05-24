import type { TaskInput } from '../domain/types.js';

const DEFAULT_TIMEZONE_OFFSET_MINUTES = 8 * 60;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface TimeParts {
  hour: number;
  minute: number;
  hasExplicitTime: boolean;
}

export interface NaturalDateHint {
  dateTime: string;
  hasExplicitTime: boolean;
}

function referenceParts(referenceIso: string): LocalParts {
  const value = Date.parse(referenceIso);
  const date = Number.isNaN(value) ? new Date() : new Date(value + DEFAULT_TIMEZONE_OFFSET_MINUTES * 60_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}

function toUtcIso(parts: LocalParts): string {
  const utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  ) - DEFAULT_TIMEZONE_OFFSET_MINUTES * 60_000;
  return new Date(utc).toISOString();
}

function isValidDate(parts: DateParts): boolean {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() + 1 === parts.month &&
    date.getUTCDate() === parts.day
  );
}

function addDays(reference: LocalParts, days: number): DateParts {
  const utc = Date.UTC(reference.year, reference.month - 1, reference.day + days);
  const date = new Date(utc);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function parseInteger(value: string): number {
  return Number.parseInt(value, 10);
}

function parseChineseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return parseInteger(value);
  const digits: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };
  if (value === '十') return 10;
  if (value.startsWith('十')) {
    const ones = value.slice(1);
    return 10 + (digits[ones] ?? 0);
  }
  if (value.endsWith('十')) {
    const tens = value.slice(0, -1);
    return (digits[tens] ?? 0) * 10;
  }
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return (digits[tens] ?? 0) * 10 + (digits[ones] ?? 0);
  }
  return digits[value] ?? null;
}

function parseTime(text: string): TimeParts {
  const clock = text.match(/(?:^|[^\d])([01]?\d|2[0-3])[:：]([0-5]\d)(?:[^\d]|$)/);
  if (clock) {
    return {
      hour: parseInteger(clock[1]),
      minute: parseInteger(clock[2]),
      hasExplicitTime: true
    };
  }

  const wordTime = text.match(
    /(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚)?\s*([零一二两三四五六七八九十\d]{1,3})\s*[点时](半|([零一二两三四五六七八九十\d]{1,3})分?)?/
  );
  if (!wordTime) return { hour: 9, minute: 0, hasExplicitTime: false };

  const period = wordTime[1] ?? '';
  const parsedHour = parseChineseNumber(wordTime[2]);
  if (parsedHour === null) return { hour: 9, minute: 0, hasExplicitTime: false };

  let hour = parsedHour;
  let minute = 0;
  if (wordTime[3] === '半') {
    minute = 30;
  } else if (wordTime[4]) {
    minute = parseChineseNumber(wordTime[4]) ?? 0;
  }

  if (['下午', '傍晚', '晚上', '今晚'].includes(period) && hour < 12) hour += 12;
  if (period === '中午' && hour < 11) hour += 12;
  if (period === '凌晨' && hour === 12) hour = 0;

  return { hour, minute, hasExplicitTime: true };
}

function parseDate(text: string, reference: LocalParts): DateParts | null {
  const absolute = text.match(/(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})(?:[日号])?/);
  if (absolute) {
    const parts = {
      year: parseInteger(absolute[1]),
      month: parseInteger(absolute[2]),
      day: parseInteger(absolute[3])
    };
    return isValidDate(parts) ? parts : null;
  }

  const relativeYear = text.match(/(今年|明年|后年)\s*(\d{1,2})月(\d{1,2})(?:[日号])?/);
  if (relativeYear) {
    const yearOffset = relativeYear[1] === '明年' ? 1 : relativeYear[1] === '后年' ? 2 : 0;
    const parts = {
      year: reference.year + yearOffset,
      month: parseInteger(relativeYear[2]),
      day: parseInteger(relativeYear[3])
    };
    return isValidDate(parts) ? parts : null;
  }

  const relativeDay = text.match(/大后天|后天|明天|今天/);
  if (relativeDay) {
    const offsets: Record<string, number> = { 今天: 0, 明天: 1, 后天: 2, 大后天: 3 };
    return addDays(reference, offsets[relativeDay[0]]);
  }

  const monthDay = text.match(/(?:^|[^\d])(\d{1,2})[月./-](\d{1,2})(?:[日号])?(?:[^\d]|$)/);
  if (monthDay) {
    const parts = {
      year: reference.year,
      month: parseInteger(monthDay[1]),
      day: parseInteger(monthDay[2])
    };
    return isValidDate(parts) ? parts : null;
  }

  const compact = text.match(/(?:^|[^\d])(\d{2})(\d{2})(?:[^\d]|$)/);
  if (compact) {
    const parts = {
      year: reference.year,
      month: parseInteger(compact[1]),
      day: parseInteger(compact[2])
    };
    return isValidDate(parts) ? parts : null;
  }

  return null;
}

export function parseNaturalDateHint(text: string, referenceIso: string): NaturalDateHint | null {
  const reference = referenceParts(referenceIso);
  const date = parseDate(text, reference);
  if (!date) return null;

  const time = parseTime(text);
  return {
    dateTime: toUtcIso({
      ...date,
      hour: time.hour,
      minute: time.minute
    }),
    hasExplicitTime: time.hasExplicitTime
  };
}

export function enrichTaskInputWithNaturalDates<T extends TaskInput>(
  input: T,
  sourceTexts: string[],
  at: string
): T {
  const text = [input.title, input.notes, ...sourceTexts].filter(Boolean).join('\n');
  const hint = parseNaturalDateHint(text, at);
  if (!hint) return input;

  const next: T = { ...input };
  next.deadlineAt = input.deadlineAt == null ? hint.dateTime : input.deadlineAt;
  next.reminderAt = input.reminderAt == null ? hint.dateTime : input.reminderAt;

  const isFuture = Date.parse(hint.dateTime) > Date.parse(at);
  if (isFuture) {
    next.startAt = input.startAt == null ? hint.dateTime : input.startAt;
    next.status = input.status === undefined || input.status === 'next' ? 'scheduled' : input.status;
  }

  return next;
}
