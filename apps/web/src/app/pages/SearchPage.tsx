import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { appServices } from '../runtime/appServices';
import { searchQueryOptions } from '../../core/contracts/queryKeys';
import type { SearchResult } from '../../core/contracts/domain';

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const searchQuery = useQuery(searchQueryOptions(appServices.repository, query));

  const handleSelectResult = (result: SearchResult) => {
    if (result.kind === 'list') {
      navigate({ to: `/lists/${result.id}` });
    } else {
      navigate({ to: `/lists/${result.scope}?task=${result.id}` });
    }
  };

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find any list or task.</h1>
          <p className="lede">Search is URL-friendly, cache-aware, and ready for filters.</p>
        </div>
      </header>

      <section className="panel">
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
      </section>
    </section>
  );
}
