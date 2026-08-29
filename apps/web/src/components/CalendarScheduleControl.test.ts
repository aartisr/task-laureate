import { describe, expect, it } from 'vitest';
import { calendarBlockPresentation, calendarSyncLabel, canScheduleCalendarBlock, displayedCalendarDuration } from './CalendarScheduleControl';

describe('calendar sync checkpoint labels', () => {
  it('makes an unverified block explicit instead of implying it is synchronized', () => {
    expect(calendarSyncLabel({ sync_state: 'active' })).toBe('Ready to check');
  });

  it('shows a successful verification in the user’s local time', () => {
    expect(calendarSyncLabel({ sync_state: 'active', last_reconciled_at: '2026-08-13T14:30:00.000Z' })).toMatch(/^In sync · checked /);
  });

  it('uses the just-completed local check before the task query has refreshed', () => {
    expect(calendarSyncLabel({ sync_state: 'active' }, '2026-08-13T14:30:00.000Z')).toMatch(/^In sync · checked /);
  });

  it('gives deletions an actionable status', () => {
    expect(calendarSyncLabel({ sync_state: 'removed_external', last_reconciled_at: '2026-08-13T14:30:00.000Z' })).toBe('Needs a new time');
  });

  it('never presents the previous time as an active appointment after Google removes a block', () => {
    expect(calendarBlockPresentation({ sync_state: 'removed_external' })).toEqual({
      needsNewTime: true,
      heading: 'Choose a new time',
      startLabel: 'New start',
      scheduleLabel: 'Add a new calendar block',
    });
  });

  it('allows a missing block to be restored using its saved Google calendar even when the calendar list is empty', () => {
    expect(canScheduleCalendarBlock({ startsAt: '2026-08-13T11:15', connected: true })).toBe(true);
    expect(canScheduleCalendarBlock({ startsAt: '2026-08-13T11:15', connected: false })).toBe(false);
  });

  it('shows the externally reconciled calendar duration over a stale planning estimate', () => {
    expect(displayedCalendarDuration(30, { duration_minutes: 60, sync_state: 'active' })).toBe(60);
    expect(displayedCalendarDuration(30, { duration_minutes: 60, sync_state: 'removed_external' })).toBe(30);
  });
});
