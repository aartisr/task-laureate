import { describe, it, expect, beforeEach } from 'vitest';
import { createUndoStack, type Command, useUndoRedo } from './undoStack';

interface TestState {
  counter: number;
  items: string[];
}

describe('UndoStack', () => {
  let stack: ReturnType<typeof createUndoStack<TestState>>;
  let initialState: TestState;

  beforeEach(() => {
    initialState = { counter: 0, items: [] };
    stack = createUndoStack(initialState);
  });

  describe('Basic Execution', () => {
    it('should execute a command', () => {
      const command: Command<TestState> = {
        id: 'increment',
        timestamp: Date.now(),
        description: 'Increment counter',
        execute: (state) => ({ ...state, counter: state.counter + 1 }),
        undo: (state) => ({ ...state, counter: state.counter - 1 }),
      };

      stack.execute(command);

      expect(stack.getState().present.counter).toBe(1);
    });

    it('should track command history', () => {
      const cmd1: Command<TestState> = {
        id: 'add-1',
        timestamp: Date.now(),
        description: 'Add item 1',
        execute: (state) => ({ ...state, items: [...state.items, 'item1'] }),
        undo: (state) => ({ ...state, items: state.items.slice(0, -1) }),
      };

      const cmd2: Command<TestState> = {
        id: 'add-2',
        timestamp: Date.now(),
        description: 'Add item 2',
        execute: (state) => ({ ...state, items: [...state.items, 'item2'] }),
        undo: (state) => ({ ...state, items: state.items.slice(0, -1) }),
      };

      stack.execute(cmd1);
      stack.execute(cmd2);

      const state = stack.getState();
      expect(state.present.items).toEqual(['item1', 'item2']);
      expect(state.past).toHaveLength(2);
    });
  });

  describe('Undo', () => {
    it('should undo a command', () => {
      const command: Command<TestState> = {
        id: 'increment',
        timestamp: Date.now(),
        description: 'Increment',
        execute: (state) => ({ ...state, counter: state.counter + 1 }),
        undo: (state) => ({ ...state, counter: state.counter - 1 }),
      };

      stack.execute(command);
      expect(stack.getState().present.counter).toBe(1);

      stack.undo();
      expect(stack.getState().present.counter).toBe(0);
    });

    it('should not undo if no commands exist', () => {
      const result = stack.undo();

      expect(result).toBe(false);
      expect(stack.getState().present).toEqual(initialState);
    });

    it('should track undone commands in future', () => {
      const command: Command<TestState> = {
        id: 'test',
        timestamp: Date.now(),
        description: 'Test',
        execute: (state) => ({ ...state, counter: 1 }),
        undo: (state) => ({ ...state, counter: 0 }),
      };

      stack.execute(command);
      stack.undo();

      const state = stack.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(1);
    });

    it('should undo multiple commands in sequence', () => {
      for (let i = 0; i < 5; i++) {
        const cmd: Command<TestState> = {
          id: `cmd-${i}`,
          timestamp: Date.now(),
          description: `Command ${i}`,
          execute: (state) => ({ ...state, counter: state.counter + 1 }),
          undo: (state) => ({ ...state, counter: state.counter - 1 }),
        };
        stack.execute(cmd);
      }

      expect(stack.getState().present.counter).toBe(5);

      for (let i = 0; i < 5; i++) {
        stack.undo();
      }

      expect(stack.getState().present.counter).toBe(0);
    });
  });

  describe('Redo', () => {
    it('should redo an undone command', () => {
      const command: Command<TestState> = {
        id: 'increment',
        timestamp: Date.now(),
        description: 'Increment',
        execute: (state) => ({ ...state, counter: state.counter + 1 }),
        undo: (state) => ({ ...state, counter: state.counter - 1 }),
      };

      stack.execute(command);
      stack.undo();
      expect(stack.getState().present.counter).toBe(0);

      stack.redo();
      expect(stack.getState().present.counter).toBe(1);
    });

    it('should not redo if no undone commands exist', () => {
      const result = stack.redo();

      expect(result).toBe(false);
    });

    it('should clear future when new command is executed after undo', () => {
      const cmd1: Command<TestState> = {
        id: 'cmd1',
        timestamp: Date.now(),
        description: 'Command 1',
        execute: (state) => ({ ...state, counter: 1 }),
        undo: (state) => ({ ...state, counter: 0 }),
      };

      const cmd2: Command<TestState> = {
        id: 'cmd2',
        timestamp: Date.now(),
        description: 'Command 2',
        execute: (state) => ({ ...state, counter: 2 }),
        undo: (state) => ({ ...state, counter: 1 }),
      };

      stack.execute(cmd1);
      stack.undo();
      expect(stack.getState().future).toHaveLength(1);

      stack.execute(cmd2);
      expect(stack.getState().future).toHaveLength(0);
      expect(stack.getState().present.counter).toBe(2);
    });
  });

  describe('State Queries', () => {
    it('should report canUndo correctly', () => {
      expect(stack.canUndo()).toBe(false);

      const command: Command<TestState> = {
        id: 'test',
        timestamp: Date.now(),
        description: 'Test',
        execute: (state) => ({ ...state, counter: 1 }),
        undo: (state) => ({ ...state, counter: 0 }),
      };

      stack.execute(command);
      expect(stack.canUndo()).toBe(true);

      stack.undo();
      expect(stack.canUndo()).toBe(false);
    });

    it('should report canRedo correctly', () => {
      expect(stack.canRedo()).toBe(false);

      const command: Command<TestState> = {
        id: 'test',
        timestamp: Date.now(),
        description: 'Test',
        execute: (state) => ({ ...state, counter: 1 }),
        undo: (state) => ({ ...state, counter: 0 }),
      };

      stack.execute(command);
      expect(stack.canRedo()).toBe(false);

      stack.undo();
      expect(stack.canRedo()).toBe(true);

      stack.redo();
      expect(stack.canRedo()).toBe(false);
    });
  });

  describe('Stack Management', () => {
    it('should enforce max size limit', () => {
      const smallStack = createUndoStack(initialState, { maxSize: 5 });

      for (let i = 0; i < 10; i++) {
        const cmd: Command<TestState> = {
          id: `cmd-${i}`,
          timestamp: Date.now(),
          description: `Command ${i}`,
          execute: (state) => ({ ...state, counter: state.counter + 1 }),
          undo: (state) => ({ ...state, counter: state.counter - 1 }),
        };
        smallStack.execute(cmd);
      }

      expect(smallStack.getState().past).toHaveLength(5);
      expect(smallStack.getState().present.counter).toBe(10);
    });

    it('should clear undo/redo history', () => {
      const command: Command<TestState> = {
        id: 'test',
        timestamp: Date.now(),
        description: 'Test',
        execute: (state) => ({ ...state, counter: 1 }),
        undo: (state) => ({ ...state, counter: 0 }),
      };

      stack.execute(command);
      stack.undo();

      stack.clear();

      expect(stack.canUndo()).toBe(false);
      expect(stack.canRedo()).toBe(false);
      expect(stack.getState().past).toHaveLength(0);
      expect(stack.getState().future).toHaveLength(0);
    });
  });

  describe('History', () => {
    it('should provide full history', () => {
      for (let i = 0; i < 3; i++) {
        const cmd: Command<TestState> = {
          id: `cmd-${i}`,
          timestamp: Date.now(),
          description: `Command ${i}`,
          execute: (state) => ({ ...state, counter: state.counter + 1 }),
          undo: (state) => ({ ...state, counter: state.counter - 1 }),
        };
        stack.execute(cmd);
      }

      const history = stack.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].state.counter).toBe(0);
      expect(history[1].state.counter).toBe(1);
      expect(history[2].state.counter).toBe(2);
    });
  });

  describe('Hook', () => {
    it('should work with useUndoRedo hook', () => {
      const undo = useUndoRedo(initialState);

      const command: Command<TestState> = {
        id: 'test',
        timestamp: Date.now(),
        description: 'Test',
        execute: (state) => ({ ...state, counter: 1 }),
        undo: (state) => ({ ...state, counter: 0 }),
      };

      undo.execute(command);
      expect(undo.state().counter).toBe(1);

      undo.undo();
      expect(undo.state().counter).toBe(0);

      undo.redo();
      expect(undo.state().counter).toBe(1);
    });
  });
});
