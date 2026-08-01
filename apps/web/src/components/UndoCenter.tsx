import { useSyncExternalStore } from 'react';
import { recoveryNeedsAttention, undoJournal } from '../core/mutations/undoJournal';

export function UndoCenter() {
  const journal = useSyncExternalStore(undoJournal.subscribe, undoJournal.getSnapshot, undoJournal.getSnapshot);
  const latest = journal.undo.at(-1);

  if (!recoveryNeedsAttention(journal)) return null;

  const title = journal.error
    ? 'A recent change needs attention'
    : journal.undo.length > 0
      ? 'Restore a recent change'
      : 'Redo a recent change';
  const description = journal.error
    ? journal.error
    : latest
      ? `${latest.label}. You can restore it from here.`
      : `${journal.redo.length} reverted ${journal.redo.length === 1 ? 'change is' : 'changes are'} available to redo.`;

  return (
    <section className="recovery-panel" aria-labelledby="recovery-title" aria-live={journal.error ? 'assertive' : 'polite'}>
      <div className="recovery-panel__copy">
        <p className="recovery-panel__eyebrow">Recent changes</p>
        <h2 id="recovery-title">{title}</h2>
        <p>{description}</p>
      </div>
      <div className="recovery-panel__actions">
        {latest ? (
          <button type="button" className="recovery-panel__button recovery-panel__button--primary" onClick={() => void undoJournal.undo()} disabled={journal.busy}>
            Restore latest
          </button>
        ) : null}
        <button type="button" className="recovery-panel__button" onClick={() => void undoJournal.redo()} disabled={journal.redo.length === 0 || journal.busy}>
          Redo
        </button>
        {journal.undo.length > 1 ? (
          <button type="button" className="recovery-panel__button" onClick={() => void undoJournal.undoAll()} disabled={journal.busy}>
            Restore all ({journal.undo.length})
          </button>
        ) : null}
        <button type="button" className="recovery-panel__button recovery-panel__button--quiet" onClick={() => undoJournal.clear()} disabled={journal.busy}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
