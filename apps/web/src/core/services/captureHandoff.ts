const pendingCaptureKey = 'task-laureate.pending-capture.v1';
export const pendingCaptureEvent = 'task-laureate:pending-capture';

export interface PendingCapture {
  text: string;
  sourceUrl?: string;
}

export function stagePendingCapture(capture: PendingCapture) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(pendingCaptureKey, JSON.stringify(capture));
  window.dispatchEvent(new Event(pendingCaptureEvent));
}

export function readPendingCapture(): PendingCapture | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(pendingCaptureKey) ?? 'null') as PendingCapture | null;
    return parsed?.text?.trim() ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingCapture() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(pendingCaptureKey);
}
