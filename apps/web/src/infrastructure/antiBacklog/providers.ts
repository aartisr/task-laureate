import type { CalendarSyncProvider, TaskDecomposer } from '../../core/contracts/antiBacklog';
import { createTemplateProposal } from '../../core/domain/antiBacklog';

/** Default implementation: useful without an API key and safe in every environment. */
export class TemplateTaskDecomposer implements TaskDecomposer {
  async propose(task: { id: string; title: string; notes: string }) {
    return createTemplateProposal(task.title);
  }
}

/**
 * Explicitly rejects integrations until an OAuth-backed provider is configured.
 * This prevents UI code from fabricating a calendar success state.
 */
export class UnconfiguredCalendarProvider implements CalendarSyncProvider {
  async createOrUpdateTaskBlock(_input: { taskId: string; title: string; startsAt: string; durationMinutes: number }): Promise<{ externalEventId: string; revision: string }> {
    throw new Error('Calendar sync is not configured for this workspace.');
  }

  async disconnect() {
    // A no-op is safe because no remote authorization was established.
  }
}
