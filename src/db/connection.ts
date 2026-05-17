import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function defaultDatabasePath(): string {
  return resolve(process.cwd(), 'data', 'tasks.sqlite');
}

export function getDatabasePath(path?: string): string {
  // TASK_DB_PATH lets tests, demos, and deployments use separate databases without
  // touching a user's private local task store.
  return path ?? process.env.TASK_DB_PATH ?? defaultDatabasePath();
}

export function openDatabase(path?: string): DatabaseSync {
  const databasePath = getDatabasePath(path);
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  return JSON.parse(value) as T;
}

export function stringifyJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}
