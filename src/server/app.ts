import express, { type Request, type Response, type NextFunction } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { createAiSuggestion, acceptAiSuggestionForTask } from '../services/aiSuggestions.js';
import { captureInbox, listInbox, updateInboxStatus } from '../services/inbox.js';
import { recommendNow } from '../services/recommendation.js';
import { FakeReminderProvider, syncTaskReminder } from '../services/reminders.js';
import { completeTask, convertInboxToTask, createTask, listTodayTasks } from '../services/tasks.js';

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.API_TOKEN;
  if (!token) {
    next();
    return;
  }

  const authHeader = req.header('authorization');
  const apiToken = req.header('x-api-token');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (apiToken === token || bearer === token) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createApp(db: DatabaseSync): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api', requireAuth);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/inbox', (req, res) => {
    const item = captureInbox(db, {
      rawText: String(req.body.rawText ?? req.body.raw_text ?? ''),
      source: req.body.source ?? 'api',
      metadata: req.body.metadata
    });
    res.status(201).json({ item });
  });

  app.get('/api/inbox', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'new';
    res.json({ items: listInbox(db, status as Parameters<typeof listInbox>[1]) });
  });

  app.patch('/api/inbox/:id', (req, res) => {
    const item = updateInboxStatus(db, req.params.id, req.body.status);
    res.json({ item });
  });

  app.post('/api/inbox/:id/convert', (req, res) => {
    const task = convertInboxToTask(db, req.params.id, req.body.task, req.body.createdBy ?? 'api');
    res.status(201).json({ task });
  });

  app.post('/api/tasks', (req, res) => {
    const task = createTask(db, req.body.task, req.body.createdBy ?? 'api');
    res.status(201).json({ task });
  });

  app.post('/api/tasks/:id/complete', (req, res) => {
    const task = completeTask(db, req.params.id, req.body.createdBy ?? 'api');
    res.json({ task });
  });

  app.get('/api/tasks/today', (req, res) => {
    const now = typeof req.query.now === 'string' ? req.query.now : undefined;
    res.json({ tasks: listTodayTasks(db, now) });
  });

  app.post('/api/recommendations/now', (req, res) => {
    res.json({ recommendations: recommendNow(db, req.body.context ?? {}) });
  });

  app.post('/api/ai-suggestions', (req, res) => {
    const suggestion = createAiSuggestion(db, req.body);
    res.status(201).json({ suggestion });
  });

  app.post('/api/ai-suggestions/:id/accept-task', (req, res) => {
    const suggestion = acceptAiSuggestionForTask(
      db,
      req.params.id,
      req.body.taskId,
      req.body.fields,
      req.body.createdBy ?? 'api'
    );
    res.json({ suggestion });
  });

  app.post(
    '/api/tasks/:id/sync-reminder',
    asyncHandler(async (req, res) => {
      const provider = new FakeReminderProvider();
      const sync = await syncTaskReminder(db, String(req.params.id), provider);
      res.json({ sync });
    })
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  });

  return app;
}
