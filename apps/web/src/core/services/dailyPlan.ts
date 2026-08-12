import type { EnergyLevel } from '../domain/antiBacklog';

export interface DailyPlan {
  date: string;
  taskIds: string[];
  energyLevel: EnergyLevel;
  availableMinutes: number;
  closedAt: string | null;
  reflection: string;
}

const storagePrefix = 'task-laureate.daily-plan.v1.';

export function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultPlan(date: string): DailyPlan {
  return { date, taskIds: [], energyLevel: 'deep', availableMinutes: 25, closedAt: null, reflection: '' };
}

/**
 * A deliberately tiny, local-first aggregate for the daily ritual. It keeps
 * execution state separate from task metadata and can later gain a remote
 * repository without changing the consuming UI.
 */
export function readDailyPlan(date = localDayKey()): DailyPlan {
  if (typeof window === 'undefined') return defaultPlan(date);
  try {
    const raw = window.localStorage.getItem(`${storagePrefix}${date}`);
    if (!raw) return defaultPlan(date);
    const parsed = JSON.parse(raw) as Partial<DailyPlan>;
    return {
      ...defaultPlan(date),
      ...parsed,
      date,
      taskIds: Array.isArray(parsed.taskIds) ? [...new Set(parsed.taskIds.filter((id): id is string => typeof id === 'string'))].slice(0, 3) : [],
    };
  } catch {
    return defaultPlan(date);
  }
}

export function saveDailyPlan(update: Partial<Omit<DailyPlan, 'date'>> & { date?: string }): DailyPlan {
  const date = update.date ?? localDayKey();
  const next: DailyPlan = {
    ...readDailyPlan(date),
    ...update,
    date,
    taskIds: update.taskIds ? [...new Set(update.taskIds)].slice(0, 3) : readDailyPlan(date).taskIds,
  };
  if (typeof window !== 'undefined') window.localStorage.setItem(`${storagePrefix}${date}`, JSON.stringify(next));
  return next;
}

export function addDailyCommitment(taskId: string): DailyPlan {
  const current = readDailyPlan();
  return saveDailyPlan({ taskIds: current.taskIds.includes(taskId) ? current.taskIds : [...current.taskIds, taskId].slice(0, 3) });
}

export function removeDailyCommitment(taskId: string): DailyPlan {
  return saveDailyPlan({ taskIds: readDailyPlan().taskIds.filter((id) => id !== taskId) });
}
