import { describe, expect, it } from 'vitest';
import { clearPendingCapture, readPendingCapture, stagePendingCapture } from './captureHandoff';

describe('capture handoff', () => {
  it('keeps shared content until Quick Capture has safely handled it', () => {
    sessionStorage.clear();
    stagePendingCapture({ text: 'Read the proposal', sourceUrl: 'https://example.test/proposal' });
    expect(readPendingCapture()).toEqual({ text: 'Read the proposal', sourceUrl: 'https://example.test/proposal' });
    clearPendingCapture();
    expect(readPendingCapture()).toBeNull();
  });
});
