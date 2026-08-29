import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { SearchBar } from '../components/SearchBar';
import { PageContainer, EmptyState } from '../components/layouts';
import { usePageNav } from '../hooks/usePageNav';
import { queryKeys } from '../core/contracts/queryKeys';
import type { SearchResult } from '../core/contracts/domain';
import { appServices } from '../app/runtime/appServices';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { AppIcon } from '../components/AppIcon';

export function SearchPage() {
  usePageSEO(PAGE_SEO.search);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });

  const { data: results = [], isFetching } = useQuery<SearchResult[]>({
    queryKey: queryKeys.search(deferredQuery),
    queryFn: async () => deferredQuery ? (await appServices.repository.search({ query: deferredQuery })).results : [],
    enabled: Boolean(deferredQuery),
    staleTime: 10_000,
  });

  const open = (result: SearchResult) => {
    if (result.kind === 'list') navigate({ to: `/lists/${result.id}` });
    else navigate({ to: `/lists/${result.scope}`, search: { task: result.id } });
  };

  const suggestions = [
    { label: 'Overdue', query: 'overdue', icon: 'warning', color: 'var(--color-status-error)', bg: 'color-mix(in srgb, var(--color-status-error) 12%, transparent)' },
    { label: 'Blocked', query: 'blocked', icon: 'block', color: 'var(--color-status-warning)', bg: 'color-mix(in srgb, var(--color-status-warning) 12%, transparent)' },
    { label: 'Completed', query: 'completed', icon: 'check', color: 'var(--color-status-success)', bg: 'color-mix(in srgb, var(--color-status-success) 12%, transparent)' },
    { label: 'Important', query: 'important', icon: 'star', color: 'var(--color-action-primary)', bg: 'color-mix(in srgb, var(--color-action-primary) 12%, transparent)' },
  ];

  return (
    <PageContainer
      title="Search"
      subtitle="Find the right task or list without retracing your steps."
      backButton={{ label: 'Back', to: '/' }}
      ariaLabel="Search"
      spacing="normal"
    >
      <div className="search-page">
        <SearchBar repository={appServices.repository} value={query} onChange={setQuery} showResults={false} autoFocus />

        {deferredQuery ? (
          <section className="search-page__results" aria-live="polite" aria-busy={isFetching}>
            <div className="search-page__results-heading">
              <div>
                <p className="eyebrow">Results</p>
                <h2>{isFetching ? 'Searching…' : `${results.length} match${results.length === 1 ? '' : 'es'} for “${deferredQuery}”`}</h2>
              </div>
            </div>
            {results.length ? (
              <div className="search-page__result-list">
                {results.map((result) => (
                  <button key={`${result.kind}-${result.id}`} type="button" onClick={() => open(result)}>
                    <span className="search-page__result-icon" aria-hidden="true">
                      <AppIcon name={result.kind === 'list' ? 'list' : 'task'} />
                    </span>
                    <span>
                      <strong>{result.title}</strong>
                      {result.description ? <small>{result.description}</small> : null}
                    </span>
                    <em>{result.kind}</em>
                    <b aria-hidden="true"><AppIcon name="arrow-right" /></b>
                  </button>
                ))}
              </div>
            ) : !isFetching ? (
              <EmptyState
                icon={<AppIcon name="search" />}
                title="Nothing matched"
                description="Try a shorter phrase, a list name, or a task keyword."
                action={{ label: 'Clear search', onClick: () => setQuery('') }}
              />
            ) : null}
          </section>
        ) : (
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem', opacity: 0.6 }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--color-border-default)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
                Quick Filters
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--color-border-default)' }} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              width: '100%'
            }}>
              {suggestions.map((s) => (
                <button
                  key={s.query}
                  type="button"
                  onClick={() => setQuery(s.query)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    padding: '1.25rem 1rem',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--color-bg-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = s.color;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 10px 20px -5px ${s.bg}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-default)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(1px)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '1rem',
                    background: s.bg,
                    color: s.color,
                    transition: 'transform 0.2s ease',
                  }}>
                    <AppIcon name={s.icon as any} size={22} />
                  </div>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)'
                  }}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
