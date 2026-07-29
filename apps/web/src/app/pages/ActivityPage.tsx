import { useQuery } from '@tanstack/react-query';
import { appServices } from '../runtime/appServices';
import { activityQueryOptions } from '../../core/contracts/queryKeys';

export function ActivityPage() {
  const { data } = useQuery(activityQueryOptions(appServices.repository));

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>Every important change, in sequence.</h1>
          <p className="lede">A small but reliable foundation for audit trails and future collaboration.</p>
        </div>
      </header>

      <section className="panel">
        <div className="card-list">
          {data?.map((event) => (
            <article key={event.id} className="data-card">
              <div className="data-card__content">
                <strong>{event.action}</strong>
                <p>
                  {event.entityType} {event.entityId}
                </p>
              </div>
              <div className="data-card__meta">
                <span>{event.actor}</span>
                <span>{new Date(event.timestamp).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
