# Task Laureate user guide

## Lists and tasks

- Create a List from the dashboard, then add Tasks inside it.
- A Task has a title, rich-text note, priority (`low`, `medium`, `high`, or `urgent`), optional due date, and tags.
- Open a Task to read its full note. Choose **Edit task** to edit the title, priority, and note in one focused workspace. Save or discard deliberately.
- Complete a Task with its circular check control. Archived Lists and viewer-shared Lists are read-only.
- Use the List toolbar to filter open, all, or completed work; order by attention, priority, due date, recency, or name. Personal saved views are stored only in the current browser.

## Sharing

The List owner can choose **Share list**, invite an email address as **Can update** or **Read-only**, and revoke pending or accepted access. Invitations are one-time, expiry-bound links and must be accepted while signed in as the invited email address.

Recipients find accepted work in **Shared with me**. The UI marks shared Lists with their role. Read-only recipients cannot add, edit, archive, or delete Lists or Tasks; the database enforces this as well.

## Assignment and reminders

Only the task owner can assign a Task or configure a reminder. The assignee must already have access to the List or Task. In the Task detail panel, owners can assign eligible collaborators and schedule a reminder one day, three days, or one week before a due date.

Recipients control email and SMS delivery in **Settings**. SMS needs an explicit opt-in and a valid international-format phone number. If a delivery provider is not configured, the reminder is recorded as skipped rather than falsely reported as sent. In-app notification history is private to each recipient.

## Keyboard and accessibility

- `Esc` closes an open task detail panel when not editing.
- The app exposes semantic controls, visible focus states, and screen-reader labels for task completion, sharing, and task editing.
- Use the responsive layout on desktop or mobile; no critical workflow depends on hover.

## Data and privacy

Sign in before saving collaborative work. Supabase RLS is the authorization boundary; UI affordances are convenience only. See [OPERATIONS.md](OPERATIONS.md) for deployment and security details.
