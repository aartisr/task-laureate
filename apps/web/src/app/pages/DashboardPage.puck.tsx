/**
 * Dashboard Page - Puck Compliant Version
 * 
 * This page demonstrates how to use Puck content while maintaining dynamic data
 * The layout and text can be edited in Puck, while query data is injected at render time
 */

import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { appServices } from '../runtime/appServices';
import { dashboardQueryOptions } from '../../core/contracts/queryKeys';
import { StatCard } from '../../components/StatCard';
import { formatCount } from '../../core/domain/format';
import { useTodoMutations } from '../../core/mutations/useTodoMutations';
import { usePuckContent } from '../../components/withPuckEditor';
import { PuckPageRenderer } from '../../components/PuckPageRenderer';

export function DashboardPagePuckCompliant() {
  // Load Puck content structure
  const puckContent = usePuckContent('dashboard');

  // Load live data from repository
  const { data: queryData } = useQuery(dashboardQueryOptions(appServices.repository));
  const { createList } = useTodoMutations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;

    createList.mutate(
      { title, description },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
        },
      }
    );
  };

  if (!puckContent) {
    return <div className="page-surface">Loading...</div>;
  }

  // Transform live data for injection into Puck blocks
  const dynamicData = {
    'stats-1': {
      cards: [
        { label: 'Lists', value: formatCount(queryData?.summary.listCount || 0), icon: '📋' },
        { label: 'Tasks', value: formatCount(queryData?.summary.taskCount || 0), icon: '✓' },
        { label: 'Completed', value: formatCount(queryData?.summary.completedCount || 0), icon: '🎉' },
        { label: 'Active', value: formatCount(queryData?.summary.activeCount || 0), icon: '📈' },
      ],
    },
  };

  return (
    <PuckPageRenderer content={puckContent} dynamicData={dynamicData}>
      {/* Business logic components still render as before */}
      <div key="form-and-lists">
        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>List title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Launch planning"
              />
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
          {queryData?.lists.map((list) => (
            <Link key={list.id} to="/lists/$listId" params={{ listId: list.id }} className="data-card">
              <div className="data-card__content">
                <strong>{list.title}</strong>
                <p>{list.description || 'No description yet.'}</p>
              </div>
              <div className="data-card__meta">
                <span>{list.completionPercent}% complete</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PuckPageRenderer>
  );
}

/**
 * Original implementation still available for reference
 * This pattern shows how Puck compliance doesn't break existing code
 */
export { DashboardPage } from './DashboardPage';
