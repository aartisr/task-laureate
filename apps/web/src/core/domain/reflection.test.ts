import { describe, expect, it } from 'vitest';
import { buildWeeklyReflection } from './reflection';

describe('weekly reflection', () => {
  it('projects recent completion events into non-punitive facts', () => {
    const summary = buildWeeklyReflection([
      { occurredAt: '2026-08-10T12:00:00Z', energyLevel: 'deep', estimateMinutes: 30 },
      { occurredAt: '2026-08-10T13:00:00Z', energyLevel: 'quick', estimateMinutes: 10 },
      { occurredAt: '2026-07-01T12:00:00Z', energyLevel: 'light', estimateMinutes: 20 },
    ], new Date('2026-08-11T12:00:00Z'));
    expect(summary).toMatchObject({ completedCount: 2, byEnergy: { deep: 1, light: 0, quick: 1 }, estimatedMinutesCompleted: 40, mostProductiveWeekday: 'Monday' });
  });
});
