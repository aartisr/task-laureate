import { useState, useRef, useEffect } from 'react';
import { announceToScreenReader } from '../lib/a11y';
import type { TodoItem } from '../core/contracts/domain';

export interface TaskItemProps {
  task: TodoItem;
  isEditing: boolean;
  onSelect: () => void;
  onComplete: () => Promise<void>;
  onUpdate: (data: Partial<TodoItem>) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: 'text-red-600 bg-red-50', label: '🔴 Critical' },
  urgent: { color: 'text-orange-600 bg-orange-50', label: '🟠 Urgent' },
  high: { color: 'text-yellow-600 bg-yellow-50', label: '🟡 High' },
  medium: { color: 'text-blue-600 bg-blue-50', label: '🔵 Medium' },
  low: { color: 'text-green-600 bg-green-50', label: '🟢 Low' },
};

export function TaskItem({
  task,
  isEditing,
  onSelect,
  onComplete,
  onUpdate,
  onDelete,
  onRestore,
}: TaskItemProps) {
  // Calculate derived values first
  const isCompleted = task.completedAt !== null;
  const isDeleted = task.deletedAt !== null;

  const [editTitle, setEditTitle] = useState(task.title);
  const [editCompleted, setEditCompleted] = useState(isCompleted);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editNotes, setEditNotes] = useState(task.notes || '');
  const [editTags, setEditTags] = useState(task.tags);
  const [editDueDate, setEditDueDate] = useState(task.dueDate || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  // Update editCompleted when task changes
  useEffect(() => {
    setEditCompleted(isCompleted);
  }, [isCompleted]);

  const handleCompleteToggle = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setEditTitle(task.title);
      return;
    }

    const titleChanged = editTitle !== task.title;
    const completionChanged = editCompleted !== isCompleted;
    const priorityChanged = editPriority !== task.priority;
    const notesChanged = editNotes !== (task.notes || '');
    const tagsChanged = JSON.stringify(editTags) !== JSON.stringify(task.tags);
    const dueDateChanged = editDueDate !== (task.dueDate || '');

    if (!titleChanged && !completionChanged && !priorityChanged && !notesChanged && !tagsChanged && !dueDateChanged) {
      onSelect(); // Close edit mode if nothing changed
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Handle completion status change
      if (completionChanged) {
        await onComplete();
      }
      
      // Handle other changes
      const updateData: Partial<TodoItem> = {};
      if (titleChanged) updateData.title = editTitle.trim();
      if (priorityChanged) updateData.priority = editPriority;
      if (notesChanged) updateData.notes = editNotes.trim() || undefined;
      if (tagsChanged) updateData.tags = editTags;
      if (dueDateChanged) updateData.dueDate = editDueDate || undefined;
      
      if (Object.keys(updateData).length > 0) {
        await onUpdate(updateData);
      }
      
      onSelect(); // Close edit mode
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      setEditTitle(task.title); // Revert on error
      setEditCompleted(isCompleted);
      setEditPriority(task.priority);
      setEditNotes(task.notes || '');
      setEditTags(task.tags);
      setEditDueDate(task.dueDate || '');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onDelete();
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setIsLoading(false);
    }
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  if (isDeleted) {
    return (
      <article className="bg-gray-50 rounded-lg p-4 border border-gray-200 opacity-60" aria-label={`Deleted task: ${task.title}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-gray-600 line-through">{task.title}</p>
            <p className="text-xs text-gray-400 mt-1">Deleted</p>
          </div>
          <button
            onClick={() => onRestore()}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Restore task: ${task.title}`}
          >
            Restore
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`rounded-lg border transition-all ${
        isEditing
          ? 'border-blue-400 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:shadow-md'
      } ${isCompleted ? 'opacity-75' : ''}`}
      aria-label={`Task: ${task.title}${isCompleted ? ', completed' : ''}`}
    >
      <div className="p-4">
        {/* Main Task Row */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={handleCompleteToggle}
            disabled={isLoading}
            aria-checked={isCompleted}
            aria-label={`Mark task ${isCompleted ? 'incomplete' : 'complete'}: ${task.title}`}
            role="checkbox"
            className={`flex-shrink-0 w-6 h-6 rounded border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isCompleted
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 hover:border-green-500'
            }`}
          >
            {isCompleted && <span className="text-white text-sm flex items-center justify-center h-full" aria-hidden="true">✓</span>}
          </button>

          {/* Title and Priority */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-4 bg-white rounded-xl border-2 border-blue-500 p-5 shadow-lg animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Edit Task</h3>
                  <button
                    onClick={() => onSelect()}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Title Field - Premium Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    Task Title
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                      if (e.key === 'Escape') onSelect();
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all text-base font-medium"
                    placeholder="What needs to be done?"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    {editTitle.length} characters • Press Cmd+Enter to save
                  </p>
                </div>

                {/* Completion Status */}
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-green-50 rounded-lg border border-green-100 hover:border-green-200 transition-colors cursor-pointer"
                  onClick={() => !isLoading && setEditCompleted(!editCompleted)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                      e.preventDefault();
                      setEditCompleted(!editCompleted);
                    }
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditCompleted(!editCompleted);
                    }}
                    disabled={isLoading}
                    aria-checked={editCompleted}
                    role="checkbox"
                    className={`flex-shrink-0 w-6 h-6 rounded-md border-2 transition-all focus:outline-none focus:ring-2 focus:ring-green-400 ${
                      editCompleted
                        ? 'bg-green-500 border-green-500'
                        : 'border-green-300 hover:border-green-500 hover:bg-green-50'
                    }`}
                  >
                    {editCompleted && <span className="text-white text-sm flex items-center justify-center h-full">✓</span>}
                  </button>
                  <label className="flex-1 text-sm font-medium text-gray-700 cursor-pointer select-none">
                    {editCompleted ? '✓ Task completed' : 'Mark as complete'}
                  </label>
                </div>

                {/* Priority & Due Date Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Priority Selector */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                    >
                      <option value="low">🟢 Low</option>
                      <option value="medium">🔵 Medium</option>
                      <option value="high">🟡 High</option>
                      <option value="urgent">🟠 Urgent</option>
                    </select>
                  </div>

                  {/* Due Date Picker */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Notes Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">Notes</label>
                  <textarea
                    ref={notesInputRef}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') onSelect();
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all text-sm resize-none"
                    placeholder="Add notes or details about this task..."
                    rows={3}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    {editNotes.length} characters
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '💾 Saving...' : '💾 Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditTitle(task.title);
                      setEditCompleted(isCompleted);
                      setEditPriority(task.priority);
                      setEditNotes(task.notes || '');
                      setEditTags(task.tags);
                      setEditDueDate(task.dueDate || '');
                      onSelect();
                    }}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="flex items-center gap-2 pt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  <span>⌨️ Tip:</span>
                  <span>Cmd+Enter to save</span>
                  <span>•</span>
                  <span>Esc to cancel</span>
                </div>
              </div>
            ) : (
              <div onClick={onSelect} className="cursor-pointer">
                <p
                  className={`font-medium transition-all ${
                    isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}
                >
                  {task.title}
                </p>
                {task.notes && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.notes}</p>
                )}
              </div>
            )}
          </div>

          {/* Priority Badge */}
          <div className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium ${priorityConfig.color}`}>
            {priorityConfig.label}
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Due Date and Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <div>
            {task.dueDate && (
              <span>
                Due: {new Date(task.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            {task.completedAt && (
              <span className="text-green-600 ml-2">
                ✓ Completed {new Date(task.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="flex gap-1">
              <button
                onClick={onSelect}
                title="Edit"
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                ✏️
              </button>
              {showDeleteConfirm ? (
                <>
                  <button
                    onClick={handleDeleteClick}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete"
                  className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
