import { describe, expect, it } from 'vitest';
import { recoveryNeedsAttention, undoJournal } from './undoJournal';

describe('undoJournal', () => {
  it('only requests recovery attention for an actionable or failed recovery state', async () => {
    undoJournal.clear();
    expect(recoveryNeedsAttention(undoJournal.getSnapshot())).toBe(false);

    undoJournal.record({ label: 'Change', undo: async () => undefined, redo: async () => undefined });
    expect(recoveryNeedsAttention(undoJournal.getSnapshot())).toBe(true);

    await undoJournal.undo();
    expect(recoveryNeedsAttention(undoJournal.getSnapshot())).toBe(true);

    undoJournal.clear();
    expect(recoveryNeedsAttention(undoJournal.getSnapshot())).toBe(false);
  });

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
