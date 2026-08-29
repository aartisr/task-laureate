import { createHmac } from 'node:crypto';
import { createAiProposalProvider } from './providers/registry.mjs';

export const maxDuration = 15;

const json = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const sensitivePatterns = [
  /\b(?:sk|AIza)[a-z0-9_-]{16,}\b/i,
  /\b(?:password|passcode|secret|api[ _-]?key|access[ _-]?token)\s*[:=]/i,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:\+?\d[\d ()-]{7,}\d)\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:medical record|patient|insurance)\s*(?:id|number|no\.?|#)\s*[:=#-]?\s*[a-z0-9-]{4,}\b/i,
  /\b(?:diagnosis|test results?|prescription|treatment plan)\s*[:=#-]\s*\S+/i,
];

function respond(response, status, payload) {
  for (const [name, value] of Object.entries(json)) response.setHeader(name, value);
  return response.status(status).json(payload);
}
const configured = (name) => typeof process.env[name] === 'string' && process.env[name].trim().length > 0;
const normalize = (value) => value.trim().replace(/\s+/g, ' ');

function configuration() {
  const enabled = process.env.AI_DECOMPOSITION_PREVIEW_ENABLED === 'true';
  const provider = process.env.AI_DECOMPOSITION_PROVIDER ?? 'gemini-free-preview';
  const model = process.env.AI_DECOMPOSITION_MODEL;
  const users = new Set((process.env.AI_DECOMPOSITION_ALLOWED_USERS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { enabled, provider, model, users, supabaseUrl, supabaseKey, geminiKey: process.env.GEMINI_API_KEY, cacheSecret: process.env.AI_DECOMPOSITION_CACHE_SECRET };
}

function safeInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.some((key) => !['taskId', 'consent', 'consentVersion'].includes(key))) return null;
  const { taskId, consent, consentVersion } = body;
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId) || typeof consent !== 'boolean' || typeof consentVersion !== 'string' || !/^[a-z0-9.-]{1,80}$/i.test(consentVersion)) return null;
  return { taskId, consent, consentVersion };
}

async function authenticatedUser(request, config) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ') || !config.supabaseUrl || !config.supabaseKey) return null;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, { headers: { apikey: config.supabaseKey, Authorization: auth } });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return typeof user?.id === 'string' ? user : null;
}

function cacheKey(config, input) {
  const secret = config.cacheSecret || config.geminiKey;
  return createHmac('sha256', secret).update(JSON.stringify({ title: input.title, notes: input.notes, model: config.model, prompt: 'task-decomposition.v1', schema: 1 })).digest('hex');
}

async function rpc(config, authorization, name, body) {
  const result = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.supabaseKey, Authorization: authorization }, body: JSON.stringify(body) });
  const payload = await result.json().catch(() => null);
  return { ok: result.ok, status: result.status, payload };
}

async function audit(config, authorization, taskId, eventType, detail = {}) {
  // Operational evidence must never interfere with a user's decomposition.
  await rpc(config, authorization, 'record_ai_decomposition_event', { p_task_id: taskId, p_event_type: eventType, p_provider: detail.provider ?? null, p_model: detail.model ?? null, p_prompt_version: detail.promptVersion ?? null, p_cache_status: detail.cacheStatus ?? null, p_latency_ms: detail.latencyMs ?? null }).catch(() => undefined);
}

function validText(value, limit) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit ? value.trim() : null; }
function validShortTexts(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) return null;
  const texts = value.map((entry) => validText(entry, 240));
  return texts.every(Boolean) ? texts : null;
}

function validateProposal(value, input, config) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const summary = validText(value.summary, 500); const firstAction = validText(value.firstAction, 500);
  const assumptions = validShortTexts(value.assumptions); const warnings = validShortTexts(value.warnings);
  if (!summary || !firstAction || !assumptions || !warnings || !Array.isArray(value.steps) || value.steps.length < 3 || value.steps.length > 7) return null;
  const steps = value.steps.map((step) => {
    const title = validText(step?.title, 500);
    return title && [5, 10, 15, 30, 45, 60].includes(step?.estimateMinutes) && ['deep', 'light', 'quick'].includes(step?.energyLevel) ? { title, estimateMinutes: step.estimateMinutes, energyLevel: step.energyLevel } : null;
  });
  if (steps.some((step) => !step)) return null;
  return { taskTitle: input.title, summary, firstAction, steps, source: 'ai', assumptions, warnings, provenance: { provider: 'gemini', model: config.model, promptVersion: 'task-decomposition.v1', schemaVersion: 1 } };
}

async function generateProposal(config, input) {
  const provider = createAiProposalProvider(config);
  if (!provider) return { kind: 'provider_unavailable' };
  const result = await provider.generate(input);
  if (result.kind !== 'raw') return result;
  const proposal = validateProposal(result.value, input, config);
  return proposal ? { kind: 'proposal', proposal } : { kind: 'invalid_output' };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const config = configuration();
  if (!config.enabled || config.provider !== 'gemini-free-preview') return respond(response, 503, { code: 'disabled' });
  if (!configured('GEMINI_API_KEY') || !config.model || !config.supabaseUrl || !config.supabaseKey || !config.cacheSecret) return respond(response, 503, { code: 'disabled' });
  const actor = await authenticatedUser(request, config);
  if (!actor) return respond(response, 401, { code: 'not_signed_in' });
  if (!config.users.has(actor.id)) return respond(response, 403, { code: 'not_eligible' });
  const input = safeInput(request.body);
  if (!input) return respond(response, 400, { code: 'invalid_request' });
  if (!input.consent) return respond(response, 403, { code: 'consent_required' });
  const authorization = request.headers.authorization;
  const consent = await rpc(config, authorization, 'record_ai_decomposition_consent', { p_consent_version: input.consentVersion });
  if (!consent.ok) return respond(response, 403, { code: 'consent_required' });
  const canonical = await rpc(config, authorization, 'get_ai_decomposition_task', { p_task_id: input.taskId, p_consent_version: input.consentVersion });
  if (!canonical.ok || !canonical.payload || typeof canonical.payload.title !== 'string' || typeof canonical.payload.notes !== 'string') return respond(response, canonical.status === 401 ? 401 : 403, { code: canonical.status === 401 ? 'not_signed_in' : 'not_eligible' });
  const safeTask = { taskId: input.taskId, title: normalize(canonical.payload.title), notes: normalize(canonical.payload.notes) };
  if (safeTask.title.length < 1 || safeTask.title.length > 500 || safeTask.notes.length > 1500 || sensitivePatterns.some((pattern) => pattern.test(`${safeTask.title}\n${safeTask.notes}`))) {
    await audit(config, authorization, input.taskId, 'fallback');
    return respond(response, 422, { code: 'content_not_allowed' });
  }
  await audit(config, authorization, input.taskId, 'requested');
  const key = cacheKey(config, safeTask);
  const cached = await rpc(config, authorization, 'get_ai_decomposition_cache', { p_cache_key: key });
  const cachedProposal = cached.ok ? validateProposal(cached.payload, safeTask, config) : null;
  if (cachedProposal) {
    await audit(config, authorization, input.taskId, 'cache_hit', { provider: 'gemini', model: config.model, promptVersion: 'task-decomposition.v1', cacheStatus: 'hit' });
    return respond(response, 200, { proposal: cachedProposal, cache: 'hit' });
  }
  const reservation = await rpc(config, authorization, 'reserve_ai_decomposition_request', { p_task_id: input.taskId });
  if (!reservation.ok || reservation.payload !== true) { await audit(config, authorization, input.taskId, 'rate_limited'); return respond(response, 429, { code: 'rate_limited' }); }
  const startedAt = Date.now();
  const result = await generateProposal(config, safeTask);
  const latencyMs = Date.now() - startedAt;
  if (result.kind !== 'proposal') { await audit(config, authorization, input.taskId, result.kind === 'invalid_output' ? 'schema_rejected' : 'fallback', { provider: 'gemini', model: config.model, promptVersion: 'task-decomposition.v1', latencyMs }); return respond(response, result.kind === 'rate_limited' ? 429 : result.kind === 'provider_unavailable' ? 503 : 422, { code: result.kind }); }
  await rpc(config, authorization, 'put_ai_decomposition_cache', { p_cache_key: key, p_proposal: result.proposal, p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
  await audit(config, authorization, input.taskId, 'succeeded', { provider: 'gemini', model: config.model, promptVersion: 'task-decomposition.v1', cacheStatus: 'miss', latencyMs });
  return respond(response, 200, { proposal: result.proposal, cache: 'miss' });
}
