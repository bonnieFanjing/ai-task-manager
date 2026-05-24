import { describe, expect, it } from 'vitest';
import { recommendNow } from '../src/services/recommendation.js';
import { createTask } from '../src/services/tasks.js';
import { createTestDb } from './helpers/db.js';

describe('Recommendation service', () => {
  it('TC-REC-001 recommends commute-friendly task on bus', () => {
    const { db, close } = createTestDb();
    try {
      const computerTask = createTask(db, {
        title: '整理电脑文件',
        estimatedMinutes: 30,
        requirements: { requiresComputer: true }
      });
      const commuteTask = createTask(db, {
        title: '阅读文章',
        estimatedMinutes: 10,
        requirements: { canDoOnCommute: true }
      });

      const recommendations = recommendNow(db, {
        onCommute: true,
        availableMinutes: 20,
        hasComputer: false,
        now: '2026-05-17T03:00:00.000Z'
      });

      expect(recommendations[0].task.id).toBe(commuteTask.id);
      expect(recommendations.find((item) => item.task.id === computerTask.id)?.score).toBeLessThan(
        recommendations[0].score
      );
    } finally {
      close();
    }
  });

  it('TC-TASK-002 excludes waiting task by default', () => {
    const { db, close } = createTestDb();
    try {
      createTask(db, { title: '等别人回复', status: 'waiting', waitingFor: 'Alice' });
      createTask(db, { title: '自己能做的事' });

      const recommendations = recommendNow(db, { now: '2026-05-17T03:00:00.000Z' });
      expect(recommendations.map((item) => item.task.title)).toEqual(['自己能做的事']);
    } finally {
      close();
    }
  });

  it('does not recommend location-bound hospital tasks while at home', () => {
    const { db, close } = createTestDb();
    try {
      createTask(db, {
        title: '在家能做的事',
        status: 'today'
      });
      createTask(db, {
        title: '去医院检查',
        status: 'today',
        deadlineAt: '2026-01-15T00:00:00+08:00',
        requirements: { locationHint: '医院' }
      });

      const recommendations = recommendNow(db, {
        currentLocation: 'home',
        now: '2026-05-17T03:00:00.000Z'
      });

      expect(recommendations.map((item) => item.task.title)).toEqual(['在家能做的事']);
    } finally {
      close();
    }
  });

  it('does not recommend future scheduled tasks before their reminder time', () => {
    const { db, close } = createTestDb();
    try {
      createTask(db, { title: '现在能做的事' });
      createTask(db, {
        title: '明年5月24日上午10点在山姆买五花肉',
        status: 'scheduled'
      }, 'codex', '2026-05-23T16:52:00.000Z');

      const recommendations = recommendNow(db, {
        now: '2026-05-23T16:52:00.000Z'
      });

      expect(recommendations.map((item) => item.task.title)).toEqual(['现在能做的事']);
    } finally {
      close();
    }
  });
});
