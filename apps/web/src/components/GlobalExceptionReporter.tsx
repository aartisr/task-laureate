import { useEffect, useState } from 'react';
import { isModuleVersionMismatch } from '../app/runtime/moduleRecovery';
import { createExceptionReportDraft, type ExceptionReportDraft } from '../infrastructure/support/exceptionReporting';
import { ExceptionReportDialog } from './ExceptionReportDialog';

/**
 * React boundaries do not see failed event handlers, network callbacks, or
 * rejected promises. This lightweight, user-controlled prompt covers those
 * cases without automatically exporting diagnostic data.
 */
export function GlobalExceptionReporter() {
  const [draft, setDraft] = useState<ExceptionReportDraft | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const capture = (reason: unknown, source: ExceptionReportDraft['source']) => {
      if (isModuleVersionMismatch(reason)) return;
      setDraft((current) => current ?? createExceptionReportDraft(reason, source));
    };
    const onError = (event: ErrorEvent) => capture(event.error ?? event.message, 'window');
    const onUnhandledRejection = (event: PromiseRejectionEvent) => capture(event.reason, 'promise');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  if (!draft) return null;
  const dismiss = () => { setDialogOpen(false); setDraft(null); };
  return <>
    <aside className="global-exception-prompt" role="status" aria-live="polite">
      <span aria-hidden="true">!</span>
      <div><strong>Something didn’t finish as expected.</strong><small>Your work is still here. You can help us investigate if you choose.</small></div>
      <button type="button" className="secondary-button" onClick={() => setDialogOpen(true)}>Report issue</button>
      <button type="button" className="global-exception-prompt__dismiss" onClick={dismiss} aria-label="Dismiss error notice">×</button>
    </aside>
    {dialogOpen ? <ExceptionReportDialog draft={draft} onClose={dismiss} /> : null}
  </>;
}
