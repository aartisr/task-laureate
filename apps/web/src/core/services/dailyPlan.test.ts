import { describe, expect, it } from 'vitest';
import { addDailyCommitment, localDayKey, readDailyPlan, removeDailyCommitment, saveDailyPlan } from './dailyPlan';

describe('daily plan', () => {
  it('uses a local calendar date, not a UTC date', () => expect(localDayKey(new Date(2026, 0, 2, 23, 0))).toBe('2026-01-02'));
  it('bounds commitments to three and supports releasing one', () => {
    localStorage.clear();
    addDailyCommitment('a'); addDailyCommitment('b'); addDailyCommitment('c'); addDailyCommitment('d');
    expect(readDailyPlan().taskIds).toEqual(['a', 'b', 'c']);
    expect(removeDailyCommitment('c').taskIds).toEqual(['a', 'b']);
  });
  it('persists a completed shutdown reflection', () => {
    localStorage.clear();
    saveDailyPlan({ closedAt: '2026-01-02T20:00:00.000Z', reflection: 'Protected focus time.' });
    expect(readDailyPlan()).toMatchObject({ reflection: 'Protected focus time.', closedAt: '2026-01-02T20:00:00.000Z' });
  });
});
