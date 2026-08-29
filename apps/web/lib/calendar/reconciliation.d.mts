export type ReconciliationBlock = {
  task_id: string;
  external_event_id: string;
  provider_revision?: string | null;
  provider_updated_at?: string | null;
};
export type ReconciliationChange = {
  deleted: boolean;
  revision: string;
  updatedAt: string | null;
  startsAt: string | null;
  durationMinutes: number | null;
  eventUrl: string | null;
};
export function durationMinutes(start: string, end: string): number | null;
export function googleTaskEventPayload(input: { eventId: string; taskId: string; connectionId: string; title: string; listTitle?: string | null; startsAt: string; durationMinutes: number }): { id: string; status: 'confirmed'; summary: string; description: string; start: { dateTime: string }; end: { dateTime: string }; extendedProperties: { private: { taskLaureateTaskId: string; taskLaureateConnectionId: string; schedulingMode: 'two-way' } } };
export function isMissingGoogleEventStatus(status: unknown): boolean;
export function validInstant(value: unknown): string | null;
export function ownedEventChange(event: unknown, block: ReconciliationBlock | undefined, connectionId: string): ReconciliationChange | null;
export function shouldApply(change: ReconciliationChange | null, block: ReconciliationBlock | undefined): boolean;
export function isFreshNotification(cursor: { channel_id: string; channel_resource_id: string; last_message_number?: number }, headers: Record<string, unknown>): boolean;
