# Capture channels

Task-Laureate has one capture path for the keyboard shortcut, browser extension,
and installed PWA share sheet. Every channel opens Quick Capture, shows the
interpreted task details before saving, and queues safely while offline.

## Keyboard

Use `Cmd/Ctrl + Shift + K` from anywhere in the web app. Press `Escape` to
close it. Focus returns to the Capture button after closing.

## Browser extension

Load the extension directory from the web build, then open the extension’s
**Options** page and set the deployed app URL ending in `/capture`.

For local development, use `http://localhost:5173/capture`. The extension adds
**Capture in Task-Laureate** to selected text, links, and page context menus.

## PWA share sheet

Install the app from a supported browser. The manifest registers `/capture` as
a share target, so shared page titles, text, and URLs open Quick Capture. The
app stores the capture locally before attempting delivery, so losing network
connection cannot lose the thought.
