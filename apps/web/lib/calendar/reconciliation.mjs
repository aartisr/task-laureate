/**
 * Provider-neutral reconciliation decisions. Adapters turn their native event
 * into this small shape; no provider transport or credential ever enters here.
 */
export function durationMinutes(start, end) {
  const milliseconds = Date.parse(end) - Date.parse(start);
  const minutes = milliseconds / 60_000;
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 1440 ? minutes : null;
}

/** A full Google event update must explicitly un-cancel a previously deleted block. */
export function googleTaskEventPayload({ eventId, taskId, connectionId, title, listTitle, startsAt, durationMinutes: minutes }) {
  const start = new Date(startsAt).toISOString();
  return {
    id: eventId,
    status: 'confirmed',
    summary: title,
    description: `Scheduled from Task-Laureate\n\nList: ${listTitle || 'Task-Laureate'}`,
    start: { dateTime: start },
    end: { dateTime: new Date(Date.parse(start) + minutes * 60_000).toISOString() },
    extendedProperties: { private: { taskLaureateTaskId: taskId, taskLaureateConnectionId: connectionId, schedulingMode: 'two-way' } },
  };
}

/** Google uses 404 and 410 for an event that is already unavailable to us. */
export function isMissingGoogleEventStatus(status) {
  return status === 404 || status === 410;
}

export function ownedEventChange(event, block, connectionId) {
  if (!event || !block || event.id !== block.external_event_id) return null;
  const properties = event.extendedProperties?.private;
  // A known event id is not sufficient: a user may have deleted and recreated
  // an event with the same id in a mocked or provider-migrated environment.
  if (event.status !== 'cancelled' && (
    properties?.taskLaureateTaskId !== block.task_id ||
    properties?.taskLaureateConnectionId !== connectionId
  )) return null;
  const revision = typeof event.etag === 'string' ? event.etag : typeof event.updated === 'string' ? event.updated : null;
  if (!revision) return null;
  if (event.status === 'cancelled') return { deleted: true, revision, updatedAt: validInstant(event.updated), startsAt: null, durationMinutes: null, eventUrl: null };
  const startsAt = event.start?.dateTime;
  const endsAt = event.end?.dateTime;
  if (typeof startsAt !== 'string' || typeof endsAt !== 'string' || !validInstant(startsAt) || !validInstant(endsAt)) return null;
  const duration = durationMinutes(startsAt, endsAt);
  if (!duration) return null;
  return { deleted: false, revision, updatedAt: validInstant(event.updated), startsAt: new Date(startsAt).toISOString(), durationMinutes: duration, eventUrl: typeof event.htmlLink === 'string' ? event.htmlLink : null };
}

export function validInstant(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export function shouldApply(change, block) {
  if (!change || !block) return false;
  if (change.revision === block.provider_revision) return false;
  // Providers can redeliver old pages. Never move a task backwards when an
  // adapter supplies an authoritative modification time.
  if (change.updatedAt && block.provider_updated_at && Date.parse(change.updatedAt) < Date.parse(block.provider_updated_at)) return false;
  return true;
}

export function isFreshNotification(cursor, headers) {
  const messageNumber = Number(headers['x-goog-message-number']);
  if (!Number.isSafeInteger(messageNumber) || messageNumber < 1) return false;
  return headers['x-goog-channel-id'] === cursor.channel_id
    && headers['x-goog-resource-id'] === cursor.channel_resource_id
    && messageNumber > Number(cursor.last_message_number ?? 0);
}
