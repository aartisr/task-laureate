import { describe, expect, it } from 'vitest';
import { undoJournal } from './undoJournal';

describe('undoJournal', () => {
  it('reverses commands in order, redoes them, and clears redo after a new change', async () => {
    undoJournal.clear();
    let value = 2;
    undoJournal.record({ label: 'Increment', undo: async () => { value--; }, redo: async () => { value++; } });

    await undoJournal.undo();
    expect(value).toBe(1);
    expect(undoJournal.getSnapshot().redo).toHaveLength(1);

    await undoJournal.redo();
    expect(value).toBe(2);
    undoJournal.record({ label: 'Another change', undo: async () => { value--; }, redo: async () => { value++; } });
    expect(undoJournal.getSnapshot().redo).toHaveLength(0);
  });

  it('undoes every recoverable command without skipping an entry', async () => {
    undoJournal.clear();
    const values: string[] = ['a', 'b', 'c'];
    for (const value of [...values]) {
      undoJournal.record({
        label: value,
        undo: async () => { values.pop(); },
        redo: async () => { values.push(value); },
      });
    }

    await undoJournal.undoAll();
    expect(values).toEqual([]);
    expect(undoJournal.getSnapshot().redo).toHaveLength(3);
  });
});
