import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { queryKeys } from '../core/contracts/queryKeys';
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

export function ActivityTimeline({ repository, maxItems = 50 }: ActivityTimelineProps) {
  const { data: activity = [], isLoading } = useSuspenseQuery({
    queryKey: queryKeys.activity,
    queryFn: () => repository.listActivity(),
    staleTime: 10000,
  });

  const displayedActivity = useMemo(
    () => activity.slice(0, maxItems),
    [activity, maxItems]
  );

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

      {/* Load More Hint */}
      {activity.length > maxItems && (
        <div className="text-center py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {displayedActivity.length} of {activity.length} events
          </p>
        </div>
      )}
    </div>
  );
}
