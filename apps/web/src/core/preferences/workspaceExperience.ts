import { useSyncExternalStore } from 'react';

export type WorkspaceExperience = 'focus' | 'workspace';

const storageKey = 'task-laureate.workspace-experience';
const listeners = new Set<() => void>();

function readExperience(): WorkspaceExperience {
  if (typeof window === 'undefined') return 'focus';
  try {
    return window.localStorage.getItem(storageKey) === 'workspace' ? 'workspace' : 'focus';
  } catch {
    return 'focus';
  }
}

export function getWorkspaceExperience() {
  return readExperience();
}

export function setWorkspaceExperience(experience: WorkspaceExperience) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(storageKey, experience); } catch { /* private browsing or storage limits */ }
  }
  listeners.forEach((listener) => listener());
}

export function toggleWorkspaceExperience() {
  setWorkspaceExperience(readExperience() === 'focus' ? 'workspace' : 'focus');
}

export function subscribeToWorkspaceExperience(listener: () => void) {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => listeners.delete(listener);
  const handleStorage = (event: StorageEvent) => { if (event.key === storageKey) listener(); };
  window.addEventListener('storage', handleStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', handleStorage); };
}

export function useWorkspaceExperience() {
  return useSyncExternalStore<WorkspaceExperience>(subscribeToWorkspaceExperience, getWorkspaceExperience, () => 'focus');
}