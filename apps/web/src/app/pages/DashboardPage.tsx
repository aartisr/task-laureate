import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { appServices } from '../runtime/appServices';
import { dashboardQueryOptions } from '../../core/contracts/queryKeys';
import { StatCard } from '../../components/StatCard';
import { formatCount } from '../../core/domain/format';
import { useTodoMutations } from '../../core/mutations/useTodoMutations';

export function DashboardPage() {
  const { data } = useQuery(dashboardQueryOptions(appServices.repository));
  const { createList } = useTodoMutations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    createList.mutate(
      { title, description },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
        },
      },
    );
  };

  if (!data) {
    return <div className="page-surface">Loading dashboard...</div>;
  }

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Calm, fast task orchestration.</h1>
          <p className="lede">
            Task-Laureate is structured to stay generic at the core and modular at the edges.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" to="/search">
            Search everything
          </Link>
          <Link className="secondary-button" to="/activity">
            Review activity
          </Link>
        </div>
      </header>

      <section className="stat-grid" aria-label="Workspace summary">
        <StatCard label="Lists" value={formatCount(data.summary.listCount)} />
        <StatCard label="Tasks" value={formatCount(data.summary.taskCount)} />
        <StatCard label="Completed" value={formatCount(data.summary.completedCount)} />
        <StatCard label="Active" value={formatCount(data.summary.activeCount)} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lists</p>
            <h2>Current work</h2>
          </div>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>List title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Launch planning" />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional context for this list"
              />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={createList.isPending}>
              {createList.isPending ? 'Creating...' : 'Create list'}
            </button>
          </div>
        </form>
        <div className="card-list">
          {data.lists.map((list) => (
            <Link key={list.id} to="/lists/$listId" params={{ listId: list.id }} className="data-card">
              <div className="data-card__content">
                <strong>{list.title}</strong>
                <p>{list.description || 'No description yet.'}</p>
              </div>
              <div className="data-card__meta">
                <span>{list.completionPercent}% complete</span>
                <span>{list.taskCount} tasks</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
