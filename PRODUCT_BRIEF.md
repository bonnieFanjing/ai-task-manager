# AI Task Manager Product Brief

## Starting point

This project is a local-first task manager inspired by Doit.im and GTD, with AI used to reduce manual classification and recommend what to do next.

## Doit.im baseline

Observed core concepts:

- Inbox for uncategorized tasks.
- Today, Tomorrow, Next, Scheduled, Someday, Waiting, Completed, Trash.
- Projects for multi-step outcomes.
- Goals above projects.
- Contexts for place/circumstance/tool/person needed to do a task.
- Tags, priority, deadlines, repeat rules, reminders, subtasks.
- Smart Add syntax for quick task entry.
- Advanced filters and saved custom boxes.
- Daily Plan and Daily Review.
- Calendar view and Google Calendar sync.
- Email-to-task and browser extension capture.

Sources:

- https://doit.im/
- https://help.doit.im/topics/840
- https://faq.doit.im/web.html
- https://apps.apple.com/us/app/doit-im/id533391459
- https://books.google.com/books?id=D4MD-XKAbD4C

## AI-first differences

The main improvement is to make task organization semi-automatic:

- Natural language capture: "next Friday pay credit card" becomes a task with due date, reminder, suggested context, and recurrence if appropriate.
- Context inference: AI estimates required resources such as computer, phone, focused time, commute, home, office, internet, or a specific person.
- Project detection: AI suggests whether a task is a one-step action or belongs inside a multi-step project.
- Smart review: AI finds stale projects, vague tasks, missing next actions, overdue commitments, and recurring patterns.
- Recommendation engine: given current time, location/context, energy, available duration, deadlines, and importance, suggest the best next task.
- Personal analytics: summarize past completion data, procrastination patterns, task load by area, and recurring bottlenecks.

## MVP proposal

1. Local database and task model.
2. Inbox capture as a first-class workflow, with natural-language parsing.
3. Manual task views: Inbox, Today, Next, Scheduled, Waiting, Projects, Contexts.
4. AI classification suggestions that the user can accept or correct.
5. "What should I do now?" recommendation command.
6. Daily review summary.

## Inbox requirements

Inbox is not just a task status. It is the fastest capture surface in the product.

- The user can throw ideas, reminders, tasks, notes, and half-formed thoughts into Inbox with almost no friction.
- Inbox items preserve the original text, creation time, source, and optional attachments/links.
- AI may suggest task fields immediately, but the raw Inbox item should remain easy to review.
- Processing Inbox means deciding whether the item becomes a task, project, reminder, delegated item, reference note, or trash.
- Inbox should support batch review: classify, prioritize, split, delegate, schedule, or complete later.
- Mobile capture is mandatory, because most random thoughts happen away from the desktop.

## Local-first architecture idea

- Frontend: web app, likely Next.js or Vite + React.
- Storage: SQLite local database.
- Backend/API: Node/TypeScript or Python/FastAPI.
- AI layer: pluggable provider, with local metadata stored in SQLite.
- Optional later sync: encrypted file sync via iCloud/Dropbox/Git/private server.

## Access strategy

The app should not require the user to log into the remote Mac every time.

Recommended staged approach:

1. Start with a local web app and SQLite on the Mac.
2. Expose the web app privately to the user's phone with Tailscale or Cloudflare Tunnel.
3. Add a mobile capture endpoint for Inbox, usable from iOS Shortcuts, Telegram, WeChat, email, or a simple authenticated URL.
4. Add a Codex/ChatGPT command workflow so the user can say "帮我记一下..." and Codex writes directly to Inbox.
5. Later, add encrypted sync or a small private server if the user needs multi-device offline editing.

