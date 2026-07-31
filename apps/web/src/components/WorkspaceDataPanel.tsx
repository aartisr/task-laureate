import { useRef, useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { createWorkspaceExport, parseWorkspaceExport } from '../infrastructure/persistence/workspace';
import { undoJournal } from '../core/mutations/undoJournal';

export function WorkspaceDataPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportData = async () => {
    const workspace = await appServices.repository.exportWorkspace();
    const payload = JSON.stringify(createWorkspaceExport(workspace), null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-laureate-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Export complete. Your portable workspace file is ready.');
  };

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const workspace = parseWorkspaceExport(await file.text()).data;
      if (!window.confirm(`Replace this workspace with ${workspace.lists.length} lists and ${workspace.tasks.length} tasks from “${file.name}”?`)) return;
      await appServices.repository.importWorkspace(workspace);
      undoJournal.clear();
      appServices.queryClient.clear();
      setMessage('Import complete. Reloading your workspace…');
      window.setTimeout(() => window.location.assign('/'), 350);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The import could not be completed.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="workspace-data-panel" aria-labelledby="workspace-data-title">
      <div>
        <p className="workspace-data-panel__eyebrow">Portable workspace</p>
        <h2 id="workspace-data-title">Your data, your destination</h2>
        <p>Export a versioned JSON archive or import it on any Task-Laureate installation. The same contract can be backed by SQLite, Postgres, IndexedDB, an API, or your own adapter.</p>
      </div>
      <div className="workspace-data-panel__actions">
        <button type="button" className="workspace-data-panel__button" onClick={() => void exportData()}>Export workspace</button>
        <button type="button" className="workspace-data-panel__button workspace-data-panel__button--secondary" onClick={() => inputRef.current?.click()}>Import workspace</button>
        <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importData(event.target.files?.[0])} />
      </div>
      {message ? <p className="workspace-data-panel__message" role="status">{message}</p> : null}
    </section>
  );
}
