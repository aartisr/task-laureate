import { useSyncExternalStore } from 'react';
import { remoteSync } from '../infrastructure/antiBacklog/mutationOutbox';

/**
 * A compact “your work is safe” signal. It only becomes visually prominent
 * when the person can take a meaningful action.
 */
export function RemoteSyncStatus() {
  const sync = useSyncExternalStore(remoteSync.subscribe, remoteSync.getSnapshot, remoteSync.getSnapshot);
  if (sync.attentionCount) return null; // The resolution center owns this state.
  if (!sync.isOnline || sync.pendingCount) {
    const label = !sync.isOnline
      ? `${sync.pendingCount ? `${sync.pendingCount} change${sync.pendingCount === 1 ? '' : 's'} saved on this device` : 'You are offline'} · will sync automatically`
      : sync.isSyncing ? 'Syncing your saved changes…' : `${sync.pendingCount} change${sync.pendingCount === 1 ? '' : 's'} waiting to sync`;
    return <div className="remote-sync-status" role="status" aria-live="polite"><span aria-hidden="true">⌁</span><span>{label}</span>{sync.isOnline && !sync.isSyncing ? <button type="button" onClick={() => void remoteSync.flush({ force: true })}>Sync now</button> : null}</div>;
  }
  return null;
}
