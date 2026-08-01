export type PersistencePhase = 'local' | 'connecting' | 'synced' | 'saving' | 'error';

export interface PersistenceStatus {
  phase: PersistencePhase;
  detail: string;
  updatedAt: string;
}

let current: PersistenceStatus = { phase: 'local', detail: 'Saving to this browser only.', updatedAt: new Date().toISOString() };
const listeners = new Set<(status: PersistenceStatus) => void>();

export function getPersistenceStatus() {
  return current;
}

export function setPersistenceStatus(phase: PersistencePhase, detail: string) {
  current = { phase, detail, updatedAt: new Date().toISOString() };
  listeners.forEach((listener) => listener(current));
}

export function subscribeToPersistenceStatus(listener: (status: PersistenceStatus) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
