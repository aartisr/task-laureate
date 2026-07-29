import { useState, useCallback, useMemo, useRef } from 'react';
import { announceToScreenReader, createId } from '../lib/a11y';
import type { TodoItem } from '../core/contracts/domain';
import { TaskItem } from './TaskItem';
import { DraggableItem } from './DraggableItem';
import { useDragDrop } from '../hooks/useDragDrop';

export interface TaskListProps {
  listId: string;
  tasks: TodoItem[];
  isLoading?: boolean;
  onTaskUpdate: (id: string, data: Partial<TodoItem>) => Promise<void>;
  onTaskComplete: (id: string) => Promise<void>;
  onTaskDelete: (id: string) => Promise<void>;
  onTaskRestore: (id: string) => Promise<void>;
}

type SortOption = 'date' | 'priority' | 'status' | 'alphabetical';
type FilterOption = 'all' | 'active' | 'completed';

export function TaskList({
  listId,
  tasks,
  isLoading,
  onTaskUpdate,
  onTaskComplete,
  onTaskDelete,
  onTaskRestore,
}: TaskListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Drag-drop support
  const {
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragLeave,
  } = useDragDrop(tasks, {
    onReorder: (reorderedTasks) => {
      announceToScreenReader('Tasks reordered');
    },
  });

  const filteredAndSorted = useMemo(() => {
    let filtered = tasks.filter((task) => {
      switch (filterBy) {
        case 'active':
          return task.completedAt === null;
        case 'completed':
          return task.completedAt !== null;
        default:
          return true;
      }
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const priorityOrder: Record<string, number> = {
            critical: 0,
            urgent: 1,
            high: 2,
            medium: 3,
            low: 4,
          };
          const aPriority = priorityOrder[a.priority] ?? 5;
          const bPriority = priorityOrder[b.priority] ?? 5;
          return aPriority - bPriority;
        }
        case 'status':
          return (a.completedAt === null ? 0 : 1) - (b.completedAt === null ? 0 : 1);
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [tasks, sortBy, filterBy]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completedAt !== null).length;
    const active = total - completed;
    return { total, completed, active };
  }, [tasks]);

  const handleTaskClick = useCallback(
    (taskId: string) => {
      setEditingId(editingId === taskId ? null : taskId);
    },
    [editingId]
  );

  if (isLoading) {
    return (
      <section className="p-8 text-center" aria-busy="true" aria-live="polite">
        <p className="text-gray-500">Loading tasks...</p>
      </section>
    );
  }

  const regionId = useRef(createId('tasklist-region')).current;

  return (
    <section id={regionId} className="space-y-6" aria-label="Tasks">
      {/* Statistics Bar */}
      <article className="bg-gray-50 rounded-lg p-4 border border-gray-200" aria-label="Task statistics">
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-6">
            <div aria-label={`Total tasks: ${stats.total}`}>
              <span className="font-medium text-gray-900">{stats.total}</span>
              <span className="text-gray-600 ml-1">Total</span>
            </div>
            <div aria-label={`Completed tasks: ${stats.completed}`}>
              <span className="font-medium text-green-600">{stats.completed}</span>
              <span className="text-gray-600 ml-1">Completed</span>
            </div>
            <div aria-label={`Active tasks: ${stats.active}`}>
              <span className="font-medium text-blue-600">{stats.active}</span>
              <span className="text-gray-600 ml-1">Active</span>
            </div>
          </div>
          {stats.total > 0 && (
            <div className="flex items-center gap-2">
              <div 
                className="w-24 bg-gray-200 rounded-full h-2" 
                role="progressbar" 
                aria-valuenow={Math.round((stats.completed / stats.total) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Task completion progress"
              >
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="text-gray-600">
                {Math.round((stats.completed / stats.total) * 100)}%
              </span>
            </div>
          )}
        </div>
      </article>

      {/* Filter and Sort Controls */}
      <fieldset className="bg-white rounded-lg p-4 border border-gray-200">
        <legend className="sr-only">Filter and sort options</legend>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2" role="group" aria-label="Filter tasks">
            {(['all', 'active', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setFilterBy(filter);
                  announceToScreenReader(`Showing ${filter} tasks`);
                }}
                aria-pressed={filterBy === filter}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  filterBy === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label htmlFor="sort-select" className="sr-only">Sort by</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                announceToScreenReader(`Sorted by ${e.target.value}`);
              }}
              className="px-3 py-1 rounded text-sm border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="status">Sort by Status</option>
            <option value="alphabetical">Sort A-Z</option>
          </select>
          </div>
        </div>
      </fieldset>

      {/* Task List */}
      {filteredAndSorted.length > 0 ? (
        <div className="space-y-2" role="list" aria-label={`${filteredAndSorted.length} ${filterBy} tasks`}>
          {filteredAndSorted.map((task, index) => (
            <DraggableItem
              key={task.id}
              index={index}
              isDragging={draggedIndex === index}
              isDragOver={dragOverIndex === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragLeave={handleDragLeave}
              className="move-handle"
            >
              <div role="listitem">
                <TaskItem
                  task={task}
                  isEditing={editingId === task.id}
                  onSelect={() => handleTaskClick(task.id)}
                  onComplete={() => onTaskComplete(task.id)}
                  onUpdate={(data: Partial<TodoItem>) => onTaskUpdate(task.id, data)}
                  onDelete={() => onTaskDelete(task.id)}
                  onRestore={() => onTaskRestore(task.id)}
                />
              </div>
            </DraggableItem>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300" role="status" aria-live="polite">
          <div className="text-4xl mb-4" aria-hidden="true">✨</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {filterBy === 'all' ? 'No tasks yet' : `No ${filterBy} tasks`}
          </h3>
          <p className="text-gray-600 text-sm">
            {filterBy === 'all'
              ? 'Create a task to get started'
              : `Try changing your filter to see more tasks`}
          </p>
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      <footer className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
        <p>💡 Tip: Use keyboard shortcuts - <kbd className="bg-gray-100 px-2 py-1 rounded">Space</kbd> to toggle, <kbd className="bg-gray-100 px-2 py-1 rounded">Delete</kbd> to remove</p>
      </footer>
    </section>
  );
}
