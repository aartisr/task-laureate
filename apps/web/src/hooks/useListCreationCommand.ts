import { useEffect } from 'react';

export const listCreationCommandEvent = 'task-laureate:new-list';
const pendingListCreationKey = 'task-laureate.pending-new-list';

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function consumePendingListCreation() {
  if (!hasStorage() || window.sessionStorage.getItem(pendingListCreationKey) !== 'true') return false;
  window.sessionStorage.removeItem(pendingListCreationKey);
  return true;
}

/**
 * Request List creation from any navigation surface. The one-shot session
 * marker closes the timing gap when navigation unmounts the current page
 * before the Dashboard listener can receive the browser event.
 */
export function requestListCreation() {
  if (hasStorage()) window.sessionStorage.setItem(pendingListCreationKey, 'true');
  window.dispatchEvent(new Event(listCreationCommandEvent));
}

/** Keeps the Dashboard composer responsive both before and after navigation. */
export function useListCreationCommand(onRequest: () => void) {
  useEffect(() => {
    const openComposer = () => {
      consumePendingListCreation();
      onRequest();
    };
    window.addEventListener(listCreationCommandEvent, openComposer);
    if (consumePendingListCreation()) onRequest();
    return () => window.removeEventListener(listCreationCommandEvent, openComposer);
  }, [onRequest]);
}
