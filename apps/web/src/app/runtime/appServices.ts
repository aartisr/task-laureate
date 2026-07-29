import { QueryClient } from '@tanstack/react-query';
import { createFeatureRegistry } from '../../core/registry/featureRegistry';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { activityFeature } from '../../features/activity/feature';
import { listFeature } from '../../features/lists/feature';
import { searchFeature } from '../../features/search/feature';
import { settingsFeature } from '../../features/settings/feature';
import { taskFeature } from '../../features/tasks/feature';
import { seedData } from '../../infrastructure/mock/seed';

export const appServices = {
  repository: createMemoryTodoRepository(seedData),
  queryClient: new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  }),
  registry: createFeatureRegistry([
    listFeature,
    taskFeature,
    searchFeature,
    activityFeature,
    settingsFeature,
  ]),
};
