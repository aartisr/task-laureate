import { useState } from 'react';
import { sanitizeSupportNote, submitExceptionReport, supportReportLimits, type ExceptionReportDraft } from '../infrastructure/support/exceptionReporting';

export function ExceptionReportDialog({ draft, onClose }: { draft: ExceptionReportDraft; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [issue, setIssue] = useState<{ issueUrl: string; issueNumber: number } | null>(null);
  const safeNote = sanitizeSupportNote(note);

  const send = async () => {
    setSending(true); setError('');
    try { setIssue(await submitExceptionReport(draft, safeNote)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not send the report.'); }
    finally { setSending(false); }
  };

  return <div className="exception-report" role="presentation">
    <button className="exception-report__backdrop" type="button" aria-label="Close support report" onClick={onClose} />
    <section className="exception-report__dialog panel" role="dialog" aria-modal="true" aria-labelledby="exception-report-title">
      {issue ? <><p className="eyebrow">Report sent</p><h2 id="exception-report-title">Thank you for helping improve Task Laureate.</h2><p>A GitHub issue was created for the support team.</p><div className="button-row"><a className="primary-button" href={issue.issueUrl} target="_blank" rel="noreferrer">View GitHub issue #{issue.issueNumber}</a><button type="button" className="secondary-button" onClick={onClose}>Done</button></div></> : <><header><div><p className="eyebrow">Help us fix this</p><h2 id="exception-report-title">Send a support report?</h2><p>We will create a GitHub issue with the reviewed technical details below. Remove task, list, account, or other personal information from your note before sending.</p></div><button type="button" className="exception-report__close" aria-label="Close support report" onClick={onClose}>×</button></header><label className="exception-report__note"><span>What were you trying to do? <em>(optional)</em></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={supportReportLimits.maxNoteLength} rows={4} placeholder="For example: I was moving a task to another list." disabled={sending} /><small>{safeNote.length}/{supportReportLimits.maxNoteLength}</small></label><details className="exception-report__preview"><summary>Review technical details</summary><dl><div><dt>What happened</dt><dd>{draft.message}</dd></div><div><dt>Where</dt><dd>{draft.route}</dd></div><div><dt>When</dt><dd>{new Date(draft.occurredAt).toLocaleString()}</dd></div><div><dt>Source</dt><dd>{draft.source}</dd></div>{draft.release ? <div><dt>Release</dt><dd>{draft.release}</dd></div> : null}</dl>{draft.stack ? <pre>{draft.stack}</pre> : null}</details>{error ? <p className="exception-report__error" role="alert">{error}</p> : null}<footer className="button-row"><button type="button" className="primary-button" disabled={sending} onClick={() => void send()}>{sending ? 'Sending…' : 'Send to Support'}</button><button type="button" className="secondary-button" disabled={sending} onClick={onClose}>Not now</button></footer></>}</section>
  </div>;
}
