# Access Options

The core product can be local-first without forcing the user to operate the remote Mac directly. The database can live on the Mac, while capture and review can happen from a phone.

## Option A: Local web app plus private tunnel

Run the app on the Mac and expose it only to the user through a private network or tunnel.

Good choices:

- Tailscale: private device-to-device network. Best for personal use and low maintenance.
- Cloudflare Tunnel: public URL protected by access rules. Good when device networking is awkward.

Pros:

- Keeps SQLite and files on the Mac.
- Phone can open the web UI directly.
- Faster to build than a full cloud product.

Cons:

- The Mac must stay online.
- Needs authentication and HTTPS before real use.

## Option B: Chat/Codex as capture interface

Use Codex as a command surface:

- "帮我记一下：明天下午还信用卡。"
- Codex writes an Inbox row into SQLite.
- Later the user asks: "帮我看一下 Inbox 里有哪些没处理的。"
- Codex reads Inbox and helps classify or schedule tasks.

Pros:

- Very close to the current ChatGPT phone-to-Codex workflow.
- Almost no mobile UI needed at the start.
- AI can classify at capture time.

Cons:

- Works best while Codex has access to the Mac workspace.
- Not a standalone consumer app.

## Option C: Mobile quick-capture endpoint

Create a tiny authenticated API endpoint:

- `POST /inbox`
- Body: original text, source, optional metadata.

Possible clients:

- iOS Shortcut.
- Telegram bot.
- WeChat/ServerChan style push workflow.
- Email-to-inbox.
- Browser share sheet.

Pros:

- Very low friction for capture.
- Can be added before a polished mobile app exists.

Cons:

- Needs careful authentication.
- Some channels require external services.

## Option D: Real hosted app

Deploy backend and database to a small VPS or managed service.

Pros:

- Phone and desktop access are straightforward.
- The Mac does not need to stay online.

Cons:

- Less local-first.
- More ops, backup, security, and cost.
- Moves personal task history back into a server environment unless self-hosted carefully.

## Recommended path

Build in this order:

1. Local SQLite schema and core API.
2. Codex command workflow for Inbox capture and review.
3. Local web UI for review and planning.
4. Tailscale access from phone.
5. iOS Shortcut or Telegram quick capture.
6. AI recommendation and review features.

This gives immediate value without committing too early to a full cloud architecture.

