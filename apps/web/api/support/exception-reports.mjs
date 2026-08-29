export const maxDuration = 15;

const json = { 'Content-Type': 'application/json', Accept: 'application/json' };
const maxMessageLength = 600;
const maxStackLength = 6_000;
const maxNoteLength = 2_000;
const recentReports = new Map();

function fail(response, status, message) { return response.status(status).json({ message }); }

function clean(value, limit) {
  if (typeof value !== 'string') return '';
  return value.trim()
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\b/g, '[REDACTED]')
    .replace(/\b(?:sk|pk|ghp|github_pat)_[a-zA-Z0-9_-]+\b/gi, '[REDACTED]')
    .replace(/\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/[^\s?#]+\?[^\s)]+/g, (url) => url.split('?')[0])
    .slice(0, limit);
}

function fence(value) { return clean(value, maxStackLength).replace(/```/g, '``\\u200b`'); }
function markdown(value) { return clean(value, maxMessageLength).replace(/[\r\n]+/g, ' '); }
function validRepository(value) { return typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value); }

function normalizeBody(body) {
  const diagnostic = body?.diagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') return null;
  const message = clean(diagnostic.message, maxMessageLength);
  const route = clean(diagnostic.route, 500).split('?')[0];
  const occurredAt = clean(diagnostic.occurredAt, 100);
  const source = clean(diagnostic.source, 20);
  if (!message || !route.startsWith('/') || !['render', 'window', 'promise'].includes(source) || Number.isNaN(Date.parse(occurredAt))) return null;
  return {
    message,
    route,
    occurredAt: new Date(occurredAt).toISOString(),
    source,
    stack: diagnostic.stack ? fence(diagnostic.stack) : '',
    release: clean(diagnostic.release, 100) || 'Not available',
    browser: clean(diagnostic.browser, 500) || 'Not available',
    note: clean(body.note, maxNoteLength),
  };
}

function issueBody(report) {
  return `## User report\n\n${report.note ? markdown(report.note) : '_No additional note was provided._'}\n\n## Sanitized diagnostic\n\n- **What happened:** ${markdown(report.message)}\n- **Route:** \`${report.route}\`\n- **Occurred (UTC):** ${report.occurredAt}\n- **Source:** ${report.source}\n- **Release:** ${report.release}\n- **Browser:** ${markdown(report.browser)}${report.stack ? `\n\n<details>\n<summary>Stack trace</summary>\n\n\`\`\`text\n${report.stack}\n\`\`\`\n</details>` : ''}\n\n---\n_This report was deliberately submitted by a signed-in user. Credentials, query strings, and common secret formats are redacted before delivery._`;
}

/**
 * A deliberately small support ingress. The browser never receives a GitHub
 * credential; Vercel verifies the caller with Supabase, independently scrubs
 * the report, and uses a repository-scoped Issues-write token.
 */
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).setHeader('Allow', 'POST').json({ message: 'Method not allowed.' });
  const authorization = request.headers.authorization;
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const repository = process.env.GITHUB_ISSUES_REPOSITORY;
  const githubToken = process.env.GITHUB_ISSUES_TOKEN;
  if (!authorization?.startsWith('Bearer ')) return fail(response, 401, 'Sign in before sending a support report.');
  if (!supabaseUrl || !publishableKey || !githubToken || !validRepository(repository)) return fail(response, 503, 'Support reporting is not configured for this deployment.');
  const report = normalizeBody(request.body);
  if (!report) return fail(response, 400, 'The report details are incomplete. Please try again.');

  try {
    const identityResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: authorization } });
    if (!identityResponse.ok) return fail(response, 401, 'Your session has expired. Sign in and try again.');
    const identity = await identityResponse.json();
    const dedupeKey = `${identity.id}:${report.message}:${report.route}`;
    const previous = recentReports.get(dedupeKey);
    if (previous && previous.expiresAt > Date.now()) return response.status(200).json({ issueUrl: previous.issueUrl, issueNumber: previous.issueNumber, duplicate: true });

    const githubResponse = await fetch(`https://api.github.com/repos/${repository}/issues`, {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${githubToken}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'task-laureate-support-reporter' },
      body: JSON.stringify({ title: `[User report] ${report.message.slice(0, 110)}`, body: issueBody(report) }),
    });
    if (!githubResponse.ok) {
      console.error('[Task-Laureate support] GitHub issue creation failed.', { status: githubResponse.status });
      return fail(response, 502, 'Support could not create the GitHub issue. Please try again shortly.');
    }
    const issue = await githubResponse.json();
    const outcome = { issueUrl: issue.html_url, issueNumber: issue.number };
    if (typeof outcome.issueUrl !== 'string' || !Number.isInteger(outcome.issueNumber)) return fail(response, 502, 'Support returned an incomplete response. Please try again.');
    recentReports.set(dedupeKey, { ...outcome, expiresAt: Date.now() + 15 * 60 * 1_000 });
    return response.status(201).json(outcome);
  } catch (error) {
    console.error('[Task-Laureate support] Support report failed.', { message: error instanceof Error ? error.message : String(error) });
    return fail(response, 500, 'We could not send the support report. Please try again.');
  }
}
