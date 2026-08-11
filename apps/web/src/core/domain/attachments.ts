export type AttachmentKind = 'image' | 'pdf' | 'text' | 'document' | 'file';
export type AttachmentStatus = 'uploading' | 'processing' | 'ready' | 'rejected' | 'failed';

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  contentType: string;
  byteSize: number;
  kind: AttachmentKind;
  status: AttachmentStatus;
  objectPath: string;
  thumbnailPath: string | null;
  previewPath: string | null;
  createdAt: string;
}

export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/gif']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);
const DOCUMENT_TYPES = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']);

export function classifyAttachment(contentType: string): AttachmentKind {
  if (IMAGE_TYPES.has(contentType)) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  if (TEXT_TYPES.has(contentType)) return 'text';
  if (DOCUMENT_TYPES.has(contentType)) return 'document';
  return 'file';
}

export function isAcceptedAttachment(file: Pick<File, 'type' | 'size'>): boolean {
  return file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES && (IMAGE_TYPES.has(file.type) || TEXT_TYPES.has(file.type) || DOCUMENT_TYPES.has(file.type));
}
