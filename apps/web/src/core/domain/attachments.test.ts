import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT_BYTES, classifyAttachment, isAcceptedAttachment } from './attachments';

describe('attachment policy', () => {
  it('classifies safe reference material for the correct viewer', () => {
    expect(classifyAttachment('image/avif')).toBe('image');
    expect(classifyAttachment('application/pdf')).toBe('pdf');
    expect(classifyAttachment('text/markdown')).toBe('text');
    expect(classifyAttachment('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
  });

  it('rejects empty, oversized, and unsupported files before transfer', () => {
    expect(isAcceptedAttachment({ type: 'image/webp', size: 1 } as File)).toBe(true);
    expect(isAcceptedAttachment({ type: 'application/javascript', size: 100 } as File)).toBe(false);
    expect(isAcceptedAttachment({ type: 'image/png', size: 0 } as File)).toBe(false);
    expect(isAcceptedAttachment({ type: 'image/png', size: MAX_ATTACHMENT_BYTES + 1 } as File)).toBe(false);
  });
});
