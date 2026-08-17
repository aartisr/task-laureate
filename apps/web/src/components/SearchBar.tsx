import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { SearchInput, TodoRepository } from '../core/contracts/repository';
import type { SearchResult } from '../core/contracts/domain';
import { AppIcon } from './AppIcon';

export interface SearchBarProps {
  repository: TodoRepository;
  value?: string;
  onChange?: (query: string) => void;
  /** Use false when a page presents results in its own permanent result region. */
  showResults?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({ repository, value, onChange, showResults = true, autoFocus = false }: SearchBarProps) {
  const navigate = useNavigate();
  const [internalQuery, setInternalQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const query = value ?? internalQuery;
  const setQuery = (next: string) => { if (value === undefined) setInternalQuery(next); onChange?.(next); };
  const handleSearch = useCallback(async (next: string) => {
    if (!next.trim()) { setResults([]); return; }
    try { setIsSearching(true); const response = await repository.search({ query: next } satisfies SearchInput); setResults(response.results); setIsOpen(true); }
    catch { setResults([]); }
    finally { setIsSearching(false); }
  }, [repository]);
  useEffect(() => { if (showResults) void handleSearch(query); }, [handleSearch, query, showResults]);
  const select = (result: SearchResult) => { if (result.kind === 'list') navigate({ to: `/lists/${result.id}` }); else navigate({ to: `/lists/${result.scope}`, search: { task: result.id } }); setQuery(''); setIsOpen(false); };
  const clear = () => { setQuery(''); setResults([]); setIsOpen(false); };

  return <div className="search-bar">
    <label className="search-bar__input"><span className="sr-only">Search tasks and lists</span><span aria-hidden="true"><AppIcon name="search" /></span><input autoFocus={autoFocus} type="search" placeholder="Search tasks, lists, and notes…" value={query} onChange={(event) => { const next = event.target.value; setQuery(next); if (showResults) void handleSearch(next); }} onFocus={() => query && setIsOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') clear(); }} />{isSearching ? <i aria-label="Searching" /> : null}{query ? <button type="button" onClick={clear} aria-label="Clear search"><AppIcon name="close" /></button> : null}</label>
    {showResults && isOpen ? <div className="search-bar__results" role="listbox" aria-label="Search results">{results.length ? results.map((result) => <button key={`${result.kind}-${result.id}`} type="button" role="option" onClick={() => select(result)}><span aria-hidden="true"><AppIcon name={result.kind === 'list' ? 'list' : 'task'} /></span><span><strong>{result.title}</strong>{result.description ? <small>{result.description}</small> : null}</span><em>{result.kind}</em></button>) : <p>No results for “{query}”.</p>}</div> : null}
    {!query ? <p className="search-bar__tip">Search across your workspace. Press <kbd>Esc</kbd> to clear.</p> : null}
  </div>;
}
