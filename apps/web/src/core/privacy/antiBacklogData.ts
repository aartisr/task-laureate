const keys = ['task-laureate.task-planning.v1', 'task-laureate.today-commitments'];
export function exportAntiBacklogData() { return JSON.stringify({ format: 'task-laureate/anti-backlog', version: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(keys.map((key) => [key, typeof window === 'undefined' ? null : window.localStorage.getItem(key)])) }, null, 2); }
export function deleteAntiBacklogData() { if (typeof window !== 'undefined') keys.forEach((key) => window.localStorage.removeItem(key)); }
