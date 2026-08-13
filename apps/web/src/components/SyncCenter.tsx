import { useEffect, useState, useSyncExternalStore } from 'react';
import { remoteSync, type PendingMutation } from '../infrastructure/antiBacklog/mutationOutbox';

/** A transparent recovery surface: proof of what is safe locally and one-click export. */
export function SyncCenter() {
  const snapshot = useSyncExternalStore(remoteSync.subscribe, remoteSync.getSnapshot, remoteSync.getSnapshot);
  const [items, setItems] = useState<PendingMutation[]>([]);
  const refresh = () => void remoteSync.listCurrent().then(setItems);
  useEffect(() => { refresh(); return remoteSync.subscribe(refresh); }, []);
  const exportQueue = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), changes: items }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'task-laureate-unsynced-changes.json'; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="sync-center" aria-labelledby="sync-center-title"><header><div><p className="settings-section__eyebrow">Local-first safety</p><h3 id="sync-center-title">Sync Center</h3><p>{snapshot.attentionCount ? 'A change needs a decision. Nothing has been lost.' : snapshot.pendingCount ? `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? '' : 's'} are safe on this device.` : 'Everything is safely synced.'}</p></div><button type="button" className="secondary-button" disabled={!snapshot.isOnline || snapshot.isSyncing || !items.length} onClick={() => void remoteSync.flush({ force: true })}>{snapshot.isSyncing ? 'Syncing…' : 'Sync now'}</button></header>{items.length ? <><ul>{items.map((item) => <li key={item.id}><span>{item.state === 'conflict' || item.state === 'blocked' ? 'Needs review' : 'Saved locally'}</span><strong>{item.type.replace('.', ' ')}</strong><small>{item.error ?? 'Will retry automatically when possible.'}</small><div><button type="button" onClick={() => void remoteSync.retry(item.id)}>Retry</button><button type="button" onClick={() => void remoteSync.dismiss(item.id)}>Discard</button></div></li>)}</ul><button type="button" className="sync-center__export" onClick={exportQueue}>Export saved changes</button></> : null}</section>;
}
