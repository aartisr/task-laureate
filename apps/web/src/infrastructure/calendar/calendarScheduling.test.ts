import { describe, expect, it } from 'vitest';
import { normalizeCalendarStatus, type CalendarBlock } from './calendarScheduling';

describe('calendar scheduling response boundary', () => {
  it('models a reconciled block duration as provider-confirmed state', () => {
    const block: CalendarBlock = { id: 'block-1', calendar_id: 'primary', starts_at: '2026-08-13T17:00:00.000Z', duration_minutes: 60, sync_state: 'active' };
    expect(block.duration_minutes).toBe(60);
  });
  it('turns empty or malformed API payloads into a safe unavailable state', () => {
    expect(normalizeCalendarStatus(null)).toEqual({ status: 'unavailable' });
    expect(normalizeCalendarStatus({ status: 'connected', calendars: null })).toEqual({ status: 'connected' });
    expect(normalizeCalendarStatus({ status: 'unknown' })).toEqual({ status: 'unavailable' });
  });

  it('keeps only well-formed calendar options before they reach the task UI', () => {
    expect(normalizeCalendarStatus({
      status: 'connected',
      connectionId: 'connection-1',
      redirectUri: 'https://tasks.example.com/api/calendar/google/callback',
      calendars: [
        { id: 'primary', summary: 'Primary', primary: true },
        { id: 12, summary: 'Invalid', primary: false },
      ],
    })).toEqual({
      status: 'connected',
      connectionId: 'connection-1',
      redirectUri: 'https://tasks.example.com/api/calendar/google/callback',
      calendars: [{ id: 'primary', summary: 'Primary', primary: true }],
    });
  });
});
