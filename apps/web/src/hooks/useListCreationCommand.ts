import { useEffect } from 'react';

export const listCreationCommandEvent = 'task-laureate:new-list';

/** Request List creation from any navigation surface without coupling it to a route remount. */
export function requestListCreation() {
  window.dispatchEvent(new Event(listCreationCommandEvent));
}

/** Keeps the Dashboard composer responsive when the Dashboard is already mounted. */
export function useListCreationCommand(onRequest: () => void) {
  useEffect(() => {
    window.addEventListener(listCreationCommandEvent, onRequest);
    return () => window.removeEventListener(listCreationCommandEvent, onRequest);
  }, [onRequest]);
}
