import { useEffect, useState, useSyncExternalStore } from 'react';
import { remoteSync, type PendingMutation } from '../infrastructure/antiBacklog/mutationOutbox';

/** A quiet resolution queue: ordinary retrying stays out of the user's way. */
export function MutationConflictCenter() {
  const sync = useSyncExternalStore(remoteSync.subscribe, remoteSync.getSnapshot, remoteSync.getSnapshot);
  const [entries, setEntries] = useState<PendingMutation[]>([]);
  const refresh = () => void remoteSync.listCurrent().then((items) => setEntries(items.filter((item) => item.state === 'conflict' || item.state === 'blocked')));

  useEffect(() => { refresh(); return remoteSync.subscribe(refresh); }, []);
  if (!entries.length) return null;
  return <aside className="persistence-alert persistence-alert--sync" role="alert">
    <div><strong>{sync.attentionCount === 1 ? 'One change needs your review.' : `${sync.attentionCount} changes need your review.`}</strong><span>Nothing has been discarded.</span></div>
    {entries.map((item) => <div className="persistence-alert__item" key={item.id}><span>{item.type.replace('.', ' ')}: {item.error ?? 'This change could not be applied.'}</span><div><button type="button" className="secondary-button" onClick={() => void remoteSync.retry(item.id)}>Try again</button><button type="button" className="secondary-button" onClick={() => void remoteSync.dismiss(item.id)}>Discard local change</button></div></div>)}
  </aside>;
}
