import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { authProvider } from '../config/persistence.config';
import { getNotificationEvents, markNotificationRead, type NotificationEvent } from '../infrastructure/notifications/inbox';

/** A low-interruption, always-reachable notice center for authenticated work. */
export function NotificationCenter({ onNavigate }: { onNavigate?: () => void }) {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState('');
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const unread = events.filter((event) => !event.read_at);

  useEffect(() => {
    const load = async (knownSession?: Awaited<ReturnType<typeof authProvider.getSession>>) => {
      const session = knownSession === undefined ? await authProvider.getSession() : knownSession;
      setSignedIn(Boolean(session));
      if (!session) return setEvents([]);
      try { setEvents(await getNotificationEvents(4)); setMessage(''); }
      catch { setMessage('Notifications are temporarily unavailable.'); }
    };
    void load();
    return authProvider.subscribe((session) => { void load(session); });
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  if (!signedIn) return null;
  const acknowledge = async (event: NotificationEvent) => {
    try { await markNotificationRead(event.id); setEvents((current) => current.map((item) => item.id === event.id ? { ...item, read_at: new Date().toISOString() } : item)); }
    catch { setMessage('We could not update that notification.'); }
  };
  const label = unread.length ? `${unread.length} unread notification${unread.length === 1 ? '' : 's'}` : 'Notifications';

  return <div className="notification-center" ref={container}>
    <button type="button" className="notification-center__trigger" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((current) => !current)}>
      <span aria-hidden="true">🔔</span><span className="notification-center__label">Alerts</span>
      {unread.length ? <span className="notification-center__count" aria-hidden="true">{unread.length > 9 ? '9+' : unread.length}</span> : null}
    </button>
    <span className="sr-only" aria-live="polite">{unread.length ? `You have ${unread.length} unread notifications.` : ''}</span>
    {open ? <div id={id} className="notification-center__popover" role="dialog" aria-label="Notifications">
      <div className="notification-center__heading"><div><p>ATTENTION</p><h2>{unread.length ? `${unread.length} need${unread.length === 1 ? 's' : ''} your attention` : 'You are all caught up'}</h2></div><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>×</button></div>
      {message ? <p className="notification-center__message" role="status">{message}</p> : null}
      {!message && events.length === 0 ? <p className="notification-center__empty">No reminders right now.</p> : null}
      <div className="notification-center__items">{events.map((event) => <article key={event.id} className={event.read_at ? 'is-read' : ''}><strong>{event.title}</strong><p>{event.body}</p>{!event.read_at ? <button type="button" onClick={() => void acknowledge(event)}>Mark read</button> : null}</article>)}</div>
      <Link to="/settings" className="notification-center__all" onClick={() => { setOpen(false); onNavigate?.(); }}>View notification settings</Link>
    </div> : null}
  </div>;
}
