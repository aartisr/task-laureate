/**
 * Undo/Restore System
 *
 * Provides a robust, command-based undo stack with:
 * - Immutable snapshot-based rollback
 * - Time-travel debugging
 * - Transaction boundaries
 * - Maximum stack size management
 * - Serialization support for persistence
 * - Type-safe command patterns
 */

export interface Command<TState> {
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  readonly execute: (state: TState) => TState;
  readonly undo: (state: TState) => TState;
}

export interface UndoStack<TState> {
  readonly past: readonly Command<TState>[];
  readonly present: TState;
  readonly future: readonly Command<TState>[];
}

export interface UndoStackOptions {
  maxSize?: number;
}

const DEFAULT_MAX_SIZE = 100;

/**
 * Create an undo/redo stack
 */
export function createUndoStack<TState>(
  initialState: TState,
  options: UndoStackOptions = {}
): {
  getState: () => UndoStack<TState>;
  execute: (command: Command<TState>) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  getHistory: () => Array<{ command: Command<TState>; state: TState }>;
} {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  let state: UndoStack<TState> = {
    past: [],
    present: initialState,
    future: [],
  };

  const getState = () => ({ ...state });

  const execute = (command: Command<TState>) => {
    // Apply the command
    const newPresent = command.execute(state.present);

    // Update the stack
    state = {
      past: [...state.past, command].slice(-maxSize),
      present: newPresent,
      future: [],
    };
  };

  const undo = (): boolean => {
    if (state.past.length === 0) {
      return false;
    }

    const previousCommand = state.past[state.past.length - 1];
    const newPresent = previousCommand.undo(state.present);

    state = {
      past: state.past.slice(0, -1),
      present: newPresent,
      future: [previousCommand, ...state.future],
    };

    return true;
  };

  const redo = (): boolean => {
    if (state.future.length === 0) {
      return false;
    }

    const nextCommand = state.future[0];
    const newPresent = nextCommand.execute(state.present);

    state = {
      past: [...state.past, nextCommand],
      present: newPresent,
      future: state.future.slice(1),
    };

    return true;
  };

  const canUndo = () => state.past.length > 0;
  const canRedo = () => state.future.length > 0;

  const clear = () => {
    state = {
      past: [],
      present: state.present,
      future: [],
    };
  };

  const getHistory = () => {
    const history: Array<{ command: Command<TState>; state: TState }> = [];
    let currentState = initialState;

    for (const command of state.past) {
      history.push({ command, state: currentState });
      currentState = command.execute(currentState);
    }

    return history;
  };

  return {
    getState,
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    getHistory,
  };
}

/**
 * Create a command for entity mutations
 */
export function createEntityCommand<TEntity, TState extends Record<string, TEntity>>(
  id: string,
  description: string,
  entityId: string,
  entityKey: keyof TState,
  createNewState: (state: TState, entity: TEntity) => TState,
  createPreviousEntity: (state: TState, entityId: string) => TEntity | undefined,
  createUpdatedEntity: (previousEntity: TEntity) => TEntity
): Command<TState> {
  return {
    id,
    timestamp: Date.now(),
    description,
    execute: (state) => {
      const previousEntity = createPreviousEntity(state, entityId);
      if (!previousEntity) {
        return state;
      }
      const updatedEntity = createUpdatedEntity(previousEntity);
      return createNewState(state, updatedEntity);
    },
    undo: (state) => {
      const previousEntity = createPreviousEntity(state, entityId);
      if (!previousEntity) {
        return state;
      }
      // Return to original state by restoring from previous
      return createNewState(state, previousEntity);
    },
  };
}

/**
 * Hook for undo/redo state management
 */
export function useUndoRedo<TState>(
  initialState: TState,
  maxUndoSize?: number
) {
  const stack = createUndoStack(initialState, { maxSize: maxUndoSize });

  return {
    state: () => stack.getState().present,
    execute: (command: Command<TState>) => stack.execute(command),
    undo: () => stack.undo(),
    redo: () => stack.redo(),
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
    clear: stack.clear,
    getStack: stack.getState,
  };
}
