import { authProvider } from '../../config/persistence.config';

const maxMessageLength = 600;
const maxStackLength = 6_000;
const maxNoteLength = 2_000;

export type ExceptionReportDraft = Readonly<{
  message: string;
  stack: string | null;
  route: string;
  occurredAt: string;
  release: string | null;
  browser: string;
  source: 'render' | 'window' | 'promise';
}>;

function redact(value: string, limit: number) {
  // Never preserve a matched credential as part of the replacement. This is
  // intentionally repeated on the server: the browser is a convenience layer,
  // not a security boundary.
  return value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\b/g, '[REDACTED]')
    .replace(/\b(?:sk|pk|ghp|github_pat)_[a-zA-Z0-9_-]+\b/gi, '[REDACTED]')
    .replace(/\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/[^\s?#]+\?[^\s)]+/g, (url) => url.split('?')[0])
    .slice(0, limit);
}

export function createExceptionReportDraft(error: unknown, source: ExceptionReportDraft['source'] = 'render'): ExceptionReportDraft {
  const normalized = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown application error');
  return {
    message: redact(normalized.message || normalized.name, maxMessageLength),
    stack: normalized.stack ? redact(normalized.stack, maxStackLength) : null,
    route: typeof window === 'undefined' ? '/' : window.location.pathname,
    occurredAt: new Date().toISOString(),
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ?? null,
    browser: typeof navigator === 'undefined' ? 'Unavailable' : redact(navigator.userAgent, 500),
    source,
  };
}

export function sanitizeSupportNote(note: string) {
  return redact(note.trim(), maxNoteLength);
}

export async function submitExceptionReport(draft: ExceptionReportDraft, note: string) {
  const session = await authProvider.getSession();
  if (!session) throw new Error('Please sign in before sending a support report.');
  const response = await fetch('/api/support/exception-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ diagnostic: draft, note: sanitizeSupportNote(note) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'We could not send the report.');
  return payload as { issueUrl: string; issueNumber: number };
}

export const supportReportLimits = { maxMessageLength, maxStackLength, maxNoteLength };
