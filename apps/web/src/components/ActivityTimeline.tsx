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
    return <div className="activity-timeline__state" role="status">Loading activity…</div>;
  }

  if (displayedActivity.length === 0) {
    return <div className="activity-timeline__state"><span aria-hidden="true">◌</span><p>No activity yet. Your meaningful changes will appear here.</p></div>;
  }

  return (
    <div className="activity-timeline">
      <div className="activity-timeline__toolbar">
        <p>{page?.total ?? 0} events · newest first</p>
        {confirmClear ? (
          <div className="activity-timeline__confirm">
            <span>Clear all activity?</span>
            <button type="button" className="activity-timeline__danger" onClick={async () => {
              await repository.clearActivity();
              setConfirmClear(false);
              setCursor(null);
              setCursorHistory([]);
              await queryClient.invalidateQueries({ queryKey: queryKeys.activity });
            }}>Clear history</button>
            <button type="button" className="secondary-button" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="activity-timeline__clear" onClick={() => setConfirmClear(true)}>Clear history</button>
        )}
      </div>
      {Object.entries(groupedByDate).map(([dateKey, events]) => (
        <div key={dateKey}>
          {/* Date Header */}
          <h3 className="activity-timeline__date">{dateKey}</h3>

          {/* Timeline Events */}
          <div className="activity-timeline__events">
            {/* Vertical Line */}
            <div className="activity-timeline__line" />

            {/* Events */}
            {events.map((event, index) => {
              const icon = ACTION_ICONS[event.action] || '📌';
              const label = ACTION_LABELS[event.action] || event.action;
              const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={`${event.id}-${index}`} className="activity-timeline__event">
                  {/* Timeline Dot */}
                  <div className="activity-timeline__dot">
                    <span>{icon}</span>
                  </div>

                  {/* Event Card */}
                  <div className="activity-timeline__card">
                    <div className="activity-timeline__card-row">
                      <div>
                        <div className="activity-timeline__event-meta">
                          <span>{label}</span>
                          <span>{time}</span>
                        </div>

                        {/* Event Description */}
                        <p>
                          {event.entityType === 'list' ? '📋' : '✓'} {event.action} {event.entityType}
                        </p>

                        {/* Event Metadata */}
                        {event.metadata && (
                          <div className="activity-timeline__changes">
                            {event.metadata.previousValue && (
                              <p>
                                Changed from:{' '}
                                <span>
                                  {typeof event.metadata.previousValue === 'string'
                                    ? event.metadata.previousValue
                                    : JSON.stringify(event.metadata.previousValue).slice(0, 50)}
                                </span>
                              </p>
                            )}
                            {event.metadata.newValue && (
                              <p>
                                Changed to:{' '}
                                <span>
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
                      <span className="activity-timeline__type">
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

      <nav className="activity-timeline__pagination" aria-label="Activity pages">
        <button type="button" className="secondary-button" disabled={cursorHistory.length === 0 || isFetching} onClick={() => {
          const previous = cursorHistory.at(-1) ?? null;
          setCursorHistory((history) => history.slice(0, -1));
          setCursor(previous);
        }}>Previous</button>
        <span>Showing {displayedActivity.length} of {page?.total ?? 0}</span>
        <button type="button" className="secondary-button" disabled={!page?.nextCursor || isFetching} onClick={() => {
          setCursorHistory((history) => [...history, cursor]);
          setCursor(page!.nextCursor);
        }}>Next</button>
      </nav>
    </div>
  );
}
