import { describe, expect, it } from 'vitest';
import { calendarSyncLabel } from './CalendarScheduleControl';

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
});
