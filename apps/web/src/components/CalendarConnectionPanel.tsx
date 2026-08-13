import { useEffect, useState } from 'react';
import {
  beginGoogleCalendarConnection,
  disconnectGoogleCalendar,
  getCalendarStatus,
  type CalendarStatus,
} from '../infrastructure/calendar/calendarScheduling';

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'reauthorization_required') return 'Google needs permission again. Reconnect your calendar to continue.';
  if (code === 'disabled') return 'Calendar scheduling is not enabled for this environment.';
  return 'We could not update the calendar connection. Your tasks have not been changed.';
}

function RedirectUri({ value }: { value?: string | null }) {
  if (!value) return null;
  return <p className="calendar-connection-panel__redirect"><span>Google redirect URI</span><code>{value}</code></p>;
}

/**
 * A provider-neutral account-level entry point. Task pages own scheduling;
 * Settings owns connection lifecycle, keeping the two decisions separate.
 */
export function CalendarConnectionPanel({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<CalendarStatus | null>(enabled ? null : { status: 'unavailable' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [checkVersion, setCheckVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus({ status: 'unavailable' });
      return;
    }

    let active = true;
    const fallbackId = window.setTimeout(() => {
      if (active) setStatus({ status: 'unavailable' });
    }, 8_500);
    void getCalendarStatus()
      .then((next) => { if (active) setStatus(next); })
      .catch(() => { if (active) setStatus({ status: 'unavailable' }); })
      .finally(() => window.clearTimeout(fallbackId));
    return () => { active = false; window.clearTimeout(fallbackId); };
  }, [enabled, checkVersion]);

  const connect = async () => {
    setBusy(true);
    setNotice('');
    try {
      await beginGoogleCalendarConnection();
    } catch (error) {
      setNotice(messageFor(error));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setNotice('');
    try {
      await disconnectGoogleCalendar();
      setStatus({ status: 'disconnected' });
      setNotice('Google Calendar disconnected. Existing calendar events were left untouched.');
    } catch (error) {
      setNotice(messageFor(error));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <section className="calendar-connection-panel" aria-busy="true"><p>Checking calendar connection…</p></section>;

  if (status.status === 'unavailable') {
    return <section className="calendar-connection-panel calendar-connection-panel--unavailable">
      <div>
        <p className="calendar-connection-panel__eyebrow">Calendar scheduling</p>
        <h3>Calendar scheduling is unavailable right now</h3>
        <p>Google Calendar may not be enabled for this workspace, or the connection check could not finish. Your tasks are safe and unchanged.</p>
        <RedirectUri value={status.redirectUri} />
      </div>
      {enabled ? <button className="secondary-button" type="button" onClick={() => { setStatus(null); setCheckVersion((version) => version + 1); }}>Retry connection check</button> : null}
    </section>;
  }

  if (status.status !== 'connected') {
    return <section className="calendar-connection-panel">
      <div>
        <p className="calendar-connection-panel__eyebrow">Google Calendar</p>
        <h3>Connect once, schedule deliberately</h3>
        <p>Task-Laureate only creates or updates blocks that you explicitly schedule. It never imports, edits, or removes your existing calendar events.</p>
        <RedirectUri value={status.redirectUri} />
      </div>
      <button className="primary-button" type="button" disabled={busy} onClick={() => void connect()}>
        {busy ? 'Opening Google…' : status.status === 'reauthorization_required' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
      </button>
      {notice ? <p className="calendar-connection-panel__notice" role="status">{notice}</p> : null}
    </section>;
  }

  return <section className="calendar-connection-panel">
    <div>
      <p className="calendar-connection-panel__eyebrow">Google Calendar connected</p>
      <h3>Ready when a task deserves protected time</h3>
      <p>Open any editable task to choose a start time and create a one-way calendar block. Calendar changes remain under your control.</p>
      <RedirectUri value={status.redirectUri} />
    </div>
    <button className="secondary-button" type="button" disabled={busy} onClick={() => void disconnect()}>
      {busy ? 'Disconnecting…' : 'Disconnect Google Calendar'}
    </button>
    {notice ? <p className="calendar-connection-panel__notice" role="status">{notice}</p> : null}
  </section>;
}
