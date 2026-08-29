/**
 * A small, application-wide journal of reversible user actions.
 *
 * Commands intentionally hold their own compensating operation instead of a
 * browser snapshot. That means an undo always goes through the repository and
 * cannot leave the UI cache out of sync with the data source.
 */
export interface UndoCommand {
  id: string;
  label: string;
  detail?: string;
  timestamp: number;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export interface UndoJournalState {
  undo: UndoCommand[];
  redo: UndoCommand[];
  busy: boolean;
  error: string | null;
}

/**
 * Recovery is deliberately opt-in in the interface: it is useful only after
 * there is a reversible action or a recovery failure to resolve.
 */
export function recoveryNeedsAttention(journal: UndoJournalState): boolean {
  return journal.undo.length > 0 || journal.redo.length > 0 || journal.error !== null;
}

const MAX_HISTORY = 100;
let state: UndoJournalState = { undo: [], redo: [], busy: false, error: null };
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<UndoJournalState>) {
  state = { ...state, ...next };
  publish();
}

export const undoJournal = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  record(command: Omit<UndoCommand, 'id' | 'timestamp'>) {
    const entry: UndoCommand = {
      ...command,
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    setState({ undo: [...state.undo, entry].slice(-MAX_HISTORY), redo: [], error: null });
  },
  async undo() {
    const command = state.undo.at(-1);
    if (!command || state.busy) return false;
    setState({ busy: true, error: null });
    try {
      await command.undo();
      setState({ undo: state.undo.slice(0, -1), redo: [...state.redo, command], busy: false });
      return true;
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : 'Undo could not be completed.' });
      return false;
    }
  },
  async redo() {
    const command = state.redo.at(-1);
    if (!command || state.busy) return false;
    setState({ busy: true, error: null });
    try {
      await command.redo();
      setState({ redo: state.redo.slice(0, -1), undo: [...state.undo, command], busy: false });
      return true;
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : 'Redo could not be completed.' });
      return false;
    }
  },
  async undoAll() {
    if (state.busy || state.undo.length === 0) return 0;
    let recovered = 0;
    while (state.undo.length > 0) {
      const succeeded = await this.undo();
      if (!succeeded) break;
      recovered++;
    }
    return recovered;
  },
  clear() {
    setState({ undo: [], redo: [], error: null });
  },
};
