import { Link } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appServices } from '../runtime/appServices';
import { listQueryOptions, listTasksQueryOptions } from '../../core/contracts/queryKeys';
import { StatusPill } from '../../components/StatusPill';
import { useTodoMutations } from '../../core/mutations/useTodoMutations';
import type { Priority, TodoItem } from '../../core/contracts/domain';

interface ListDetailPageProps {
  listId: string;
}

export function ListDetailPage({ listId }: ListDetailPageProps) {
  const listQuery = useQuery(listQueryOptions(appServices.repository, listId));
  const tasksQuery = useQuery(listTasksQueryOptions(appServices.repository, listId));
  const { createTask, updateTask, completeTask, deleteTask } = useTodoMutations();
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editStatus, setEditStatus] = useState<'todo' | 'doing' | 'done' | 'blocked' | 'deleted'>('todo');

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskTitle.trim()) {
      return;
    }

    createTask.mutate(
      {
        listId,
        title: taskTitle,
        notes: taskNotes,
        priority: taskPriority,
      },
      {
        onSuccess: () => {
          setTaskTitle('');
          setTaskNotes('');
          setTaskPriority('medium');
        },
      },
    );
  };

  const startEditing = (task: TodoItem) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes);
    setEditPriority(task.priority);
    setEditStatus(task.status);
  };

  const handleSaveTask = (taskId: string) => {
    updateTask.mutate(
      {
        taskId,
        input: {
          title: editTitle,
          notes: editNotes,
          priority: editPriority,
          status: editStatus,
        },
      },
      {
        onSuccess: () => {
          setEditingTaskId(null);
        },
      },
    );
  };

  if (listQuery.isLoading || tasksQuery.isLoading) {
    return <div className="page-surface">Loading list...</div>;
  }

  if (!listQuery.data) {
    return (
      <section className="page-surface">
        <h1>List not found</h1>
        <Link to="/">Return to dashboard</Link>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">List detail</p>
          <h1>{listQuery.data.title}</h1>
          <p className="lede">{listQuery.data.description || 'This list has no description.'}</p>
        </div>
        <StatusPill value={`${listQuery.data.completionPercent}% complete`} />
      </header>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Tasks</p>
            <h2>Work items</h2>
          </div>
          <Link className="secondary-button" to="/search">
            Search tasks
          </Link>
        </div>
        <form className="stack-form" onSubmit={handleCreateTask}>
          <div className="field-grid">
            <label className="field">
              <span>Task title</span>
              <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Define next milestone" />
            </label>
            <label className="field">
              <span>Priority</span>
              <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <input value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} placeholder="Optional details" />
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? 'Adding...' : 'Add task'}
            </button>
          </div>
        </form>
        <div className="card-list">
          {tasksQuery.data?.map((task) => (
            <article key={task.id} className="data-card">
              <div className="data-card__content">
                {editingTaskId === task.id ? (
                  <div className="stack-form">
                    <label className="field">
                      <span>Title</span>
                      <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Notes</span>
                      <input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                    </label>
                    <div className="field-grid">
                      <label className="field">
                        <span>Priority</span>
                        <select value={editPriority} onChange={(event) => setEditPriority(event.target.value as Priority)}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <select
                          value={editStatus}
                          onChange={(event) =>
                            setEditStatus(event.target.value as 'todo' | 'doing' | 'done' | 'blocked' | 'deleted')
                          }
                        >
                          <option value="todo">Todo</option>
                          <option value="doing">Doing</option>
                          <option value="done">Done</option>
                          <option value="blocked">Blocked</option>
                          <option value="deleted">Deleted</option>
                        </select>
                      </label>
                    </div>
                    <div className="button-row">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleSaveTask(task.id)}
                        disabled={updateTask.isPending}
                      >
                        {updateTask.isPending ? 'Saving...' : 'Save changes'}
                      </button>
                      <button className="secondary-button" type="button" onClick={() => setEditingTaskId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong>{task.title}</strong>
                    <p>{task.notes || 'No notes provided.'}</p>
                  </>
                )}
              </div>
              <div className="data-card__meta task-actions">
                <span>{task.priority}</span>
                <StatusPill value={task.status} />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => completeTask.mutate({ taskId: task.id, isComplete: task.status !== 'done' })}
                >
                  {task.status === 'done' ? 'Reopen' : 'Complete'}
                </button>
                <button className="secondary-button" type="button" onClick={() => startEditing(task)}>
                  Edit
                </button>
                <button className="secondary-button" type="button" onClick={() => deleteTask.mutate(task.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
