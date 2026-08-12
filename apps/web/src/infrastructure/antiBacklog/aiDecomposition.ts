import type { TodoItem } from '../../core/contracts/domain';
import type { DecompositionStep, TaskPlanProposal } from '../../core/domain/antiBacklog';
import { isFeatureEnabled } from '../../config/featureFlags';
import { authProvider } from '../../config/persistence.config';

export type AiDecompositionFailure =
  | 'disabled' | 'not_signed_in' | 'consent_required' | 'content_not_allowed'
  | 'rate_limited' | 'provider_unavailable' | 'invalid_output';

export type AiDecompositionResult =
  | { kind: 'proposal'; proposal: TaskPlanProposal; cache: 'hit' | 'miss' }
  | { kind: 'fallback'; reason: AiDecompositionFailure };

const endpoint = '/api/ai/decompose';
export const aiPreviewConsentVersion = 'gemini-free-preview.v1';
const energies = new Set(['deep', 'light', 'quick']);
const estimates = new Set([5, 10, 15, 30, 45, 60]);

function failureFromStatus(status: number): AiDecompositionFailure {
  if (status === 401) return 'not_signed_in';
  if (status === 403) return 'consent_required';
  if (status === 413 || status === 422) return 'content_not_allowed';
  if (status === 429) return 'rate_limited';
  if (status === 503 || status === 504) return 'provider_unavailable';
  return 'invalid_output';
}

function text(value: unknown, limit: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit ? value.trim() : null;
}

function optionalTexts(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 3) return undefined;
  const values = value.map((item) => text(item, 240));
  return values.every(Boolean) ? values as string[] : undefined;
}

/** Anti-corruption layer: validates the server contract before UI state changes. */
export function parseAiProposal(value: unknown): TaskPlanProposal | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const taskTitle = text(candidate.taskTitle, 500);
  const summary = text(candidate.summary, 500);
  const firstAction = text(candidate.firstAction, 500);
  if (!taskTitle || !summary || !firstAction || !Array.isArray(candidate.steps) || candidate.steps.length < 3 || candidate.steps.length > 7) return null;
  const steps: DecompositionStep[] = [];
  for (const entry of candidate.steps) {
    if (!entry || typeof entry !== 'object') return null;
    const step = entry as Record<string, unknown>;
    const title = text(step.title, 500);
    if (!title || typeof step.estimateMinutes !== 'number' || !estimates.has(step.estimateMinutes) || typeof step.energyLevel !== 'string' || !energies.has(step.energyLevel)) return null;
    steps.push({ title, estimateMinutes: step.estimateMinutes, energyLevel: step.energyLevel as DecompositionStep['energyLevel'] });
  }
  const provenance = candidate.provenance;
  if (!provenance || typeof provenance !== 'object') return null;
  const detail = provenance as Record<string, unknown>;
  const provider = text(detail.provider, 80); const model = text(detail.model, 160); const promptVersion = text(detail.promptVersion, 80);
  if (!provider || !model || !promptVersion || typeof detail.schemaVersion !== 'number') return null;
  return { taskTitle, summary, firstAction, steps, source: 'ai', assumptions: optionalTexts(candidate.assumptions), warnings: optionalTexts(candidate.warnings), provenance: { provider, model, promptVersion, schemaVersion: detail.schemaVersion } };
}

export function aiDecompositionPreviewEnabled() { return isFeatureEnabled('aiDecomposition'); }

export async function requestAiDecomposition(task: Pick<TodoItem, 'id' | 'title' | 'notes'>, consent: boolean): Promise<AiDecompositionResult> {
  if (!aiDecompositionPreviewEnabled()) return { kind: 'fallback', reason: 'disabled' };
  if (!consent) return { kind: 'fallback', reason: 'consent_required' };
  const session = await authProvider.getSession();
  if (!session?.accessToken) return { kind: 'fallback', reason: 'not_signed_in' };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ taskId: task.id, consent: true, consentVersion: aiPreviewConsentVersion }),
    });
    const body = await response.json().catch(() => null) as { proposal?: unknown; cache?: unknown } | null;
    if (!response.ok) return { kind: 'fallback', reason: failureFromStatus(response.status) };
    const proposal = parseAiProposal(body?.proposal);
    return proposal ? { kind: 'proposal', proposal, cache: body?.cache === 'hit' ? 'hit' : 'miss' } : { kind: 'fallback', reason: 'invalid_output' };
  } catch {
    return { kind: 'fallback', reason: 'provider_unavailable' };
  }
}
