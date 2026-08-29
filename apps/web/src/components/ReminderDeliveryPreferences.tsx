import { useEffect, useState } from 'react';
import { getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from '../infrastructure/notifications/inbox';

const defaults: NotificationPreferences = { due_soon: true, weekly_digest: false, email_reminders: true, sms_reminders: false, phone_e164: null, sms_opted_in_at: null, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
/** Recipient-owned consent controls. A task owner selects reminder timing; each
 * recipient independently controls personal delivery channels. */
export function ReminderDeliveryPreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void getNotificationPreferences().then((saved) => { if (saved) setPreferences(saved); }).catch(() => setMessage('We could not load delivery preferences.')); }, []);
  const save = async (next: NotificationPreferences) => { setSaving(true); setMessage(''); try { await saveNotificationPreferences(next); setPreferences(next); setMessage('Delivery preferences saved.'); } catch { setMessage('We could not save delivery preferences.'); } finally { setSaving(false); } };
  return <section className="reminder-delivery" aria-labelledby="reminder-delivery-title"><div><p className="reminder-delivery__eyebrow">Task reminders</p><h2 id="reminder-delivery-title">Choose how we reach you</h2><p>Task owners can schedule email reminders for work assigned to you.</p></div><label className="reminder-delivery__option"><input type="checkbox" checked={preferences.email_reminders} disabled={saving} onChange={(event) => void save({ ...preferences, email_reminders: event.target.checked })} /><span><strong>Email</strong><small>Send scheduled reminders to your account email.</small></span></label>{message ? <p className="reminder-delivery__message" role="status">{message}</p> : null}</section>;
}
