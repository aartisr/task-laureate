const reloadMarker = 'task-laureate:module-recovery-attempted';

export const isModuleVersionMismatch = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  return /failed to fetch dynamically imported module|expected a javascript-or-wasm module script|importing a module script failed|text\/html.{0,120}(?:valid|invalid).{0,120}(?:javascript|module)|(?:javascript|module).{0,120}mime.{0,120}text\/html/i.test(message);
};

/**
 * A Vite deployment gives every lazy chunk a content hash. A tab that remains
 * open during a deployment can briefly request a chunk from its previous
 * version. Refresh once to load one coherent asset graph, then preserve the
 * normal error path if the failure is unrelated or persists.
 */
export function recoverFromModuleVersionMismatch(reason: unknown): boolean {
  if (!isModuleVersionMismatch(reason) || typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(reloadMarker) === 'true') return false;
    window.sessionStorage.setItem(reloadMarker, 'true');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function installModuleVersionRecovery() {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    if (recoverFromModuleVersionMismatch(event.payload)) event.preventDefault();
  });
  window.addEventListener('error', (event) => {
    recoverFromModuleVersionMismatch(event.error ?? event.message);
  });
}
