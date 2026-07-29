/**
 * Search Page - Puck Compliant Version
 * 
 * Demonstrates how to make search pages editable while maintaining live filtering
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { appServices } from '../runtime/appServices';
import { searchQueryOptions } from '../../core/contracts/queryKeys';
import type { SearchResult } from '../../core/contracts/domain';
import { usePuckContent } from '../../components/withPuckEditor';
import { PuckPageRenderer } from '../../components/PuckPageRenderer';

export function SearchPagePuckCompliant() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Load Puck content
  const puckContent = usePuckContent('search');

  // Load live search results
  const searchQuery = useQuery(searchQueryOptions(appServices.repository, query));

  const handleSelectResult = (result: SearchResult) => {
    if (result.kind === 'list') {
      navigate({ to: `/lists/${result.id}` });
    } else {
      navigate({ to: `/lists/${result.scope}?task=${result.id}` });
    }
  };

  if (!puckContent) {
    return <div>Loading...</div>;
  }

  return (
    <PuckPageRenderer content={puckContent}>
      {/* Business logic: Search bar and results */}
      <div key="search-results">
        <label className="search-bar">
          <span className="sr-only">Search query</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lists, tasks, tags, notes..."
          />
        </label>

        <div className="card-list">
          {searchQuery.data?.results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result)}
              className="data-card data-card--interactive"
            >
              <div className="data-card__content">
                <strong>{result.title}</strong>
                <p>{result.description}</p>
              </div>
              <div className="data-card__meta">
                <span>{result.kind === 'list' ? '📋 List' : '✓ Task'}</span>
                {result.kind === 'task' && <span>{result.scope}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </PuckPageRenderer>
  );
}
