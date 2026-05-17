import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '0001_core_schema',
    sql: `
      create table if not exists inbox_items (
        id text primary key,
        raw_text text not null,
        source text not null check (source in ('codex', 'web', 'shortcut', 'api', 'import', 'cli')),
        status text not null check (status in ('new', 'processing', 'processed', 'trashed')),
        created_at text not null,
        updated_at text not null,
        processed_at text,
        metadata_json text
      );

      create index if not exists idx_inbox_items_status_created
        on inbox_items(status, created_at desc);

      create table if not exists tasks (
        id text primary key,
        title text not null,
        notes text,
        source_inbox_id text references inbox_items(id),
        status text not null check (
          status in ('inbox', 'next', 'today', 'scheduled', 'waiting', 'someday', 'completed', 'canceled', 'trash')
        ),
        project_id text,
        importance integer not null default 3 check (importance between 1 and 5),
        urgency integer not null default 3 check (urgency between 1 and 5),
        priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
        deadline_at text,
        start_at text,
        reminder_at text,
        repeat_rule text,
        estimated_minutes integer,
        energy_level text check (energy_level in ('low', 'medium', 'high') or energy_level is null),
        delegated_to text,
        waiting_for text,
        created_at text not null,
        updated_at text not null,
        completed_at text,
        deleted_at text
      );

      create index if not exists idx_tasks_status_deadline
        on tasks(status, deadline_at);

      create index if not exists idx_tasks_source_inbox
        on tasks(source_inbox_id);

      create table if not exists task_requirements (
        task_id text primary key references tasks(id) on delete cascade,
        requires_computer integer not null default 0 check (requires_computer in (0, 1)),
        requires_phone integer not null default 0 check (requires_phone in (0, 1)),
        requires_internet integer not null default 0 check (requires_internet in (0, 1)),
        requires_quiet integer not null default 0 check (requires_quiet in (0, 1)),
        can_do_on_commute integer not null default 0 check (can_do_on_commute in (0, 1)),
        can_do_offline integer not null default 0 check (can_do_offline in (0, 1)),
        location_hint text,
        person_hint text,
        metadata_json text
      );

      create table if not exists task_events (
        id text primary key,
        task_id text not null references tasks(id) on delete cascade,
        event_type text not null,
        old_value_json text,
        new_value_json text,
        created_by text not null,
        created_at text not null
      );

      create index if not exists idx_task_events_task_created
        on task_events(task_id, created_at desc);

      create table if not exists ai_suggestions (
        id text primary key,
        target_type text not null check (target_type in ('inbox_item', 'task', 'project')),
        target_id text not null,
        provider text not null,
        model text not null,
        prompt_version text not null,
        suggestion_json text not null,
        accepted_at text,
        rejected_at text,
        created_at text not null
      );

      create index if not exists idx_ai_suggestions_target
        on ai_suggestions(target_type, target_id, created_at desc);

      create table if not exists reminder_syncs (
        id text primary key,
        task_id text not null references tasks(id) on delete cascade,
        provider text not null check (provider in ('apple_reminders', 'telegram', 'email', 'fake')),
        external_id text,
        sync_status text not null check (sync_status in ('pending', 'synced', 'failed', 'disabled')),
        last_synced_at text,
        last_error text,
        created_at text not null,
        updated_at text not null,
        unique(task_id, provider)
      );
    `
  }
];

export function ensureMigrationTable(db: DatabaseSync): void {
  db.exec(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at text not null
    );
  `);
}

export function runMigrations(db: DatabaseSync, now = new Date().toISOString()): string[] {
  ensureMigrationTable(db);
  const applied = new Set(
    db.prepare('select id from schema_migrations').all().map((row) => String(row.id))
  );
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN;');
    try {
      db.exec(migration.sql);
      db.prepare('insert into schema_migrations (id, applied_at) values (?, ?)').run(
        migration.id,
        now
      );
      db.exec('COMMIT;');
      appliedNow.push(migration.id);
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }

  return appliedNow;
}

