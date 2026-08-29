import { describe, expect, it } from 'vitest';
import { durationMinutes, googleTaskEventPayload, isFreshNotification, isMissingGoogleEventStatus, ownedEventChange, shouldApply, validInstant } from '../../../lib/calendar/reconciliation.mjs';

const connectionId = '55555555-5555-4555-8555-555555555555';
const block = {
  task_id: '11111111-1111-4111-8111-111111111111',
  external_event_id: 'task-laureate-event',
  provider_revision: '"revision-1"',
  provider_updated_at: '2026-08-13T10:00:00.000Z',
};
const event = (overrides: Record<string, unknown> = {}) => ({
  id: block.external_event_id,
  etag: '"revision-2"',
  updated: '2026-08-13T11:00:00.000Z',
  status: 'confirmed',
  start: { dateTime: '2026-08-14T14:00:00.000Z' },
  end: { dateTime: '2026-08-14T14:45:00.000Z' },
  htmlLink: 'https://calendar.google.test/event',
  extendedProperties: { private: { taskLaureateTaskId: block.task_id, taskLaureateConnectionId: connectionId, schedulingMode: 'two-way' } },
  ...overrides,
});

describe('provider-neutral calendar reconciliation', () => {
  it('explicitly restores a Google block that was previously cancelled', () => {
    expect(googleTaskEventPayload({ eventId: 'event-1', taskId: block.task_id, connectionId, title: 'Finish report', listTitle: 'Work', startsAt: '2026-08-14T14:00:00.000Z', durationMinutes: 30 })).toMatchObject({
      id: 'event-1', status: 'confirmed', summary: 'Finish report',
      start: { dateTime: '2026-08-14T14:00:00.000Z' }, end: { dateTime: '2026-08-14T14:30:00.000Z' },
    });
  });

  it('treats an already-deleted Google event as a successful local removal', () => {
    expect(isMissingGoogleEventStatus(404)).toBe(true);
    expect(isMissingGoogleEventStatus(410)).toBe(true);
    expect(isMissingGoogleEventStatus(403)).toBe(false);
    expect(isMissingGoogleEventStatus(500)).toBe(false);
  });

  it('accepts a valid owned time move and normalizes its values', () => {
    expect(ownedEventChange(event(), block, connectionId)).toEqual({
      deleted: false, revision: '"revision-2"', updatedAt: '2026-08-13T11:00:00.000Z',
      startsAt: '2026-08-14T14:00:00.000Z', durationMinutes: 45,
      eventUrl: 'https://calendar.google.test/event',
    });
  });

  it('accepts an owned resize and carries the exact new duration to the database boundary', () => {
    const resized = ownedEventChange(event({ end: { dateTime: '2026-08-14T15:00:00.000Z' } }), block, connectionId);
    expect(resized).toMatchObject({ deleted: false, startsAt: '2026-08-14T14:00:00.000Z', durationMinutes: 60 });
    expect(shouldApply(resized, block)).toBe(true);
  });

  it('never applies an external resize whose revision or modification time is stale', () => {
    const resized = ownedEventChange(event({ end: { dateTime: '2026-08-14T15:00:00.000Z' } }), block, connectionId)!;
    expect(shouldApply({ ...resized, revision: block.provider_revision }, block)).toBe(false);
    expect(shouldApply({ ...resized, updatedAt: '2026-08-13T09:00:00.000Z' }, block)).toBe(false);
  });

  it.each([
    ['unknown event id', event({ id: 'ordinary-event' })],
    ['missing task ownership marker', event({ extendedProperties: { private: { taskLaureateConnectionId: connectionId } } })],
    ['wrong task marker', event({ extendedProperties: { private: { taskLaureateTaskId: 'other-task', taskLaureateConnectionId: connectionId } } })],
    ['wrong connection marker', event({ extendedProperties: { private: { taskLaureateTaskId: block.task_id, taskLaureateConnectionId: 'other-connection' } } })],
    ['all-day event', event({ start: { date: '2026-08-14' }, end: { date: '2026-08-15' } })],
    ['invalid interval', event({ end: { dateTime: '2026-08-14T14:00:00.000Z' } })],
    ['overly long interval', event({ end: { dateTime: '2026-08-16T14:00:00.000Z' } })],
    ['event without a revision', event({ etag: undefined, updated: undefined })],
  ])('refuses an unsafe or unsupported change: %s', (_reason, unsafeEvent) => {
    expect(ownedEventChange(unsafeEvent, block, connectionId)).toBeNull();
  });

  it('allows a cancellation for a known owned block even when Google omits private properties', () => {
    expect(ownedEventChange(event({ status: 'cancelled', extendedProperties: undefined }), block, connectionId)).toMatchObject({ deleted: true, revision: '"revision-2"' });
  });

  it('does not replay the same revision or move a task backwards with an old provider timestamp', () => {
    const change = ownedEventChange(event(), block, connectionId)!;
    expect(shouldApply({ ...change, revision: block.provider_revision }, block)).toBe(false);
    expect(shouldApply({ ...change, updatedAt: '2026-08-13T09:59:59.000Z' }, block)).toBe(false);
    expect(shouldApply(change, block)).toBe(true);
  });

  it.each([
    ['five minute minimum', '2026-08-14T14:00:00.000Z', '2026-08-14T14:05:00.000Z', 5],
    ['full day maximum', '2026-08-14T14:00:00.000Z', '2026-08-15T14:00:00.000Z', 1440],
    ['non-whole minutes are rejected', '2026-08-14T14:00:00.000Z', '2026-08-14T14:05:30.000Z', null],
    ['too short is rejected', '2026-08-14T14:00:00.000Z', '2026-08-14T14:04:00.000Z', null],
  ])('validates duration boundaries: %s', (_name, start, end, expected) => expect(durationMinutes(start, end)).toBe(expected));

  it('treats provider notification delivery as ordered-but-not-contiguous', () => {
    const cursor = { channel_id: 'channel-1', channel_resource_id: 'resource-1', last_message_number: 7 };
    expect(isFreshNotification(cursor, { 'x-goog-channel-id': 'channel-1', 'x-goog-resource-id': 'resource-1', 'x-goog-message-number': '9' })).toBe(true);
    expect(isFreshNotification(cursor, { 'x-goog-channel-id': 'channel-1', 'x-goog-resource-id': 'resource-1', 'x-goog-message-number': '7' })).toBe(false);
    expect(isFreshNotification(cursor, { 'x-goog-channel-id': 'channel-1', 'x-goog-resource-id': 'other', 'x-goog-message-number': '10' })).toBe(false);
    expect(isFreshNotification(cursor, { 'x-goog-channel-id': 'channel-1', 'x-goog-resource-id': 'resource-1', 'x-goog-message-number': 'not-a-number' })).toBe(false);
  });

  it('normalizes only valid provider instants', () => {
    expect(validInstant('2026-08-14T10:00:00-04:00')).toBe('2026-08-14T14:00:00.000Z');
    expect(validInstant('not-a-date')).toBeNull();
    expect(validInstant(undefined)).toBeNull();
  });
});
