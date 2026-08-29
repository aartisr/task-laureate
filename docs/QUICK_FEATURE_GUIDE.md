# Task Laureate user guide

## Capture and Voice Assistant

- Create tasks via the quick capture omnibar (`⌘T` / `Ctrl+T`) with natural-language date, priority, and tag parsing.
- Open the **Voice Assistant** modal to dictate tasks directly. Spoken commands are parsed into structured task titles and saved to your **Voice Tasks** list.
- On **iOS / Safari / Mobile**, if Web Speech dictation is restricted by browser security (`service-not-allowed`), the modal provides clear setup tips (*iOS Settings > General > Keyboard > Enable Dictation*) and an inline manual command text input box so you can submit commands without interruption.
- Access universal navigation shortcuts from anywhere: `⌘H` for Dashboard, `⌘F` for Search, and `⌘T` for Quick Capture.

## Lists and tasks

- Create a List from the dashboard, then add Tasks inside it.
- A Task has a title, rich-text note, priority (`low`, `medium`, `high`, or `urgent`), optional due date, and tags.
- New work starts as **To do**. Select **Start** to make active work visibly **In progress**; task details can move it back to **To do**. Complete a Task with its circular check control. Archived Lists and viewer-shared Lists are read-only.
- Open a Task to read its full note. Choose **Edit task** to edit the title, priority, due date, and note in one focused workspace. Save or discard deliberately.
- Use the List toolbar to filter open, blocked, all, or completed work. **View options** contains ordering and browser-local personal views, so the everyday list remains uncluttered.

## Attachments and dependencies

- Open a Task and use **Attachments** to add reference images, documents, or text files. Supported formats include JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF, PDF, DOCX, XLSX, PPTX, TXT, Markdown, CSV, and JSON.
- Open an attachment to view it securely. The person who uploaded it can remove that attachment; list editors can remove any attachment. A successful removal clears both the private object and its task metadata.
- Use the **Dependency lens** in Task details when one task must finish before another. Required finish-to-start dependencies block completion until their prerequisites are done.
- The app prevents cycles and self-dependencies. A compact **Blocked** signal on a task list shows incomplete prerequisites without expanding the entire graph.

## Sharing

The List owner can choose **Share list**, invite an email address as **Can update** or **Read-only**, and revoke pending or accepted access. Invitations are one-time, expiry-bound links and must be accepted while signed in as the invited email address.

Recipients find accepted work in **Shared with me**. The UI marks shared Lists with their role. Read-only recipients cannot add, edit, archive, or delete Lists or Tasks; the database enforces this as well.

## Assignment and reminders

Only the task owner can assign a Task or configure a reminder. The assignee must already have access to the List or Task. In the Task detail panel, owners can assign eligible collaborators and schedule a reminder one day, three days, or one week before a due date.

Recipients control email and SMS delivery in **Settings**. Settings keeps Appearance visible first and groups notifications, privacy, sync, and recovery in clearly named sections. SMS needs an explicit opt-in and a valid international-format phone number. If a delivery provider is not configured, the reminder is recorded as skipped rather than falsely reported as sent. In-app notification history is private to each recipient.

## Keyboard and accessibility

- `Esc` closes an open task detail panel when not editing. Keyboard shortcuts are available from their on-page **Keyboard shortcuts** disclosure.
- The app exposes semantic controls, visible focus states, and screen-reader labels for task completion, sharing, and task editing.
- Use the responsive layout on desktop or mobile; no critical workflow depends on hover.

## Data and privacy

Sign in before saving collaborative work. Supabase RLS is the authorization boundary; UI affordances are convenience only. See [OPERATIONS.md](OPERATIONS.md) for deployment and security details.
