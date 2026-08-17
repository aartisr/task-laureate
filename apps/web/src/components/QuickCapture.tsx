import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createCaptureOutboxItem, createOutboxStore } from '../infrastructure/antiBacklog/localFirstCapture';
import { parseCapture } from '../core/domain/antiBacklog';
import { flushCaptureOutbox } from '../core/services/captureDelivery';
import { clearPendingCapture, pendingCaptureEvent, readPendingCapture } from '../core/services/captureHandoff';
import { appServices } from '../app/runtime/appServices';
import type { TodoList } from '../core/contracts/domain';

const outbox = createOutboxStore();

type QuickCaptureProps = {
  /**
   * The compact trigger is intentionally designed for the primary mobile
   * navigation slot. The composer, delivery guarantees, and dialog are shared
   * with desktop so capture behaves identically on every device.
   */
  triggerVariant?: 'sidebar' | 'mobile';
};

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href]'));
}

export function QuickCapture({ triggerVariant = 'sidebar' }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [destinationListId, setDestinationListId] = useState<string | null>(null);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [listsUnavailable, setListsUnavailable] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parsed = parseCapture(value);
  const selectedList = useMemo(() => lists.find((list) => list.id === destinationListId) ?? null, [destinationListId, lists]);

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
    if (!open) return;
    let active = true;
    setListsUnavailable(false);
    void appServices.repository.listLists()
      .then((availableLists) => { if (active) { setLists(availableLists.filter((list) => list.status === 'active')); setListsUnavailable(false); } })
      .catch(() => { if (active) setListsUnavailable(true); });
    return () => { active = false; };
  }, [open]);

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
    if (isSaving) return;
    try {
      setIsSaving(true);
      await outbox.enqueue(createCaptureOutboxItem(value, parsed, destinationListId));
      const result = await flushCaptureOutbox(outbox, appServices.repository);
      clearPendingCapture();
      setValue('');
      setDestinationListId(null);
      if (result.delivered) {
        await appServices.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        await appServices.queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setNotice(`Saved to ${selectedList?.title ?? 'Inbox'}. Return to what you were doing.`);
      } else {
        setNotice('Saved safely on this device. It will retry automatically when you are online.');
      }
    } catch {
      setNotice('Your capture is still safe on this device. Please try syncing again in a moment.');
    } finally {
      setIsSaving(false);
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

  if (!open) {
    const openCapture = () => { setNotice(null); setOpen(true); };

    if (triggerVariant === 'mobile') {
      return (
        <button
          ref={triggerRef}
          type="button"
          className="mobile-bottom-nav__link mobile-bottom-nav__button mobile-bottom-nav__capture"
          aria-label="Quick capture a task, idea, or reminder"
          onClick={openCapture}
        >
          <span className="mobile-bottom-nav__capture-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span className="mobile-bottom-nav__label">Capture</span>
        </button>
      );
    }

    return <button ref={triggerRef} type="button" className="quick-capture__trigger" onClick={openCapture}><span className="quick-capture__trigger-icon" aria-hidden="true">＋</span><span>Quick capture</span><kbd>⌘⇧K</kbd></button>;
  }

  const destinationLabel = selectedList?.title ?? 'Inbox';
  const dialog = <div className="quick-capture" role="presentation">
    <button className="quick-capture__backdrop" aria-label="Close quick capture" type="button" onClick={close} />
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" aria-describedby="quick-capture-description" className="panel quick-capture__dialog" onKeyDown={trapFocus}>
      <header className="quick-capture__header"><div><p className="eyebrow">Capture without context switching</p><h2 id="quick-capture-title">What just came to mind?</h2><p id="quick-capture-description">Save it now. We’ll organize it into your Inbox without interrupting your flow.</p></div><button type="button" className="quick-capture__close" onClick={close} aria-label="Close quick capture">×</button></header>
      <div className="quick-capture__scroll">
      <div className="quick-capture__body">
        <div className="quick-capture__compose-column"><label className="quick-capture__composer"><span className="sr-only">Task, idea, or reminder</span><textarea ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setNotice(null); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save(); } }} placeholder="Write the thought exactly as it arrives…" rows={5} /></label><div className="quick-capture__helper"><span>Try: “Send report tomorrow #work 15m”</span><span><kbd>⌘↵</kbd> to save</span></div></div>
        <aside className="quick-capture__insight" aria-label="Capture details">{parsed.title ? <section className="quick-capture__preview" aria-label="Capture preview"><div className="quick-capture__preview-heading"><span aria-hidden="true">✦</span><div><strong>Ready to save</strong><p>{parsed.confidence === 'high' ? 'Details recognized automatically.' : `A clear ${destinationLabel} item will be created.`}</p></div></div><p className="quick-capture__title">{parsed.title}</p><div className="quick-capture__chips"><span>{destinationLabel}</span>{parsed.estimateMinutes ? <span>{parsed.estimateMinutes} min</span> : null}{parsed.scheduledStartAt ? <span>Tomorrow</span> : null}{parsed.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section> : <div className="quick-capture__rest-assurance"><span aria-hidden="true">⌁</span><div><strong>Your flow is protected</strong><p>Nothing is lost—captures are saved locally first, then synced when possible.</p></div></div>}</aside>
      </div>
      <details className="quick-capture__destination"><summary>Save somewhere specific <span>(optional)</span></summary><fieldset><legend>Destination</legend><label><input type="radio" name="capture-destination" checked={destinationListId === null} onChange={() => setDestinationListId(null)} disabled={isSaving} /><span><strong>Inbox</strong><small>Recommended for a thought you want to organize later.</small></span></label><label><input type="radio" name="capture-destination" checked={destinationListId !== null} onChange={() => { if (lists[0]) setDestinationListId(lists[0].id); }} disabled={isSaving || !lists.length} /><span><strong>Existing List</strong><small>Place it with work you already recognize.</small></span></label>{destinationListId !== null ? <label className="quick-capture__destination-select"><span className="sr-only">Choose an existing List</span><select aria-label="Choose an existing List" value={destinationListId} disabled={isSaving || !lists.length} onChange={(event) => setDestinationListId(event.target.value || null)}>{lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label> : null}{listsUnavailable ? <p>Lists could not be loaded. Your capture will still save safely to Inbox.</p> : !lists.length ? <p>Create a List first if you want to save directly into it.</p> : null}</fieldset></details>
      {notice ? <p role="status" className="quick-capture__notice">{notice}</p> : null}
      </div>
      <footer className="quick-capture__actions"><button type="button" className="primary-button" disabled={!parsed.title || isSaving} onClick={() => void save()}>{isSaving ? 'Saving…' : `Save to ${destinationLabel}`} <span aria-hidden="true">→</span></button><button type="button" className="quick-capture__dismiss" disabled={isSaving} onClick={close}>Keep working</button></footer>
    </div>
  </div>;

  // The trigger lives in the desktop sidebar, whose backdrop treatment creates
  // a containing block for fixed descendants. A portal ensures the dialog is
  // always anchored to the viewport—not squeezed into the sidebar column.
  return createPortal(dialog, document.body);
}
