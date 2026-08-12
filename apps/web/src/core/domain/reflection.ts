export interface CompletionEvent {
  occurredAt: string;
  energyLevel: 'deep' | 'light' | 'quick' | null;
  estimateMinutes: number | null;
}

export interface WeeklyReflection {
  completedCount: number;
  byEnergy: Record<'deep' | 'light' | 'quick', number>;
  estimatedMinutesCompleted: number;
  mostProductiveWeekday: string | null;
}

/** Pure projection: analytics never mutates task data or relies on UI counters. */
export function buildWeeklyReflection(events: CompletionEvent[], now = new Date()): WeeklyReflection {
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  const byEnergy = { deep: 0, light: 0, quick: 0 };
  const weekdays = new Map<string, number>();
  let estimatedMinutesCompleted = 0;
  let completedCount = 0;
  for (const event of events) {
    const date = new Date(event.occurredAt);
    if (Number.isNaN(date.getTime()) || date < start || date > now) continue;
    completedCount += 1;
    if (event.energyLevel) byEnergy[event.energyLevel] += 1;
    estimatedMinutesCompleted += event.estimateMinutes ?? 0;
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    weekdays.set(weekday, (weekdays.get(weekday) ?? 0) + 1);
  }
  const mostProductiveWeekday = [...weekdays.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { completedCount, byEnergy, estimatedMinutesCompleted, mostProductiveWeekday };
}
