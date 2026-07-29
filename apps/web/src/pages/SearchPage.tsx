import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { SearchBar } from '../components/SearchBar';
import { PageContainer, EmptyState } from '../components/layouts';
import { usePageNav } from '../hooks/usePageNav';
import { queryKeys } from '../core/contracts/queryKeys';
import type { SearchResult } from '../core/contracts/domain';
import { appServices } from '../app/runtime/appServices';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

export function SearchPage() {
  usePageSEO(PAGE_SEO.search);
  const navigate = useNavigate();
  const repository = appServices.repository;
  const [searchQuery, setSearchQuery] = useState('');

  // Generic page navigation (handles Escape to go back)
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });

  const { data: results = [] } = useQuery<SearchResult[]>({
    queryKey: queryKeys.search(searchQuery),
    queryFn: async () =>
      searchQuery ? (await repository.search({ query: searchQuery })).results : [],
    enabled: !!searchQuery,
    staleTime: 10000,
  });

  return (
    <PageContainer
      title="Search"
      subtitle="Find lists and tasks across all collections"
      backButton={{ label: 'Back', to: '/' }}
      ariaLabel="Search results"
      spacing="normal"
    >
      {/* Search Bar */}
      <div className="mb-8">
        <SearchBar repository={repository} />
      </div>

      {/* Results */}
      {searchQuery && results.length > 0 && (
        <section className="bg-[var(--color-bg-secondary)] rounded-lg shadow-md p-6" aria-label="Search results">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
            {results.length} Result{results.length !== 1 ? 's' : ''} for "{searchQuery}"
          </h2>

          <div className="space-y-4">
            {results.map((result, index) => (
              <button
                key={`${result.kind}-${result.id}-${index}`}
                onClick={() => {
                  if (result.kind === 'list') {
                    navigate({ to: `/lists/${result.id}` });
                  } else {
                    // Navigate to the list containing the task with task ID in query param
                    navigate({ to: `/lists/${result.scope}`, search: { task: result.id } });
                  }
                }}
                className="w-full text-left p-4 border border-[var(--color-border-default)] rounded-lg hover:shadow-md transition-shadow bg-[var(--color-bg-primary)]"
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">
                    {result.kind === 'list' ? '📋' : '✓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                      {result.title}
                    </h3>
                    {result.description && (
                      <p className="text-[var(--color-text-secondary)] mb-2 line-clamp-2">{result.description}</p>
                    )}
                    <div className="flex gap-2 items-center text-sm text-[var(--color-text-tertiary)]">
                      <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded">
                        {result.kind === 'list' ? 'List' : 'Task'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* No Search */}
      {!searchQuery && (
        <EmptyState
          icon="🔍"
          title="Start searching"
          description="Type in the search bar to find lists and tasks"
        />
      )}

      {/* Empty Results */}
      {searchQuery && results.length === 0 && (
        <EmptyState
          icon="📭"
          title="No results found"
          description="Try a different search term"
        />
      )}

      {/* Footer with help */}
      {searchQuery && (
        <footer className="text-center mt-8 text-sm text-[var(--color-text-secondary)]">
          <p>
            💡 Tip: Press <kbd className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">Esc</kbd> to return to dashboard
          </p>
        </footer>
      )}
    </PageContainer>
  );
}

