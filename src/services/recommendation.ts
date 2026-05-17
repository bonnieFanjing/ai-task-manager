import type { DatabaseSync } from 'node:sqlite';
import type { Recommendation, RecommendationContext, Task } from '../domain/types.js';
import { listTasks } from './tasks.js';

function isFutureStart(task: Task, now: string): boolean {
  return Boolean(task.start_at && task.start_at > now);
}

function isDueToday(task: Task, now: string): boolean {
  return Boolean(task.deadline_at && task.deadline_at.slice(0, 10) === now.slice(0, 10));
}

function isOverdue(task: Task, now: string): boolean {
  return Boolean(task.deadline_at && task.deadline_at < now);
}

function normalizeLocation(value: string): string {
  const lower = value.trim().toLowerCase();
  if (['home', 'house', '家', '在家'].includes(lower)) return 'home';
  if (['hospital', 'clinic', '医院', '妇幼', '妇幼保健院', '诊所'].includes(lower)) return 'hospital';
  if (['office', 'work', '公司', '办公室'].includes(lower)) return 'office';
  return lower;
}

function locationMatches(taskLocation: string, currentLocation: string): boolean {
  const task = normalizeLocation(taskLocation);
  const current = normalizeLocation(currentLocation);
  if (task === current) return true;

  if (current === 'hospital') {
    return task.includes('医院') || task.includes('妇幼') || task.includes('clinic');
  }

  if (current === 'home') {
    return task.includes('家') || task.includes('home');
  }

  if (current === 'office') {
    return task.includes('公司') || task.includes('办公室') || task.includes('work');
  }

  return task.includes(current) || current.includes(task);
}

export function recommendNow(db: DatabaseSync, context: RecommendationContext = {}): Recommendation[] {
  const now = context.now ?? new Date().toISOString();
  const candidates = listTasks(db).filter((task) => {
    if (['completed', 'canceled', 'trash'].includes(task.status)) return false;
    if (!context.includeWaiting && (task.status === 'waiting' || task.waiting_for)) return false;
    if (isFutureStart(task, now) && !isDueToday(task, now) && !isOverdue(task, now)) return false;
    return true;
  });

  return candidates
    .map((task) => scoreTask(task, context, now))
    .filter((recommendation) => recommendation.score > -100)
    .sort((a, b) => b.score - a.score || a.task.created_at.localeCompare(b.task.created_at));
}

function scoreTask(task: Task, context: RecommendationContext, now: string): Recommendation {
  let score = 0;
  const reasons: string[] = [];

  // The first-pass recommender is intentionally transparent: every weight below
  // also records a human-readable reason so users can understand why an item won.
  if (isOverdue(task, now)) {
    score += 80;
    reasons.push('deadline has passed');
  } else if (isDueToday(task, now)) {
    score += 60;
    reasons.push('deadline is today');
  }

  score += task.importance * 8;
  score += task.urgency * 6;
  reasons.push(`importance ${task.importance}, urgency ${task.urgency}`);

  if (task.status === 'today') {
    score += 20;
    reasons.push('already planned for today');
  }

  if (context.availableMinutes && task.estimated_minutes) {
    if (task.estimated_minutes <= context.availableMinutes) {
      score += 18;
      reasons.push('fits available time');
    } else {
      score -= 25;
      reasons.push('estimated time is longer than available time');
    }
  }

  if (task.requires_computer) {
    if (context.hasComputer) {
      score += 15;
      reasons.push('computer is available');
    } else {
      score -= 80;
      reasons.push('requires computer');
    }
  }

  if (context.onCommute) {
    if (task.can_do_on_commute) {
      score += 25;
      reasons.push('works during commute');
    } else if (task.requires_quiet || task.requires_computer) {
      score -= 30;
      reasons.push('not suitable for commute');
    }
  }

  if (context.energyLevel && task.energy_level) {
    if (context.energyLevel === task.energy_level) {
      score += 10;
      reasons.push('matches current energy');
    } else if (context.energyLevel === 'low' && task.energy_level === 'high') {
      score -= 15;
      reasons.push('requires higher energy');
    }
  }

  if (context.currentLocation && task.location_hint) {
    if (locationMatches(task.location_hint, context.currentLocation)) {
      score += 12;
      reasons.push(`matches location ${task.location_hint}`);
    } else {
      score -= 250;
      reasons.push(`requires location ${task.location_hint}`);
    }
  }

  return { task, score, reasons };
}
