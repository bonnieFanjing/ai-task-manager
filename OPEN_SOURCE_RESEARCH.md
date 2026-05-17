# Open Source Research

This document records whether we should reuse existing open-source projects or build a small custom system.

## Summary

There are already strong open-source task managers, including GTD-style and local-first tools. However, none of the reviewed projects exactly matches this product shape:

- Remote Mac as the data and execution center.
- SQLite as a personal task memory.
- Codex/GPT as the first natural-language interface.
- Mobile access through Tailscale/private web UI.
- AI analysis triggered manually by the user.
- Apple Reminders used as an iPhone notification bridge.

Recommendation:

- Do not fork a full task manager for the first version.
- Build a small custom core around SQLite, CLI/API, and a focused web UI.
- Reuse small proven libraries/tools where they reduce risk.
- Keep the data model simple enough to migrate into or out of another app later.

## Full task managers reviewed

### Mindwtr

Repository: https://github.com/dongdongbh/Mindwtr

Relevant features:

- Full GTD workflow: Capture, Clarify, Organize, Reflect, Engage.
- Inbox with processing wizard.
- Projects, contexts, waiting, someday, review flows.
- Local-first data model.
- Desktop, mobile, and PWA.
- Optional AI copilot with bring-your-own-key or local/self-hosted models.
- CLI, REST API, and MCP server are listed as automation helpers.
- AGPL-3.0 license.

Fit:

- Very close to the GTD side of the desired product.
- Good inspiration for workflow and data model.
- Potentially worth installing and testing before we build too much UI.

Concern:

- It is a full cross-platform product, so adapting it to the exact "Codex as current AI entry + remote Mac SQLite + Apple Reminders bridge" workflow may be heavier than building a narrow first version.
- AGPL license matters if code is copied or modified into another distributed product.

### Vikunja

Website: https://vikunja.io/

Relevant features:

- Open-source, self-hostable task manager.
- Lists/projects, Kanban, Gantt, table views.
- Due dates, reminders, repeating tasks, priorities, labels, attachments.
- API tokens for scripts and integrations.
- Supports SQLite, MySQL/MariaDB, and PostgreSQL.
- AGPLv3 license.

Fit:

- Strong self-hosted task management backend and web UI.
- Good candidate if the goal becomes "use an existing app and add AI integration around it."

Concern:

- More team/project-management oriented than strict personal GTD.
- Reminder notifications are mainly UI/email oriented, not automatically the iPhone notification bridge we want.
- If used directly, our custom data analysis would need to adapt to Vikunja's model.

### Will Be Done

Repository: https://github.com/will-be-done/will-be-done

Relevant features:

- Self-hosted, local-first, SQLite-backed task manager.
- Offline-first browser database.
- Weekly timeline and Today view.
- Mobile-ready PWA.
- API and MCP integration are on the roadmap.
- AGPL-3.0 license.

Fit:

- Strong inspiration for weekly planning, mobile PWA, and local-first ergonomics.

Concern:

- Less GTD/InBox/context focused than our target.
- Project is younger and still has roadmap items around API/MCP.

### Tasks.md

Repository: https://github.com/BaldissaraMatheus/Tasks.md

Relevant features:

- Self-hosted task board.
- Stores task cards as Markdown files.
- Docker installation.
- PWA support.
- MIT license.

Fit:

- Good reference for a simple self-hosted UI and file-based portability.

Concern:

- Kanban/card oriented, not GTD-oriented.
- Does not directly solve AI/Codex or iPhone reminder requirements.

### Taskosaur

Repository: https://github.com/Taskosaur/Taskosaur

Relevant features:

- Project management with conversational AI task execution.
- Next.js frontend, NestJS backend, PostgreSQL, Redis.
- Bring-your-own LLM key.
- In-app AI assistant can execute workflows.
- Business Source License.

Fit:

- Useful reference for conversational task execution patterns.

Concern:

- Too large and team/SaaS-like for the personal local-first MVP.
- PostgreSQL/Redis stack is heavier than needed.
- BSL license is not ideal for direct reuse in a small personal open system.

## Useful components to reuse or study

### Apple Reminders integration

#### reminders-cli

Repository: https://github.com/keith/reminders-cli

Relevant features:

- CLI for macOS Reminders.
- Can list, add, edit, complete, delete reminders.
- Supports due dates and priority.
- MIT license.

Fit:

- Very good candidate for MVP reminder sync.
- The task backend can call this CLI to create Apple Reminders entries.

Concern:

- Need to test permissions and due date behavior on the remote Mac.
- We need stable mapping between SQLite task IDs and Apple Reminders items.

#### mcp-server-apple-events

Repository: https://github.com/FradSer/mcp-server-apple-events

Relevant features:

- MCP server for Apple Reminders and Calendar through macOS EventKit.
- Full CRUD for reminders and reminder lists.
- Handles modern macOS Reminders/Calendar permission prompts.
- Includes structured prompts for daily task organization, reminder creation, review, and weekly planning.
- MIT license.

Fit:

- Strong reference for Apple Reminders permissions and EventKit integration.
- May be useful if we want a direct MCP layer instead of shelling out to a CLI.

Concern:

- More infrastructure than needed for the first SQLite MVP.
- We should first test whether simple CLI/JXA/AppleScript is enough.

### Natural language date parsing

#### chrono-node

Repository: https://github.com/wanasit/chrono

Relevant features:

- JavaScript/TypeScript natural-language date parser.
- Handles expressions like today, tomorrow, last Friday, date ranges, and relative dates.
- Supports multiple languages, with partial support for Simplified and Traditional Chinese.
- MIT license.

Fit:

- Good candidate if the backend is TypeScript.
- Useful for non-AI deterministic extraction of dates and reminders.

Concern:

- Chinese support needs testing with real inputs like "下周五下午三点还信用卡".
- AI may still be needed for richer classification.

#### quickadd

Repository: https://github.com/Acreom/quickadd

Relevant features:

- Python natural language date/time parser.
- Supports recurring events.
- MIT license.

Fit:

- Good candidate if the backend is Python.

Concern:

- Based on ctparse, which focuses on German and English.
- Less attractive if we use Node/TypeScript.

## Reuse decision

For the first version, build our own narrow product instead of adopting a full existing app.

Reasons:

- The desired workflow is unusual: Codex/GPT is the first AI UI, not just a chatbot inside a task app.
- The task model needs to preserve raw Inbox captures for later AI analysis.
- Apple Reminders sync is a bridge, not the primary database.
- A small SQLite schema will be easier to inspect, summarize, back up, and modify.
- Existing full apps bring useful features, but also large assumptions about accounts, sync, UI, and data model.

What we should reuse first:

1. `chrono-node` for deterministic date parsing if we choose TypeScript.
2. `reminders-cli` or ideas from `mcp-server-apple-events` for Apple Reminders sync.
3. UI/workflow ideas from Mindwtr, Doit.im, Vikunja, and Will Be Done.

What we should not copy directly in MVP:

- Full Vikunja/Mindwtr/Will Be Done codebase.
- Taskosaur's SaaS/team-oriented stack.
- A complex sync layer before the local core works.

## Possible alternative path

If we want the fastest usable self-hosted task manager with less custom UI work:

1. Install Vikunja or Mindwtr.
2. Use their API/MCP layer as the task database.
3. Build only a Codex helper that adds AI classification and recommendations.

This would be faster for UI, but weaker for complete control over personal analytics and data shape.

The current recommendation remains: build a small custom MVP, but keep an eye on Mindwtr and Vikunja as fallback options.

