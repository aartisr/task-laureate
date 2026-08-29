import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createCaptureOutboxItem, createOutboxStore } from '../infrastructure/antiBacklog/localFirstCapture';
import { parseCapture } from '../core/domain/antiBacklog';
import { flushCaptureOutbox } from '../core/services/captureDelivery';
import { clearPendingCapture, pendingCaptureEvent, readPendingCapture } from '../core/services/captureHandoff';
import { appServices } from '../app/runtime/appServices';
import type { TodoList } from '../core/contracts/domain';
import { AppIcon } from './AppIcon';

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
  const [splitMultiLine, setSplitMultiLine] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parsed = useMemo(() => parseCapture(value), [value]);

  // Match /list-name routing from typed syntax
  useEffect(() => {
    if (parsed.targetListSlugOrName && lists.length > 0) {
      const slug = parsed.targetListSlugOrName.toLowerCase().replace(/[-_]/g, ' ');
      const matched = lists.find((list) => {
        const titleClean = list.title.toLowerCase().replace(/[-_]/g, ' ');
        return titleClean === slug || titleClean.startsWith(slug) || list.id.toLowerCase().startsWith(slug);
      });
      if (matched && matched.id !== destinationListId) {
        setDestinationListId(matched.id);
      }
    }
  }, [parsed.targetListSlugOrName, lists, destinationListId]);

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

  const insertSnippet = (snippet: string) => {
    setValue((prev) => {
      const trimmed = prev.trimEnd();
      const next = trimmed ? `${trimmed} ${snippet}` : snippet;
      return next;
    });
    inputRef.current?.focus();
  };

  const close = () => setOpen(false);

  const save = async () => {
    const effectiveParsed = splitMultiLine ? parsed : { ...parsed, isMultiLine: false, individualItems: undefined };
    if (!effectiveParsed.title) { setNotice('Add a task or idea to capture.'); return; }
    if (isSaving) return;
    try {
      setIsSaving(true);
      await outbox.enqueue(createCaptureOutboxItem(value, effectiveParsed, destinationListId));
      const result = await flushCaptureOutbox(outbox, appServices.repository);
      clearPendingCapture();
      setValue('');
      setDestinationListId(null);
      const itemsCount = effectiveParsed.isMultiLine && effectiveParsed.individualItems ? effectiveParsed.individualItems.length : 1;
      const countLabel = itemsCount > 1 ? `${itemsCount} tasks` : 'Task';
      if (result.delivered) {
        await appServices.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        await appServices.queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setNotice(`Saved ${countLabel} to ${selectedList?.title ?? 'Inbox'}. Return to what you were doing.`);
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
            <AppIcon name="plus" />
          </span>
          <span className="mobile-bottom-nav__label">Capture</span>
        </button>
      );
    }

    return <button ref={triggerRef} type="button" className="quick-capture__trigger" onClick={openCapture}><span className="quick-capture__trigger-icon" aria-hidden="true"><AppIcon name="plus" /></span><span>Quick capture</span><kbd>⌘⇧K</kbd></button>;
  }

  const destinationLabel = selectedList?.title ?? 'Inbox';
  const isMulti = Boolean(parsed.isMultiLine && parsed.individualItems && parsed.individualItems.length > 1);
  const itemCount = isMulti && splitMultiLine && parsed.individualItems ? parsed.individualItems.length : 1;

  const dialog = <div className="quick-capture" role="presentation">
    <button className="quick-capture__backdrop" aria-label="Close quick capture" type="button" onClick={close} />
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" aria-describedby="quick-capture-description" className="panel quick-capture__dialog" onKeyDown={trapFocus}>
      <header className="quick-capture__header"><div><p className="eyebrow">Capture without context switching</p><h2 id="quick-capture-title">Smart Omnibar Capture</h2><p id="quick-capture-description">Type freely. Use <kbd>/list</kbd>, <kbd>#tag</kbd>, <kbd>tomorrow</kbd>, <kbd>30m</kbd>, <kbd>~deep</kbd>, or <kbd>!urgent</kbd>.</p></div><button type="button" className="quick-capture__close" onClick={close} aria-label="Close quick capture"><AppIcon name="close" /></button></header>
      <div className="quick-capture__scroll">
      <div className="quick-capture__body">
        <div className="quick-capture__compose-column">
          <label className="quick-capture__composer">
            <span className="sr-only">Task, idea, or reminder</span>
            <textarea
              ref={inputRef}
              value={value}
              onChange={(event) => { setValue(event.target.value); setNotice(null); }}
              onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save(); } }}
              placeholder="Write anything… e.g. Finish brief tomorrow /Work #launch 45m ~deep !urgent"
              rows={4}
            />
          </label>

          {/* Omnibar Quick Syntax Helper Chips */}
          <div className="quick-capture__syntax-bar" aria-label="Omnibar syntax shortcuts">
            <span className="quick-capture__syntax-label">Insert:</span>
            <button type="button" className="quick-capture__syntax-chip" onClick={() => insertSnippet('tomorrow')}>📅 tomorrow</button>
            <button type="button" className="quick-capture__syntax-chip" onClick={() => insertSnippet('30m')}>⏱ 30m</button>
            <button type="button" className="quick-capture__syntax-chip" onClick={() => insertSnippet('~deep')}>⚡ ~deep</button>
            <button type="button" className="quick-capture__syntax-chip" onClick={() => insertSnippet('!urgent')}>🚨 !urgent</button>
            {lists.slice(0, 3).map((l) => (
              <button key={l.id} type="button" className="quick-capture__syntax-chip" onClick={() => insertSnippet(`/${l.title.replace(/\s+/g, '-').toLowerCase()}`)}>📂 /{l.title}</button>
            ))}
          </div>

          {/* Multi-line Split Toggle */}
          {isMulti ? (
            <div className="quick-capture__multiline-toggle" role="group" aria-label="Multi-line save mode">
              <span>{parsed.individualItems?.length} items detected:</span>
              <label>
                <input
                  type="checkbox"
                  checked={splitMultiLine}
                  onChange={(e) => setSplitMultiLine(e.target.checked)}
                />
                <span>Create as {parsed.individualItems?.length} separate tasks</span>
              </label>
            </div>
          ) : null}

          <div className="quick-capture__helper">
            <span><kbd>⌘↵</kbd> or <kbd>Ctrl+Enter</kbd> to save instantly</span>
            <span>Natural language routing enabled</span>
          </div>
        </div>

        <aside className="quick-capture__insight" aria-label="Capture details">
          {parsed.title ? (
            <section className="quick-capture__preview" aria-label="Capture preview">
              <div className="quick-capture__preview-heading">
                <span aria-hidden="true"><AppIcon name="spark" /></span>
                <div>
                  <strong>{isMulti && splitMultiLine ? `${itemCount} tasks ready` : 'Ready to save'}</strong>
                  <p>{parsed.confidence === 'high' ? 'Details recognized automatically.' : `Saving to ${destinationLabel}.`}</p>
                </div>
              </div>
              <p className="quick-capture__title">
                {isMulti && splitMultiLine
                  ? `${parsed.title} (+${(parsed.individualItems?.length ?? 1) - 1} more)`
                  : parsed.title}
              </p>
              <div className="quick-capture__chips">
                <span>📂 {destinationLabel}</span>
                {parsed.estimateMinutes ? <span>⏱ {parsed.estimateMinutes} min</span> : null}
                {parsed.scheduledStartAt ? <span>📅 Tomorrow</span> : null}
                {parsed.energyLevel ? <span>⚡ {parsed.energyLevel}</span> : null}
                {parsed.priority ? <span>🚨 {parsed.priority}</span> : null}
                {parsed.tags.map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
            </section>
          ) : (
            <div className="quick-capture__rest-assurance">
              <span aria-hidden="true"><AppIcon name="spark" /></span>
              <div>
                <strong>Zero friction Omnibar</strong>
                <p>Type your ideas naturally. Tags, durations, dates, energy levels, and target lists are automatically organized.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      <details className="quick-capture__destination"><summary>Save somewhere specific <span>(optional override)</span></summary><fieldset><legend>Destination</legend><label><input type="radio" name="capture-destination" checked={destinationListId === null} onChange={() => setDestinationListId(null)} disabled={isSaving} /><span><strong>Inbox</strong><small>Recommended for a thought you want to organize later.</small></span></label><label><input type="radio" name="capture-destination" checked={destinationListId !== null} onChange={() => { if (lists[0]) setDestinationListId(lists[0].id); }} disabled={isSaving || !lists.length} /><span><strong>Existing List</strong><small>Place it with work you already recognize.</small></span></label>{destinationListId !== null ? <label className="quick-capture__destination-select"><span className="sr-only">Choose an existing List</span><select aria-label="Choose an existing List" value={destinationListId} disabled={isSaving || !lists.length} onChange={(event) => setDestinationListId(event.target.value || null)}>{lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label> : null}{listsUnavailable ? <p>Lists could not be loaded. Your capture will still save safely to Inbox.</p> : !lists.length ? <p>Create a List first if you want to save directly into it.</p> : null}</fieldset></details>
      {notice ? <p role="status" className="quick-capture__notice">{notice}</p> : null}
      </div>
      <footer className="quick-capture__actions">
        <button type="button" className="primary-button" disabled={!parsed.title || isSaving} onClick={() => void save()}>
          {isSaving ? 'Saving…' : `Save ${itemCount > 1 ? `${itemCount} Tasks` : 'Task'} to ${destinationLabel}`} <AppIcon name="arrow-right" />
        </button>
        <button type="button" className="quick-capture__dismiss" disabled={isSaving} onClick={close}>Keep working</button>
      </footer>
    </div>
  </div>;

  return createPortal(dialog, document.body);
}
