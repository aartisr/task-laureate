/**
 * Activity Page - Puck Compliant Version
 * 
 * Shows how to make activity/timeline pages editable
 */

import { useQuery } from '@tanstack/react-query';
import { appServices } from '../runtime/appServices';
import { activityQueryOptions } from '../../core/contracts/queryKeys';
import { usePuckContent } from '../../components/withPuckEditor';
import { PuckPageRenderer } from '../../components/PuckPageRenderer';
import { formatDistanceToNow } from '../../core/domain/format';

export function ActivityPagePuckCompliant() {
  // Load Puck content
  const puckContent = usePuckContent('activity');

  // Load live activity data
  const { data: activities } = useQuery(activityQueryOptions(appServices.repository));

  if (!puckContent) {
    return <div>Loading...</div>;
  }

  return (
    <PuckPageRenderer content={puckContent}>
      {/* Business logic: Activity timeline */}
      <div key="activity-timeline" className="activity-timeline">
        {activities?.map((activity) => (
          <article key={activity.id} className="activity-item">
            <time dateTime={activity.timestamp.toISOString()}>
              {formatDistanceToNow(activity.timestamp)}
            </time>
            <div className="activity-content">
              <p>
                <strong>{activity.actor || 'System'}</strong> {activity.action}
              </p>
              <p className="activity-detail">{activity.entityType}</p>
            </div>
            {activity.metadata && (
              <details className="activity-metadata">
                <summary>Details</summary>
                <pre>{JSON.stringify(activity.metadata, null, 2)}</pre>
              </details>
            )}
          </article>
        ))}
      </div>
    </PuckPageRenderer>
  );
}
