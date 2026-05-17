import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import { captureInbox, listInbox, updateInboxStatus } from './services/inbox.js';
import { recommendNow } from './services/recommendation.js';
import { convertInboxToTask, listAiDelegatedTasks, listTodayTasks } from './services/tasks.js';

function usage(): void {
  console.log(`
Usage:
  npm run task -- inbox add <text>
  npm run task -- inbox list
  npm run task -- inbox process <id>
  npm run task -- inbox trash <id>
  npm run task -- inbox convert <id> <title>
  npm run task -- today
  npm run task -- ai
  npm run task -- recommend --commute --minutes 20 [--computer] [--location home]
`);
}

const args = process.argv.slice(2);
const db = openDatabase();
runMigrations(db);

try {
  const [scope, command, ...rest] = args;
  if (!scope) {
    usage();
    process.exit(0);
  }

  if (scope === 'inbox' && command === 'add') {
    const text = rest.join(' ');
    const item = captureInbox(db, { rawText: text, source: 'cli' });
    console.log(`${item.id}\t${item.raw_text}`);
  } else if (scope === 'inbox' && command === 'list') {
    const items = listInbox(db);
    for (const item of items) {
      console.log(`${item.id}\t${item.created_at}\t${item.raw_text}`);
    }
  } else if (scope === 'inbox' && command === 'process') {
    const item = updateInboxStatus(db, rest[0], 'processed');
    console.log(`${item.id}\t${item.status}`);
  } else if (scope === 'inbox' && command === 'trash') {
    const item = updateInboxStatus(db, rest[0], 'trashed');
    console.log(`${item.id}\t${item.status}`);
  } else if (scope === 'inbox' && command === 'convert') {
    const [id, ...titleParts] = rest;
    const task = convertInboxToTask(db, id, { title: titleParts.join(' ') }, 'cli');
    console.log(`${task.id}\t${task.title}`);
  } else if (scope === 'today') {
    const tasks = listTodayTasks(db);
    for (const task of tasks) {
      console.log(`${task.id}\t${task.deadline_at ?? ''}\t${task.title}`);
    }
  } else if (scope === 'ai') {
    const tasks = listAiDelegatedTasks(db);
    for (const task of tasks) {
      const note = task.notes?.split('\n').find((line) => line.startsWith('AI协作:')) ?? '';
      console.log(`${task.id}\t${task.status}\t${task.title}\t${note}`);
    }
  } else if (scope === 'recommend') {
    const context = {
      onCommute: rest.includes('--commute'),
      hasComputer: rest.includes('--computer'),
      availableMinutes: readNumberFlag(rest, '--minutes'),
      currentLocation: readStringFlag(rest, '--location')
    };
    const recommendations = recommendNow(db, context);
    for (const recommendation of recommendations.slice(0, 5)) {
      console.log(
        `${recommendation.task.id}\t${recommendation.score}\t${recommendation.task.title}\t${recommendation.reasons.join('; ')}`
      );
    }
  } else {
    usage();
  }
} finally {
  db.close();
}

function readNumberFlag(args: string[], flag: string): number | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readStringFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}
