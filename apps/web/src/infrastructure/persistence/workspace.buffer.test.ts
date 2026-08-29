import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestWorkspace } from '../../test/fixtures/workspace';
import { createBufferedPersistence, type WorkspacePersistenceAdapter } from './workspace';

describe('buffered workspace persistence failure handling', () => {
  afterEach(() => vi.useRealTimers());

  it('retains the newest snapshot, reports a failed save, and retries it', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const errors: unknown[] = [];
    const adapter: WorkspacePersistenceAdapter = {
      load: async () => null,
      save: async () => {
        attempts++;
        if (attempts === 1) throw new Error('network unavailable');
      },
    };
    const buffer = createBufferedPersistence(adapter, {
      debounceMs: 10,
      maxRetries: 0,
      retryDelayMs: 25,
      onSaveError: (error) => errors.push(error),
    });

    buffer.schedule(createTestWorkspace());
    await vi.advanceTimersByTimeAsync(10);
    expect(errors).toHaveLength(1);
    expect(attempts).toBe(1);

    await vi.advanceTimersByTimeAsync(25);
    expect(attempts).toBe(2);
  });
});
