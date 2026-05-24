import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import { scanAiTasks, syncAiScanReminders } from './services/aiAutomation.js';
import { captureInbox, listInbox, updateInboxStatus } from './services/inbox.js';
import {
  createMessageRecipient,
  dispatchDueMessages,
  FakeMessageProvider,
  listMessageOutbox,
  listMessageRecipients,
  queueTaskMessage,
  WeComAppMessageProvider
} from './services/messages.js';
import { recommendNow } from './services/recommendation.js';
import {
  AppleRemindersProvider,
  FakeReminderProvider,
  syncActiveTaskReminders,
  syncTaskReminder
} from './services/reminders.js';
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
  npm run task -- ai scan [--sync-reminders] [--fake] [--list "AI Task Manager"] [--limit 10]
  npm run task -- recommend --commute --minutes 20 [--computer] [--location home]
  npm run task -- reminder sync <task-id> [--fake] [--list "AI Task Manager"]
  npm run task -- reminder sync-active [--fake] [--list "AI Task Manager"]
  npm run task -- message recipient add <name> --wecom-user <userid> [--fake]
  npm run task -- message recipient add <name> --wecom-party <partyid> [--fake]
  npm run task -- message recipient add <name> --wecom-tag <tagid> [--fake]
  npm run task -- message recipient list
  npm run task -- message queue <task-id> --to <recipient-id> [--at <iso>] [--body <text>]
  npm run task -- message outbox [--limit 50]
  npm run task -- message dispatch [--fake] [--limit 20]
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
  } else if (scope === 'ai' && command === 'scan') {
    const report = scanAiTasks(db, {
      readyLimit: readNumberFlag(rest, '--limit'),
      labelPrefix: readStringFlag(rest, '--label') ?? '[AI]',
      createdBy: 'cli'
    });
    printAiScanReport(report);

    if (rest.includes('--sync-reminders')) {
      const provider = rest.includes('--fake')
        ? new FakeReminderProvider()
        : new AppleRemindersProvider(readStringFlag(rest, '--list'));
      const taskReminders = await syncActiveTaskReminders(db, provider);
      const synced = await syncAiScanReminders(report, provider, {
        dailyAt: readStringFlag(rest, '--daily-at'),
        decisionAt: readStringFlag(rest, '--decision-at')
      });
      console.log('Task reminders:');
      for (const item of taskReminders) {
        console.log(
          `${item.task_id}\t${item.provider}\t${item.sync_status}\t${item.external_id ?? ''}\t${summarizeError(item.last_error ?? undefined)}`
        );
      }
      console.log('Reminders:');
      for (const item of synced) {
        console.log(
          `${item.kind}\t${item.syncStatus}\t${item.taskId}\t${item.reminderAt}\t${item.externalId ?? ''}\t${item.title}\t${summarizeError(item.error)}`
        );
      }
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
  } else if (scope === 'reminder' && command === 'sync') {
    const [taskId, ...flags] = rest;
    const provider = flags.includes('--fake')
      ? new FakeReminderProvider()
      : new AppleRemindersProvider(readStringFlag(flags, '--list'));
    const sync = await syncTaskReminder(db, taskId, provider);
    console.log(
      `${sync.task_id}\t${sync.provider}\t${sync.sync_status}\t${sync.external_id ?? ''}\t${sync.last_error ?? ''}`
    );
  } else if (scope === 'reminder' && command === 'sync-active') {
    const provider = rest.includes('--fake')
      ? new FakeReminderProvider()
      : new AppleRemindersProvider(readStringFlag(rest, '--list'));
    const syncs = await syncActiveTaskReminders(db, provider);
    for (const sync of syncs) {
      console.log(
        `${sync.task_id}\t${sync.provider}\t${sync.sync_status}\t${sync.external_id ?? ''}\t${sync.last_error ?? ''}`
      );
    }
  } else if (scope === 'message' && command === 'recipient') {
    const [recipientCommand, ...flags] = rest;
    if (recipientCommand === 'add') {
      const { displayName, channel, externalId, provider } = parseRecipientAdd(flags);
      const recipient = createMessageRecipient(db, {
        displayName,
        provider,
        channel,
        externalId
      });
      console.log(
        `${recipient.id}\t${recipient.display_name}\t${recipient.provider}\t${recipient.channel}\t${recipient.external_id}`
      );
    } else if (recipientCommand === 'list') {
      for (const recipient of listMessageRecipients(db)) {
        console.log(
          `${recipient.id}\t${recipient.display_name}\t${recipient.provider}\t${recipient.channel}\t${recipient.external_id}`
        );
      }
    } else {
      usage();
    }
  } else if (scope === 'message' && command === 'queue') {
    const [taskId, ...flags] = rest;
    const item = queueTaskMessage(
      db,
      {
        taskId,
        recipientId: readRequiredStringFlag(flags, '--to'),
        body: readStringFlag(flags, '--body'),
        scheduledAt: readStringFlag(flags, '--at')
      },
      'cli'
    );
    console.log(`${item.id}\t${item.send_status}\t${item.scheduled_at}\t${item.recipient_id}`);
  } else if (scope === 'message' && command === 'outbox') {
    for (const item of listMessageOutbox(db, readNumberFlag(rest, '--limit') ?? 50)) {
      console.log(
        `${item.id}\t${item.send_status}\t${item.scheduled_at}\t${item.provider}\t${item.recipient_id}\t${item.task_id ?? ''}\t${item.last_error ?? ''}`
      );
    }
  } else if (scope === 'message' && command === 'dispatch') {
    const provider = rest.includes('--fake') ? new FakeMessageProvider() : new WeComAppMessageProvider();
    const results = await dispatchDueMessages(db, provider, {
      limit: readNumberFlag(rest, '--limit'),
      createdBy: 'cli'
    });
    for (const result of results) {
      console.log(
        `${result.item.id}\t${result.item.send_status}\t${result.item.recipient_id}\t${result.item.external_id ?? ''}\t${summarizeError(result.error)}`
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

function readRequiredStringFlag(args: string[], flag: string): string {
  const value = readStringFlag(args, flag);
  if (!value) throw new Error(`${flag} is required.`);
  return value;
}

function parseRecipientAdd(args: string[]): {
  displayName: string;
  provider: 'wecom_app' | 'fake';
  channel: 'wecom_user' | 'wecom_party' | 'wecom_tag';
  externalId: string;
} {
  const channelFlag = ['--wecom-user', '--wecom-party', '--wecom-tag'].find((flag) => args.includes(flag));
  if (!channelFlag) {
    throw new Error('One of --wecom-user, --wecom-party, or --wecom-tag is required.');
  }
  const flagIndex = args.indexOf(channelFlag);
  const displayName = args.slice(0, flagIndex).join(' ').trim();
  const externalId = readRequiredStringFlag(args, channelFlag);
  const channel = {
    '--wecom-user': 'wecom_user',
    '--wecom-party': 'wecom_party',
    '--wecom-tag': 'wecom_tag'
  }[channelFlag] as 'wecom_user' | 'wecom_party' | 'wecom_tag';
  return {
    displayName,
    provider: args.includes('--fake') ? 'fake' : 'wecom_app',
    channel,
    externalId
  };
}

function summarizeError(error: string | undefined): string {
  if (!error) return '';
  if (error.includes('SIGTERM') || error.includes('Command failed: /usr/bin/osascript')) {
    return 'Apple Reminders sync timed out or was blocked by macOS automation permissions';
  }
  return error.split('\n')[0] ?? error;
}

function printAiScanReport(report: ReturnType<typeof scanAiTasks>): void {
  console.log(
    `AI scan\tactive=${report.activeTasks.length}\tcompleted_today=${report.completedTasks.length}\tlabeled=${report.labeledTasks.length}\tready=${report.readyTasks.length}\tdecisions=${report.decisionTasks.length}\tfuture=${report.futureTasks.length}`
  );

  if (report.completedTasks.length > 0) {
    console.log('Completed today:');
    for (const task of report.completedTasks) {
      console.log(`${task.id}\t${task.completed_at ?? ''}\t${task.title}`);
    }
  }

  if (report.labeledTasks.length > 0) {
    console.log('Labeled:');
    for (const task of report.labeledTasks) {
      console.log(`${task.id}\t${task.title}`);
    }
  }

  if (report.readyTasks.length > 0) {
    console.log('Ready:');
    for (const task of report.readyTasks) {
      const note = task.notes?.split('\n').find((line) => line.startsWith('AI协作:')) ?? '';
      console.log(`${task.id}\t${task.status}\t${task.title}\t${note}`);
    }
  }

  if (report.decisionTasks.length > 0) {
    console.log('Needs decision:');
    for (const task of report.decisionTasks) {
      console.log(`${task.id}\t${task.status}\t${task.title}\t${task.waiting_for ?? ''}`);
    }
  }

  if (report.futureTasks.length > 0) {
    console.log('Future:');
    for (const task of report.futureTasks.slice(0, 5)) {
      console.log(`${task.id}\t${task.status}\t${task.reminder_at ?? task.start_at ?? ''}\t${task.title}`);
    }
  }
}
