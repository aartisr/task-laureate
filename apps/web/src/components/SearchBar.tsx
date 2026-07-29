import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { SearchInput } from '../core/contracts/repository';
import type { SearchResult } from '../core/contracts/domain';
import type { TodoRepository } from '../core/contracts/repository';

export interface SearchBarProps {
  repository: TodoRepository;
}

export function SearchBar({ repository }: SearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const searchInput: SearchInput = {
          query: searchQuery,
        };
        const searchResponse = await repository.search(searchInput);
        setResults(searchResponse.results);
        setIsOpen(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [repository]
  );

  const handleSelectResult = (result: SearchResult) => {
    if (result.kind === 'list') {
      navigate({ to: `/lists/${result.id}` });
    } else {
      // Navigate to the list containing the task with task ID in query param
      navigate({ to: `/lists/${result.scope}`, search: { task: result.id } });
    }
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search lists and tasks... (⌘F)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleClear();
          }}
          className="w-full px-4 py-3 pl-10 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Search Icon */}
        <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}

        {/* Loading Indicator */}
        {isSearching && (
          <span className="absolute right-10 top-3.5 text-gray-400">⟳</span>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
          {results.map((result, index) => (
            <button
              key={`${result.kind}-${result.id}-${index}`}
              onClick={() => handleSelectResult(result)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">
                  {result.kind === 'list' ? '📋' : '✓'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{result.title}</p>
                  {result.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{result.description}</p>
                  )}
                  <div className="flex gap-2 mt-2 text-xs text-gray-500">
                    <span>{result.kind === 'list' ? 'List' : 'Task'}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && query && results.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500 z-50">
          No results found for "{query}"
        </div>
      )}

      {/* Search Tips */}
      {!query && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          💡 Tip: Search across all lists and tasks instantly
        </div>
      )}
    </div>
  );
}
