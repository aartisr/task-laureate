import { useEffect, useState } from 'react';
import { getNotificationEvents, getNotificationPreferences, markNotificationRead, saveNotificationPreferences, type NotificationEvent, type NotificationPreferences } from '../infrastructure/notifications/inbox';
import { BrowserPushControl } from './BrowserPushControl';

/** Private inbox for scheduled reminders and immediate collaboration requests. */
export function NotificationInbox() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({ due_soon: true, weekly_digest: false, email_reminders: true, sms_reminders: false, phone_e164: null, sms_opted_in_at: null, time_zone: 'UTC' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    void Promise.all([getNotificationEvents(), getNotificationPreferences()])
      .then(([loadedEvents, savedPreferences]) => {
        setEvents(loadedEvents);
        if (savedPreferences) setPreferences(savedPreferences);
      })
      .catch(() => setMessage('Your notification inbox could not be loaded.'));
  }, []);

  const markRead = async (event: NotificationEvent) => {
    try {
      await markNotificationRead(event.id);
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch { setMessage('We could not update that notification.'); }
  };

  const savePreference = async (name: 'due_soon' | 'weekly_digest', value: boolean) => {
    const next = { ...preferences, [name]: value };
    setPreferences(next);
    setMessage('');
    try {
      await saveNotificationPreferences(next);
    } catch {
      setPreferences(preferences);
      setMessage('We could not save that notification preference.');
    }
  };

  return <section className="notification-inbox" aria-labelledby="notification-inbox-title">
    <div><p className="notification-inbox__eyebrow">In-app notifications</p><h2 id="notification-inbox-title">Your inbox</h2><p>Private assignments, scheduled reminders, and status-update requests from people you work with.</p></div>
    <fieldset className="notification-inbox__preferences">
      <legend>What should appear in your inbox?</legend>
      <label><input type="checkbox" checked={preferences.due_soon} onChange={(event) => void savePreference('due_soon', event.target.checked)} /> <span><strong>Scheduled task reminders</strong><small>Show due-date reminders for work assigned to you.</small></span></label>
    </fieldset>
    <p className="notification-inbox__timing">The daily delivery check is scheduled for 13:00 UTC; provider delivery time can vary.</p>
    <BrowserPushControl />
    {events.length === 0 && !message ? <p className="notification-inbox__empty">Nothing needs your attention right now.</p> : null}
    <div className="notification-inbox__items">{events.map((event) => <article key={event.id} className={event.read_at ? 'is-read' : ''}><div><strong>{event.title}</strong><p>{event.body}</p><small>{new Date(event.created_at).toLocaleString()}</small></div>{!event.read_at ? <button type="button" onClick={() => void markRead(event)}>Mark read</button> : null}</article>)}</div>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
