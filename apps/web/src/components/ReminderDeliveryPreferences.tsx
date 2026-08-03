import { useEffect, useState } from 'react';
import { getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from '../infrastructure/notifications/inbox';

const defaults: NotificationPreferences = { due_soon: true, weekly_digest: false, email_reminders: true, sms_reminders: false, phone_e164: null, sms_opted_in_at: null, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
const e164 = /^\+[1-9]\d{7,14}$/;

/** Recipient-owned consent controls. A task owner selects reminder timing; each
 * recipient independently controls personal delivery channels. */
export function ReminderDeliveryPreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void getNotificationPreferences().then((saved) => { if (saved) { setPreferences(saved); setPhone(saved.phone_e164 ?? ''); } }).catch(() => setMessage('We could not load delivery preferences.')); }, []);
  const save = async (next: NotificationPreferences) => { setSaving(true); setMessage(''); try { await saveNotificationPreferences(next); setPreferences(next); setMessage('Delivery preferences saved.'); } catch { setMessage('We could not save delivery preferences.'); } finally { setSaving(false); } };
  const toggle = (key: 'email_reminders' | 'sms_reminders', checked: boolean) => {
    if (key === 'sms_reminders' && checked && !e164.test(phone.trim())) { setMessage('Enter a valid international phone number, such as +14155552671, before enabling SMS.'); return; }
    const next = { ...preferences, [key]: checked, phone_e164: phone.trim() || null, sms_opted_in_at: key === 'sms_reminders' ? (checked ? new Date().toISOString() : null) : preferences.sms_opted_in_at };
    void save(next);
  };
  const savePhone = () => { const normalized = phone.trim(); if (normalized && !e164.test(normalized)) { setMessage('Use E.164 format, for example +14155552671.'); return; } void save({ ...preferences, phone_e164: normalized || null, sms_reminders: normalized ? preferences.sms_reminders : false, sms_opted_in_at: normalized && preferences.sms_reminders ? preferences.sms_opted_in_at ?? new Date().toISOString() : null }); };
  return <section className="reminder-delivery" aria-labelledby="reminder-delivery-title"><div><p className="reminder-delivery__eyebrow">Task reminders</p><h2 id="reminder-delivery-title">Choose how we reach you</h2><p>Task owners can schedule reminders for work assigned to you. You control personal delivery channels here.</p></div><label className="reminder-delivery__option"><input type="checkbox" checked={preferences.email_reminders} disabled={saving} onChange={(event) => toggle('email_reminders', event.target.checked)} /><span><strong>Email</strong><small>Send scheduled reminders to your account email.</small></span></label><div className="reminder-delivery__sms"><label htmlFor="reminder-phone"><strong>Mobile number</strong><span>International format only</span></label><div><input id="reminder-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+14155552671" value={phone} disabled={saving} onChange={(event) => setPhone(event.target.value)} /><button type="button" className="secondary-button" disabled={saving} onClick={savePhone}>Save number</button></div><label className="reminder-delivery__option"><input type="checkbox" checked={preferences.sms_reminders} disabled={saving} onChange={(event) => toggle('sms_reminders', event.target.checked)} /><span><strong>SMS</strong><small>Opt in to task reminders by text. Carrier charges may apply; you can turn this off anytime.</small></span></label></div>{message ? <p className="reminder-delivery__message" role="status">{message}</p> : null}</section>;
}
