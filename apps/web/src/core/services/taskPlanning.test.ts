import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { createEmptyWorkspace } from '../../infrastructure/persistence/workspace';
import { createTaskPlanningService } from './taskPlanning';

afterEach(() => window.localStorage.clear());

describe('task planning service', () => {
  it('uses a durable local fallback without leaking persistence details into callers', async () => {
    const service = createTaskPlanningService(createMemoryTodoRepository(createEmptyWorkspace()));
    await service.save('task-1', { estimateMinutes: 25, energyLevel: 'deep', scheduledStartAt: null, parentTaskId: null });
    await expect(service.get('task-1')).resolves.toMatchObject({ estimateMinutes: 25, energyLevel: 'deep', needsClarity: false });
  });
});
