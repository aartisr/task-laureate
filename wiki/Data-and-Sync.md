# Data & Sync

Task-Laureate uses a local-first approach so the interface can acknowledge work immediately while cloud persistence catches up. It is a reliability pattern, not a promise that every device can work indefinitely without a network.

## What happens when you make a change

1. The interface applies the change locally and shows an honest state.
2. The mutation layer records enough information to retry or recover delivery.
3. The persistence adapter sends the authorized change to Supabase.
4. The app reports **saving**, **synced**, or a recoverable error rather than pretending a request succeeded.

## Practical advice

- Wait for a synced state before closing a device after important work.
- Reconnect before expecting a new device to show recent cloud changes.
- Use the in-app sync and recovery surfaces if a save needs attention.
- Do not clear browser site data as a first troubleshooting step; it can sign you out and discard pending local state.

The detailed persistence design lives in the [Architecture guide](https://github.com/aartisr/task-laureate/blob/master/docs/ARCHITECTURE_GUIDE.md) and [Production Operations](https://github.com/aartisr/task-laureate/blob/master/docs/OPERATIONS.md).

← [Wiki home](Home) · [Product Guide](Product-Guide) · [Reliability & PWA](Reliability-and-PWA)
