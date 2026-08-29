import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PageContainer } from '../components/layouts';
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
    { label: 'Overdue', query: 'overdue', icon: 'warning', color: 'text-rose-500', bg: 'bg-rose-500/10 hover:bg-rose-500/20', border: 'border-rose-500/20' },
    { label: 'Blocked', query: 'blocked', icon: 'block', color: 'text-amber-500', bg: 'bg-amber-500/10 hover:bg-amber-500/20', border: 'border-amber-500/20' },
    { label: 'Completed', query: 'completed', icon: 'check', color: 'text-emerald-500', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20', border: 'border-emerald-500/20' },
    { label: 'Important', query: 'important', icon: 'star', color: 'text-indigo-500', bg: 'bg-indigo-500/10 hover:bg-indigo-500/20', border: 'border-indigo-500/20' },
  ];

  return (
    <PageContainer
      title="Search"
      subtitle="Find the right task or list without retracing your steps."
      backButton={{ label: 'Back', to: '/' }}
      ariaLabel="Search"
      spacing="normal"
    >
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 pt-6 pb-24">
        {/* Search Input Area */}
        <div className="relative group z-10">
          <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur-xl group-focus-within:bg-indigo-500/10 transition-colors duration-500" />
          <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] focus-within:border-[var(--color-action-primary)] focus-within:ring-4 focus-within:ring-[var(--color-action-primary)]/10 rounded-2xl shadow-sm transition-all duration-300">
             <div className="flex items-center px-5 h-16 gap-3">
               <span className="text-[var(--color-text-tertiary)] flex-shrink-0 text-xl transition-colors group-focus-within:text-[var(--color-action-primary)]">
                 <AppIcon name="search" />
               </span>
               <input
                 type="search"
                 autoFocus
                 placeholder="Search tasks, lists, and notes…"
                 className="flex-1 bg-transparent border-none text-[var(--color-text-primary)] text-lg placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-0 w-full"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Escape') setQuery('');
                 }}
               />
               {isFetching && (
                 <div className="flex-shrink-0 w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
               )}
               {query && !isFetching && (
                 <button
                   onClick={() => setQuery('')}
                   className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] transition-colors cursor-pointer"
                   aria-label="Clear search"
                 >
                   <AppIcon name="close" />
                 </button>
               )}
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {!deferredQuery ? (
            <div className="flex flex-col items-center justify-center pt-12 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-6 text-[var(--color-text-tertiary)] shadow-inner">
                <AppIcon name="search" size={28} />
              </div>
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2 tracking-tight">
                Search your workspace
              </h2>
              <p className="text-[var(--color-text-secondary)] text-center max-w-md mb-12 leading-relaxed">
                Start typing to find tasks, lists, or notes. Or try one of the smart filters below to quickly jump to important areas.
              </p>

              <div className="w-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-[var(--color-border-default)]"></div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-widest px-2">
                    Quick Filters
                  </h3>
                  <div className="flex-1 h-px bg-[var(--color-border-default)]"></div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {suggestions.map((s) => (
                    <button
                      key={s.query}
                      onClick={() => setQuery(s.query)}
                      className={`flex flex-col items-center text-center p-5 rounded-2xl border bg-transparent hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group ${s.border}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${s.bg} ${s.color}`}>
                         <AppIcon name={s.icon as any} size={24} />
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-[var(--color-border-default)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  {isFetching ? 'Searching...' : `Results for "${deferredQuery}"`}
                </h3>
                {!isFetching && (
                  <span className="text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] px-3 py-1 rounded-full">
                    {results.length} found
                  </span>
                )}
              </div>

              {results.length > 0 ? (
                <div className="flex flex-col gap-3 mt-2">
                  {results.map((result) => (
                    <button
                      key={`${result.kind}-${result.id}`}
                      onClick={() => open(result)}
                      className="group flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-action-primary)] cursor-pointer hover:shadow-lg hover:shadow-[var(--color-action-primary)]/5 transition-all text-left"
                    >
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${result.kind === 'list' ? 'bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500/20' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-action-primary)] group-hover:bg-[var(--color-action-primary)]/10'}`}>
                        <AppIcon name={result.kind === 'list' ? 'list' : 'task'} size={22} />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[var(--color-text-primary)] font-semibold truncate text-base">
                            {result.title}
                          </span>
                          <span className="flex-shrink-0 text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--color-border-default)] text-[var(--color-text-tertiary)]">
                            {result.kind}
                          </span>
                        </div>
                        {result.description && (
                          <span className="text-sm text-[var(--color-text-secondary)] truncate">
                            {result.description}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-action-primary)] group-hover:text-white transition-all opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0">
                        <AppIcon name="arrow-right" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                !isFetching && (
                  <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-6 text-[var(--color-text-tertiary)] rotate-[-10deg] shadow-sm">
                      <AppIcon name="search" size={32} />
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">
                      No matching results
                    </h3>
                    <p className="text-[var(--color-text-secondary)] max-w-sm mb-8 leading-relaxed">
                      We couldn't find anything matching "{deferredQuery}". Try a different keyword, a list name, or check for typos.
                    </p>
                    <button
                      onClick={() => setQuery('')}
                      className="px-6 py-2.5 rounded-xl font-semibold text-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 hover:bg-[var(--color-action-primary)] hover:text-white cursor-pointer transition-all"
                    >
                      Clear search
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
