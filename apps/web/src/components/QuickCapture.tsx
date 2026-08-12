import { useEffect, useRef, useState } from 'react';
import { createCaptureOutboxItem, createOutboxStore } from '../infrastructure/antiBacklog/localFirstCapture';
import { parseCapture } from '../core/domain/antiBacklog';
import { flushCaptureOutbox } from '../core/services/captureDelivery';
import { clearPendingCapture, pendingCaptureEvent, readPendingCapture } from '../core/services/captureHandoff';
import { appServices } from '../app/runtime/appServices';

const outbox = createOutboxStore();

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href]'));
}

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parsed = parseCapture(value);

  const openPendingCapture = () => {
    const pending = readPendingCapture();
    if (!pending) return;
    setValue([pending.text, pending.sourceUrl && !pending.text.includes(pending.sourceUrl) ? pending.sourceUrl : ''].filter(Boolean).join('\n'));
    setNotice('Review the capture, then save it to your Inbox.');
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setNotice(null);
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(pendingCaptureEvent, openPendingCapture);
    openPendingCapture();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(pendingCaptureEvent, openPendingCapture);
    };
  }, []);

  useEffect(() => {
    const flush = async () => {
      const result = await flushCaptureOutbox(outbox, appServices.repository);
      if (result.delivered) {
        await appServices.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        await appServices.queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    };
    const onOnline = () => void flush();
    void flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (document.activeElement !== triggerRef.current) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const close = () => setOpen(false);
  const save = async () => {
    if (!parsed.title) { setNotice('Add a task or idea to capture.'); return; }
    await outbox.enqueue(createCaptureOutboxItem(value, parsed));
    const result = await flushCaptureOutbox(outbox, appServices.repository);
    clearPendingCapture();
    setValue('');
    if (result.delivered) {
      await appServices.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await appServices.queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNotice('Captured in Inbox. You can return to what you were doing.');
    } else {
      setNotice('Captured safely on this device. It will retry when you are online.');
    }
  };

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const items = focusableElements(dialogRef.current);
    const first = items[0]; const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!open) return <button ref={triggerRef} type="button" className="secondary-button" onClick={() => { setNotice(null); setOpen(true); }}>Capture <kbd>⌘⇧K</kbd></button>;

  return <div className="quick-capture" role="presentation">
    <button className="quick-capture__backdrop" aria-label="Close quick capture" type="button" onClick={close} />
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" className="panel quick-capture__dialog" onKeyDown={trapFocus}>
      <div className="panel-heading"><div><p className="eyebrow">Quick capture</p><h2 id="quick-capture-title">What needs your attention?</h2></div><button type="button" className="secondary-button" onClick={close}>Close</button></div>
      <p className="quick-capture__hint">Use natural language: <em>“Send report tomorrow at 2pm #work 15m”</em></p>
      <textarea ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setNotice(null); }} placeholder="Add the thought before it gets away…" rows={4} />
      {parsed.title ? <div className="quick-capture__chips" aria-label="Capture details"><span>Task: {parsed.title}</span>{parsed.estimateMinutes ? <span>{parsed.estimateMinutes} min</span> : null}{parsed.scheduledStartAt ? <span>Tomorrow</span> : null}{parsed.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
      {notice ? <p role="status" className="quick-capture__notice">{notice}</p> : null}
      <div className="button-row"><button type="button" className="primary-button" disabled={!parsed.title} onClick={() => void save()}>Capture to Inbox</button><button type="button" className="secondary-button" onClick={close}>Keep working</button></div>
    </div>
  </div>;
}
