# Reliability & PWA

Task-Laureate is built to be dependable in ordinary real-world conditions:
patchy networks, interrupted sessions, browser updates, and a phone that needs
one-tap access.

## Trustworthy states

The app distinguishes local, saving, synced, and recoverable-error states. It
uses local-first behavior and mutation recovery so a transient connection issue
does not masquerade as a completed save.

## Installable web app

The PWA includes platform icons, an install experience, and one service worker
for both cached app-shell resilience and Web Push. The worker deliberately does
not cache API responses or cross-origin user data.

On iPhone and iPad, open the app in Safari and use **Share → Add to Home
Screen**. On Android, select **Install** when prompted or use the browser menu.

## Release discipline

Before deployment, the project validates configuration, PWA assets, worker
headers, type safety, tests, build output, and performance budgets. See the
[PWA release guide](https://github.com/aartisr/task-laureate/blob/master/docs/PWA_RELEASE_AND_INSTALL_GUIDE.md)
for device-level verification.

← [Wiki home](Home) · [Install the app](Install-Task-Laureate) · [Operations](Operations)
