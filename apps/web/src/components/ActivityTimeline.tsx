import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../core/contracts/queryKeys';
import { DEFAULT_PAGE_SIZE } from '../core/domain/cursorPage';
import type { ActivityEvent } from '../core/contracts/domain';
import type { TodoRepository } from '../core/contracts/repository';

export interface ActivityTimelineProps {
  repository: TodoRepository;
  maxItems?: number;
}

const ACTION_ICONS: Record<string, string> = {
  created: '✨',
  updated: '✏️',
  completed: '✅',
  uncompleted: '↩️',
  deleted: '🗑️',
  restored: '♻️',
  archived: '📦',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  completed: 'Completed',
  uncompleted: 'Uncompleted',
  deleted: 'Deleted',
  restored: 'Restored',
  archived: 'Archived',
};

export function ActivityTimeline({ repository, maxItems = DEFAULT_PAGE_SIZE }: ActivityTimelineProps) {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const { data: page, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.activityPage(cursor, maxItems),
    queryFn: () => repository.listActivityPage({ cursor, limit: maxItems }),
    staleTime: 10000,
  });
  const activity = page?.items ?? [];

  const displayedActivity = activity;

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ActivityEvent[]> = {};

    displayedActivity.forEach((event) => {
      const date = new Date(event.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return groups;
  }, [displayedActivity]);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Loading activity...</p>
      </div>
    );
  }

  if (displayedActivity.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-4xl mb-2">📭</p>
        <p className="text-gray-500">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{page?.total ?? 0} events · newest first</p>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-700">Clear all activity?</span>
            <button type="button" className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white" onClick={async () => {
              await repository.clearActivity();
              setConfirmClear(false);
              setCursor(null);
              setCursorHistory([]);
              await queryClient.invalidateQueries({ queryKey: queryKeys.activity });
            }}>Clear history</button>
            <button type="button" className="rounded bg-gray-200 px-3 py-1 text-xs" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="text-sm text-red-700 underline" onClick={() => setConfirmClear(true)}>Clear history</button>
        )}
      </div>
      {Object.entries(groupedByDate).map(([dateKey, events]) => (
        <div key={dateKey}>
          {/* Date Header */}
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{dateKey}</h3>

          {/* Timeline Events */}
          <div className="space-y-4 relative">
            {/* Vertical Line */}
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 to-transparent" />

            {/* Events */}
            {events.map((event, index) => {
              const icon = ACTION_ICONS[event.action] || '📌';
              const label = ACTION_LABELS[event.action] || event.action;
              const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={`${event.id}-${index}`} className="flex gap-3 pl-8 relative">
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-1 w-5 h-5 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center text-xs">
                    <span className="text-blue-500">{icon}</span>
                  </div>

                  {/* Event Card */}
                  <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{label}</span>
                          <span className="text-xs text-gray-500">{time}</span>
                        </div>

                        {/* Event Description */}
                        <p className="text-sm text-gray-700">
                          {event.entityType === 'list' ? '📋' : '✓'} {event.action} {event.entityType}
                        </p>

                        {/* Event Metadata */}
                        {event.metadata && (
                          <div className="mt-2 text-xs text-gray-600">
                            {event.metadata.previousValue && (
                              <p>
                                Changed from:{' '}
                                <span className="font-mono bg-gray-100 px-1 rounded">
                                  {typeof event.metadata.previousValue === 'string'
                                    ? event.metadata.previousValue
                                    : JSON.stringify(event.metadata.previousValue).slice(0, 50)}
                                </span>
                              </p>
                            )}
                            {event.metadata.newValue && (
                              <p>
                                Changed to:{' '}
                                <span className="font-mono bg-gray-100 px-1 rounded">
                                  {typeof event.metadata.newValue === 'string'
                                    ? event.metadata.newValue
                                    : JSON.stringify(event.metadata.newValue).slice(0, 50)}
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Entity Type Badge */}
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded whitespace-nowrap">
                        {event.entityType === 'list' ? 'List' : 'Task'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <nav className="flex items-center justify-between border-t border-gray-200 pt-4" aria-label="Activity pages">
        <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={cursorHistory.length === 0 || isFetching} onClick={() => {
          const previous = cursorHistory.at(-1) ?? null;
          setCursorHistory((history) => history.slice(0, -1));
          setCursor(previous);
        }}>Previous</button>
        <span className="text-sm text-gray-600">Showing {displayedActivity.length} of {page?.total ?? 0}</span>
        <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={!page?.nextCursor || isFetching} onClick={() => {
          setCursorHistory((history) => [...history, cursor]);
          setCursor(page!.nextCursor);
        }}>Next</button>
      </nav>
    </div>
  );
}
