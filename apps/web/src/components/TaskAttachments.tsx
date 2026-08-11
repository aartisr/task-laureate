import { useEffect, useRef, useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { MAX_ATTACHMENT_BYTES, isAcceptedAttachment, type TaskAttachment } from '../core/domain/attachments';
import { supportsAttachments } from '../core/contracts/repository';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json,.docx,.xlsx,.pptx';

function readableBytes(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function icon(kind: TaskAttachment['kind']) { return kind === 'image' ? '▧' : kind === 'pdf' ? 'PDF' : kind === 'text' ? 'TXT' : kind === 'document' ? 'DOC' : 'FILE'; }

export function TaskAttachments({ taskId, readOnly = false }: { taskId: string; readOnly?: boolean }) {
  const repository = appServices.repository;
  const attachmentRepository = supportsAttachments(repository) ? repository : null;
  const supported = Boolean(attachmentRepository);
  const [items, setItems] = useState<TaskAttachment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [preview, setPreview] = useState<{ attachment: TaskAttachment; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = async () => { if (!attachmentRepository) return; try { setItems(await attachmentRepository.listAttachments(taskId)); } catch { setMessage('Attachments could not be loaded. Confirm the attachment migration is applied.'); } };
  useEffect(() => { void load(); }, [taskId, supported]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const upload = async (files: FileList | File[]) => {
    if (!attachmentRepository || readOnly) return;
    for (const file of Array.from(files)) {
      if (!isAcceptedAttachment(file)) { setMessage(`${file.name} is not an accepted reference file, or exceeds ${readableBytes(MAX_ATTACHMENT_BYTES)}.`); continue; }
      try { setUploading({ name: file.name, progress: 0 }); const created = await attachmentRepository.uploadAttachment(taskId, file, (progress) => setUploading({ name: file.name, progress })); setItems((current) => [created, ...current]); }
      catch (error) { setMessage(error instanceof Error ? error.message : `Could not upload ${file.name}.`); }
      finally { setUploading(null); }
    }
  };
  const open = async (attachment: TaskAttachment) => {
    try { const url = await attachmentRepository!.getAttachmentUrl(attachment, attachment.kind === 'image' ? 'preview' : 'original'); setPreview({ attachment, url }); }
    catch { setMessage('This attachment could not be opened securely.'); }
  };
  const remove = async (attachment: TaskAttachment) => {
    if (!window.confirm(`Remove ${attachment.name}?`)) return;
    try { await attachmentRepository!.deleteAttachment(attachment); setItems((current) => current.filter((item) => item.id !== attachment.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The attachment could not be removed.'); }
  };

  if (!supported) return null;
  return <section className="task-attachments" aria-labelledby={`attachments-${taskId}`}>
    <header><div><p className="eyebrow">Reference material</p><h3 id={`attachments-${taskId}`}>Attachments</h3><span>Private to people with access to this task.</span></div>{!readOnly ? <button type="button" className="secondary-button" onClick={() => input.current?.click()} disabled={Boolean(uploading)}>Attach files</button> : null}</header>
    {!readOnly ? <div className="task-attachments__dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') input.current?.click(); }}><strong>Drop files here or browse</strong><span>Images, PDFs, text, Markdown, CSV, JSON, Word, Excel, and PowerPoint · up to 100 MB</span><input ref={input} type="file" multiple accept={ACCEPT} onChange={(event) => { if (event.target.files) void upload(event.target.files); event.currentTarget.value = ''; }} /></div> : null}
    {uploading ? <p className="task-attachments__progress" role="status">Uploading {uploading.name} · {uploading.progress}%</p> : null}
    {items.length ? <ul className="task-attachments__list">{items.map((attachment) => <li key={attachment.id}><button type="button" className="task-attachments__open" onClick={() => void open(attachment)}><b aria-hidden="true">{icon(attachment.kind)}</b><span><strong>{attachment.name}</strong><small>{readableBytes(attachment.byteSize)} · {attachment.status}</small></span></button>{!readOnly ? <button type="button" className="task-attachments__remove" onClick={() => void remove(attachment)} aria-label={`Remove ${attachment.name}`}>×</button> : null}</li>)}</ul> : <p className="task-attachments__empty">{readOnly ? 'No reference files attached.' : 'Add the brief, evidence, screenshots, or source material this task needs.'}</p>}
    {message ? <p className="task-attachments__message" role="alert">{message}</p> : null}
    {preview ? <div className="task-attachments__viewer" role="dialog" aria-modal="true" aria-label={`Preview ${preview.attachment.name}`}><header><strong>{preview.attachment.name}</strong><button type="button" onClick={() => setPreview(null)} aria-label="Close preview">×</button></header>{preview.attachment.kind === 'image' ? <img src={preview.url} alt={preview.attachment.name} /> : preview.attachment.kind === 'pdf' ? <iframe src={preview.url} title={preview.attachment.name} /> : <iframe src={preview.url} title={preview.attachment.name} />}</div> : null}
  </section>;
}
