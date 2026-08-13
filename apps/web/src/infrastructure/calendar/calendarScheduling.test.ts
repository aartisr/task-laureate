import { describe, expect, it } from 'vitest';
import { normalizeCalendarStatus } from './calendarScheduling';

describe('calendar scheduling response boundary', () => {
  it('turns empty or malformed API payloads into a safe unavailable state', () => {
    expect(normalizeCalendarStatus(null)).toEqual({ status: 'unavailable' });
    expect(normalizeCalendarStatus({ status: 'connected', calendars: null })).toEqual({ status: 'connected' });
    expect(normalizeCalendarStatus({ status: 'unknown' })).toEqual({ status: 'unavailable' });
  });

  it('keeps only well-formed calendar options before they reach the task UI', () => {
    expect(normalizeCalendarStatus({
      status: 'connected',
      connectionId: 'connection-1',
      calendars: [
        { id: 'primary', summary: 'Primary', primary: true },
        { id: 12, summary: 'Invalid', primary: false },
      ],
    })).toEqual({
      status: 'connected',
      connectionId: 'connection-1',
      calendars: [{ id: 'primary', summary: 'Primary', primary: true }],
    });
  });
});
