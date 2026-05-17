import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';
import { createTestDb } from './helpers/db.js';

describe('API', () => {
  it('creates and lists Inbox items', async () => {
    const { db, close } = createTestDb();
    try {
      const app = createApp(db);
      const created = await request(app)
        .post('/api/inbox')
        .send({ rawText: '明天下午还信用卡', source: 'api' })
        .expect(201);

      expect(created.body.item.raw_text).toBe('明天下午还信用卡');

      const listed = await request(app).get('/api/inbox').expect(200);
      expect(listed.body.items).toHaveLength(1);
    } finally {
      close();
    }
  });

  it('converts Inbox item and returns Today deadline', async () => {
    const { db, close } = createTestDb();
    try {
      const app = createApp(db);
      const created = await request(app)
        .post('/api/inbox')
        .send({ rawText: '今天还信用卡', source: 'api' })
        .expect(201);

      await request(app)
        .post(`/api/inbox/${created.body.item.id}/convert`)
        .send({
          task: {
            title: '还信用卡',
            deadlineAt: '2026-05-17T10:00:00.000Z'
          }
        })
        .expect(201);

      const today = await request(app)
        .get('/api/tasks/today?now=2026-05-17T08:00:00.000Z')
        .expect(200);
      expect(today.body.tasks[0].title).toBe('还信用卡');
    } finally {
      close();
    }
  });

  it('TC-SEC-001 rejects unauthenticated request when API_TOKEN is set', async () => {
    const { db, close } = createTestDb();
    const previous = process.env.API_TOKEN;
    process.env.API_TOKEN = 'secret-test-token';
    try {
      const app = createApp(db);
      await request(app)
        .post('/api/inbox')
        .send({ rawText: '未认证不应写入', source: 'api' })
        .expect(401);

      await request(app)
        .post('/api/inbox')
        .set('x-api-token', 'secret-test-token')
        .send({ rawText: '认证后写入', source: 'api' })
        .expect(201);
    } finally {
      if (previous === undefined) {
        delete process.env.API_TOKEN;
      } else {
        process.env.API_TOKEN = previous;
      }
      close();
    }
  });
});
