import { useEffect, useState } from 'react';
import { mutationOutbox, type PendingMutation } from '../infrastructure/antiBacklog/mutationOutbox';

/** Quiet by default: it appears only when a user decision is actually needed. */
export function MutationConflictCenter() {
  const [conflicts, setConflicts] = useState<PendingMutation[]>([]);
  useEffect(() => { const refresh = () => void mutationOutbox.list().then((items) => setConflicts(items.filter((item) => item.state === 'conflict'))); refresh(); const timer = window.setInterval(refresh, 2_000); return () => window.clearInterval(timer); }, []);
  if (!conflicts.length) return null;
  return <aside className="persistence-alert" role="alert"><strong>Some changes need review.</strong>{conflicts.map((item) => <div key={item.id}><span>{item.type}: {item.error}</span><button type="button" className="secondary-button" onClick={() => void mutationOutbox.resolve(item.id)}>Dismiss local change</button></div>)}</aside>;
}
