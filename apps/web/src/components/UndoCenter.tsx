import { useEffect, useSyncExternalStore } from 'react';
import { undoJournal } from '../core/mutations/undoJournal';

export function UndoCenter() {
  const journal = useSyncExternalStore(undoJournal.subscribe, undoJournal.getSnapshot, undoJournal.getSnapshot);
  const latest = journal.undo.at(-1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      void (event.shiftKey ? undoJournal.redo() : undoJournal.undo());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <section className="undo-center" aria-label="Change recovery">
      <div className="undo-center__summary" aria-live="polite">
        <span className="undo-center__eyebrow">Recovery</span>
        <span>{latest ? `${latest.label} · ${journal.undo.length} recoverable` : 'All changes are safe'}</span>
      </div>
      <div className="undo-center__actions">
        <button type="button" className="undo-center__button" onClick={() => void undoJournal.undo()} disabled={!latest || journal.busy} title="Undo (⌘/Ctrl + Z)">
          ↶ Undo
        </button>
        <button type="button" className="undo-center__button" onClick={() => void undoJournal.redo()} disabled={journal.redo.length === 0 || journal.busy} title="Redo (⌘/Ctrl + Shift + Z)">
          ↷ Redo
        </button>
        {journal.undo.length > 1 ? (
          <button type="button" className="undo-center__button undo-center__button--all" onClick={() => void undoJournal.undoAll()} disabled={journal.busy} title={`Undo all ${journal.undo.length} recent changes`}>
            Undo all
          </button>
        ) : null}
      </div>
      {journal.error ? <p className="undo-center__error" role="alert">{journal.error}</p> : null}
    </section>
  );
}
