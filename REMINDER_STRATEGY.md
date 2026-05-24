# Reminder Strategy

Reminder data in SQLite is not enough. The system needs a delivery channel that can actually reach the user on iPhone.

## Decision

Do not rely on macOS local notifications on the remote Mac as the primary reminder mechanism.

Reason:

- The notification appears on the remote Mac.
- The user usually interacts from iPhone.
- A remote Mac notification does not reliably mean the user has been notified.

## Preferred first channel: Apple Reminders

Use Apple Reminders/iCloud as the first real notification bridge.

Model:

- SQLite remains the source of truth for tasks.
- When a task needs a real reminder, sync a corresponding item into an Apple Reminders list.
- iCloud sync delivers that reminder to iPhone if the same Apple Account has Reminders enabled.
- The Apple Reminders item can include a link or reference ID back to the local task.

Why this fits:

- The user already uses the same Apple account on the remote Mac and iPhone.
- iPhone notifications are handled by Apple's existing system.
- We avoid building a custom push notification service in the first version.

Apple references:

- https://support.apple.com/en-mide/guide/icloud/set-up-reminders-mmbf52194b5a/1.0/icloud/1.0
- https://support.apple.com/en-lamr/guide/reminders/remne4b02adc/mac
- https://support.apple.com/guide/reminders/-remnd4b206fb/mac

## Possible implementation approaches

### A. AppleScript or JXA on macOS

The backend can call a local script on the Mac to create or update reminders in the Reminders app.

Pros:

- Works locally on the Mac.
- Does not require building an iOS app.
- Can be triggered from the task backend.

Cons:

- Needs testing against the user's macOS version.
- Apple app scripting can be brittle.

### B. macOS Shortcuts

Create a Shortcut that accepts task details and creates an Apple Reminder.

Pros:

- More user-visible and easier to debug than raw AppleScript.
- Fits Apple's automation model.

Cons:

- Passing data from the backend into Shortcuts needs a small integration layer.

### C. iOS Shortcut pull model

The iPhone runs a Shortcut that fetches today's reminders from the private API and creates local Apple Reminders.

Pros:

- The action starts on the phone.
- Good for daily planning.

Cons:

- Less automatic unless scheduled automation works reliably.

### D. Telegram, email, or push service

Use a bot or third-party push service.

Pros:

- Cross-platform.
- Often easier to trigger from a backend.

Cons:

- Adds another third-party service.
- May be less private than Apple Reminders.

## First version scope

For MVP:

- Store `reminder_at` and `deadline_at` in SQLite.
- Show reminders in Today/Scheduled views.
- Add a reminder sync status field.
- Build a manual command first: sync selected task to Apple Reminders.
- Later add automatic sync for tasks with real reminders.
- Add a recurring AI scan that creates a daily AI progress digest and individual decision prompts in Apple Reminders.
