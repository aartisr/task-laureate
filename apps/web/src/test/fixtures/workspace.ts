import type { WorkspaceData } from '../../infrastructure/persistence/workspace';

/** Test-only workspace fixture. It is never imported by application code. */
export function createTestWorkspace(): WorkspaceData {
  return {
    lists: [{
      id: 'test-list', title: 'Test list', description: '', status: 'active', templateId: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null, deletedAt: null, completionPercent: 0, taskCount: 0, completedTaskCount: 0,
    }],
    tasks: [],
    activity: [],
    templates: [],
  };
}
