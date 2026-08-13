import { useEffect, useMemo, useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { beginGoogleCalendarConnection, disconnectGoogleCalendar, getCalendarStatus, reconcileCalendar, removeCalendarBlock, scheduleCalendarBlock, type CalendarStatus } from '../infrastructure/calendar/calendarScheduling';

const localDateTime = (value?: string | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 30 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const messageFor = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  if (code === 'reauthorization_required') return 'Google needs permission again. Reconnect your calendar to continue.';
  if (code === 'connection_unavailable') return 'This calendar connection is no longer available. Reconnect and try again.';
  if (code === 'calendar_change_requires_removal') return 'Remove the existing block before moving this task to another calendar. This prevents duplicate events.';
  if (code === 'disabled') return 'Calendar scheduling is not enabled for this environment.';
  return 'We could not confirm that calendar block. Your task has not been changed.';
};

export function calendarSyncLabel(block: { sync_state?: string; last_reconciled_at?: string | null } | null | undefined, checkedAt?: string | null) {
  if (block?.sync_state === 'removed_external') return 'Needs a new time';
  const checked = checkedAt ?? block?.last_reconciled_at;
  if (!checked || Number.isNaN(Date.parse(checked))) return 'Ready to check';
  return `In sync · checked ${new Date(checked).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function calendarBlockPresentation(block: { sync_state?: string } | null | undefined) {
  const needsNewTime = block?.sync_state === 'removed_external';
  return {
    needsNewTime,
    heading: needsNewTime ? 'Choose a new time' : block ? 'This task has protected time' : 'Choose a time you can protect',
    startLabel: needsNewTime ? 'New start' : 'Start',
    scheduleLabel: needsNewTime ? 'Add a new calendar block' : block ? 'Update this block' : 'Add to calendar',
  };
}

/** A saved block has an authoritative provider calendar even if its list entry is not currently returned. */
export function canScheduleCalendarBlock(input: { startsAt: string; connected?: boolean }) {
  return Boolean(input.startsAt && input.connected);
}

export function displayedCalendarDuration(estimateMinutes: number | null | undefined, block: { duration_minutes: number; sync_state?: string } | null | undefined) {
  const blockDuration = block?.duration_minutes;
  if (block?.sync_state !== 'removed_external' && typeof blockDuration === 'number' && Number.isInteger(blockDuration) && blockDuration >= 5) return blockDuration;
  return estimateMinutes && estimateMinutes >= 5 ? estimateMinutes : 30;
}

export function CalendarScheduleControl({ task, scheduledStartAt, estimateMinutes, existingBlock, onScheduled }: { task: TodoItem; scheduledStartAt?: string | null; estimateMinutes?: number | null; existingBlock?: { calendar_id: string; starts_at: string; duration_minutes: number; external_event_url?: string | null; sync_state?: string; last_reconciled_at?: string | null } | null; onScheduled?: () => void | Promise<void> }) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [startsAt, setStartsAt] = useState(() => localDateTime(scheduledStartAt));
  const [duration, setDuration] = useState(() => displayedCalendarDuration(estimateMinutes, existingBlock));
  const [calendarId, setCalendarId] = useState('primary'); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const selectedCalendar = useMemo(() => status?.calendars?.find((calendar) => calendar.id === calendarId), [calendarId, status]);
  // Google documents `primary` as a valid calendarId. It is a safe fallback
  // when a connected account's writable calendar list is temporarily empty.
  const targetCalendarId = existingBlock?.calendar_id ?? (selectedCalendar ? calendarId : 'primary');
  const targetCalendar = useMemo(() => status?.calendars?.find((calendar) => calendar.id === targetCalendarId) ?? (targetCalendarId === 'primary' ? status?.calendars?.find((calendar) => calendar.primary) : undefined), [status, targetCalendarId]);
  const load = () => void getCalendarStatus().then((next) => { const calendars = next.calendars ?? []; setStatus(next); setCalendarId((current) => calendars.some((calendar) => calendar.id === current) ? current : next.defaultCalendarId ?? calendars.find((calendar) => calendar.primary)?.id ?? 'primary'); }).catch(() => setStatus({ status: 'unavailable' }));
  useEffect(load, []);
  useEffect(() => {
    if (existingBlock?.sync_state === 'removed_external') {
      setStartsAt(localDateTime());
      setCheckedAt(null);
    } else if (scheduledStartAt) setStartsAt(localDateTime(scheduledStartAt));
  }, [scheduledStartAt, existingBlock?.sync_state]);
  useEffect(() => { setDuration(displayedCalendarDuration(estimateMinutes, existingBlock)); }, [estimateMinutes, existingBlock?.duration_minutes, existingBlock?.sync_state]);
  const connect = async () => { setBusy(true); setNotice(''); try { await beginGoogleCalendarConnection(); } catch (error) { setNotice(messageFor(error)); setBusy(false); } };
  const schedule = async () => { if (!status?.connectionId) return; setBusy(true); setNotice(''); try { const result = await scheduleCalendarBlock({ taskId: task.id, connectionId: status.connectionId, calendarId: targetCalendarId, startsAt: new Date(startsAt).toISOString(), durationMinutes: duration }); await onScheduled?.(); setNotice(result.eventUrl ? 'Calendar block confirmed. You can open it in Google Calendar.' : 'Calendar block confirmed.'); } catch (error) { setNotice(messageFor(error)); } finally { setBusy(false); } };
  const remove = async () => { if (!status?.connectionId) return; setBusy(true); setNotice(''); try { await removeCalendarBlock(task.id, status.connectionId); await onScheduled?.(); setNotice('Calendar block removed. Your task remains in Task-Laureate.'); } catch (error) { setNotice(messageFor(error)); } finally { setBusy(false); } };
  const sync = async () => { if (!status?.connectionId || !existingBlock) return; setBusy(true); setNotice(''); try { await reconcileCalendar(status.connectionId, existingBlock.calendar_id); await onScheduled?.(); setCheckedAt(new Date().toISOString()); setNotice('You are in sync. Any time changes from Google Calendar are now reflected in this task.'); } catch (error) { setNotice(messageFor(error)); } finally { setBusy(false); } };
  const disconnect = async () => { setBusy(true); setNotice(''); try { await disconnectGoogleCalendar(); setStatus({ status: 'disconnected' }); setNotice('Google Calendar disconnected. Existing calendar events were left untouched.'); onScheduled?.(); } catch (error) { setNotice(messageFor(error)); } finally { setBusy(false); } };
  if (!status) return <section className="calendar-schedule-control" aria-busy="true"><p>Checking calendar connection…</p></section>;
  if (status.status === 'unavailable') return <section className="calendar-schedule-control calendar-schedule-control--unavailable"><div><p className="calendar-schedule-control__eyebrow">Calendar</p><h3>Put focused work on your calendar</h3><p>One-way scheduling is not enabled in this environment. Your task stays private and unchanged.</p></div></section>;
  if (status.status !== 'connected') return <section className="calendar-schedule-control"><div><p className="calendar-schedule-control__eyebrow">Calendar</p><h3>Give this task a protected time</h3><p>Connect Google Calendar once. Task-Laureate will only create or update blocks you explicitly schedule—never import or alter your existing events.</p></div><button className="primary-button" type="button" disabled={busy} onClick={() => void connect()}>{busy ? 'Opening Google…' : status.status === 'reauthorization_required' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}</button>{notice ? <p role="status">{notice}</p> : null}</section>;
  const syncLabel = calendarSyncLabel(existingBlock, checkedAt);
  const presentation = calendarBlockPresentation(existingBlock);
  const googleCalendarUrl = existingBlock?.external_event_url ?? 'https://calendar.google.com/calendar/u/0/r';
  return <section className="calendar-schedule-control" aria-labelledby={`calendar-schedule-${task.id}`}>
    <div>
      <p className="calendar-schedule-control__eyebrow">Calendar block</p>
      <h3 id={`calendar-schedule-${task.id}`}>{presentation.heading}</h3>
      <p>{presentation.needsNewTime ? 'Google Calendar no longer has this block. The old time has been cleared and is not an active appointment. Choose a new time below when you want to add it back.' : existingBlock ? 'Open the exact event in Google Calendar, make any change there, then return here to confirm everything matches.' : 'A block is created only after Google Calendar confirms it. You can update or remove it here anytime.'}</p>
    </div>
    {existingBlock ? <div className={`calendar-schedule-control__sync-status${existingBlock.sync_state === 'removed_external' ? ' calendar-schedule-control__sync-status--attention' : ''}`} role="status">
      <span aria-hidden="true">{existingBlock.sync_state === 'removed_external' ? '!' : '✓'}</span>
      <div><strong>{syncLabel}</strong><small>{existingBlock.sync_state === 'removed_external' ? 'Pick a new time below to put this task back on your calendar.' : 'Google changes are applied only to this task’s own calendar block.'}</small></div>
    </div> : null}
    <div className="calendar-schedule-control__form"><label className="field"><span>{presentation.startLabel}</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} disabled={busy} /></label><label className="field"><span>Duration</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} disabled={busy}>{[5, 10, 15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? '' : 's'}`}</option>)}</select></label><label className="field"><span>Calendar</span>{existingBlock ? <div className="calendar-schedule-control__selected-calendar">{targetCalendar?.summary ?? (targetCalendarId === 'primary' ? 'Primary calendar' : targetCalendarId)}</div> : <select value={targetCalendarId} onChange={(event) => setCalendarId(event.target.value)} disabled={busy}>{status.calendars?.length ? status.calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.summary}{calendar.primary ? ' · Primary' : ''}</option>) : <option value="primary">Primary calendar</option>}</select>}{existingBlock ? <small>{presentation.needsNewTime ? 'The new block will use this calendar.' : 'Remove this block before choosing a different calendar.'}</small> : !status.calendars?.length ? <small>Using your Google primary calendar while the calendar list refreshes.</small> : null}</label></div>
    <div className="calendar-schedule-control__actions">
      {existingBlock && !presentation.needsNewTime ? <a className="primary-button" href={googleCalendarUrl} target="_blank" rel="noreferrer">Open in Google Calendar <span aria-hidden="true">↗</span></a> : null}
      <button className={existingBlock && !presentation.needsNewTime ? 'secondary-button' : 'primary-button'} type="button" disabled={busy || !canScheduleCalendarBlock({ startsAt, connected: status.status === 'connected' })} onClick={() => void schedule()}>{busy ? 'Confirming…' : presentation.scheduleLabel}</button>
      {existingBlock && !presentation.needsNewTime ? <button className="secondary-button" type="button" disabled={busy} onClick={() => void sync()}>{busy ? 'Checking…' : 'I made a change — check now'}</button> : null}
      {existingBlock ? <button className="secondary-button" type="button" disabled={busy} onClick={() => void remove()}>{presentation.needsNewTime ? 'Forget missing block' : 'Remove block'}</button> : null}
      <button className="calendar-schedule-control__disconnect" type="button" disabled={busy} onClick={() => void disconnect()}>Disconnect Google Calendar</button>
    </div>
    {notice ? <p className="calendar-schedule-control__notice" role="status">{notice}</p> : null}
  </section>;
}
