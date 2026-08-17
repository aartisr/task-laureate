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
  const { data: results = [], isFetching } = useQuery<SearchResult[]>({ queryKey: queryKeys.search(deferredQuery), queryFn: async () => deferredQuery ? (await appServices.repository.search({ query: deferredQuery })).results : [], enabled: Boolean(deferredQuery), staleTime: 10_000 });
  const open = (result: SearchResult) => { if (result.kind === 'list') navigate({ to: `/lists/${result.id}` }); else navigate({ to: `/lists/${result.scope}`, search: { task: result.id } }); };
  return <PageContainer title="Search" subtitle="Find the right task or list without retracing your steps." backButton={{ label: 'Back', to: '/' }} ariaLabel="Search" spacing="normal">
    <div className="search-page"><SearchBar repository={appServices.repository} value={query} onChange={setQuery} showResults={false} autoFocus />
      {deferredQuery ? <section className="search-page__results" aria-live="polite" aria-busy={isFetching}><div className="search-page__results-heading"><div><p className="eyebrow">Results</p><h2>{isFetching ? 'Searching…' : `${results.length} match${results.length === 1 ? '' : 'es'} for “${deferredQuery}”`}</h2></div></div>{results.length ? <div className="search-page__result-list">{results.map((result) => <button key={`${result.kind}-${result.id}`} type="button" onClick={() => open(result)}><span className="search-page__result-icon" aria-hidden="true"><AppIcon name={result.kind === 'list' ? 'list' : 'task'} /></span><span><strong>{result.title}</strong>{result.description ? <small>{result.description}</small> : null}</span><em>{result.kind}</em><b aria-hidden="true"><AppIcon name="arrow-right" /></b></button>)}</div> : !isFetching ? <EmptyState icon={<AppIcon name="search" />} title="Nothing matched" description="Try a shorter phrase, a list name, or a task keyword." /> : null}</section> : <EmptyState icon={<AppIcon name="search" />} title="Search your workspace" description="Start with a task, list, or phrase you remember." />}</div>
  </PageContainer>;
}
