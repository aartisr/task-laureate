import { describe, expect, it } from 'vitest';
import { trackGrowthEvent } from './growthTelemetry';

describe('growth telemetry', () => {
  it('emits only allow-listed scalar properties and never accepts nested task content', () => {
    const received: Array<CustomEvent<{ properties?: Record<string, unknown> }>> = [];
    const listener = (event: Event) => { received.push(event as CustomEvent<{ properties?: Record<string, unknown> }>); };
    window.addEventListener('task-laureate:growth-event', listener);
    trackGrowthEvent('demo_started', { source: 'sample_workspace', count: 1, enabled: true, task: { title: 'private note' }, email: ['person@example.com'], 'Bad Key': 'discarded' });
    window.removeEventListener('task-laureate:growth-event', listener);
    expect(received[0]?.detail.properties).toEqual({ source: 'sample_workspace', count: 1, enabled: true });
  });
});
