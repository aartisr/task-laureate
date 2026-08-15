import { describe, expect, it } from 'vitest';
import { formatDateOnly, getDueDateState, isDueDateBeforeToday, isDueDateToday, localDate, toDateInputValue } from './dateOnly';

describe('date-only helpers', () => {
  it('preserves API date values and accepts legacy timestamp values without timezone conversion', () => {
    expect(toDateInputValue('2026-08-05')).toBe('2026-08-05');
    expect(toDateInputValue('2026-08-05T00:00:00.000Z')).toBe('2026-08-05');
  });

  it('does not put malformed or impossible values into a native date input', () => {
    expect(toDateInputValue('2026-02-30')).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
    expect(toDateInputValue(null)).toBe('');
  });

  it('calculates quick choices as local calendar days', () => {
    expect(localDate(1, new Date(2026, 7, 5, 12, 0, 0))).toBe('2026-08-06');
  });

  it('compares and formats calendar days without treating them as UTC instants', () => {
    const now = new Date('2026-08-05T12:00:00-04:00');
    expect(isDueDateBeforeToday('2026-08-04', now)).toBe(true);
    expect(isDueDateToday('2026-08-05', now)).toBe(true);
    expect(formatDateOnly('2026-08-05', 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })).toBe('Aug 5, 2026');
  });

  it('does not mark a Sept 7 task overdue at any time on Sept 7 locally', () => {
    // Construct local calendar times. An ISO value with `-04:00` represents an
    // absolute instant; in UTC CI that instant is already Sept 8, which is not
    // the local-calendar scenario this test is exercising.
    const lateOnDueDate = new Date(2026, 8, 7, 23, 59, 59);

    expect(getDueDateState('2026-09-07', lateOnDueDate)).toBe('today');
    expect(getDueDateState('2026-09-07T00:00:00.000Z', lateOnDueDate)).toBe('today');
    expect(isDueDateBeforeToday('2026-09-07', lateOnDueDate)).toBe(false);
    expect(getDueDateState('2026-09-07', new Date(2026, 8, 8, 0, 0, 0))).toBe('overdue');
  });
});
