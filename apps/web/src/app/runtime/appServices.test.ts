import { beforeEach, describe, expect, it } from 'vitest';
import { createTestWorkspace } from '../../test/fixtures/workspace';
import { appServices, resetWorkspaceForAuthChange } from './appServices';

describe('resetWorkspaceForAuthChange', () => {
  beforeEach(() => {
    resetWorkspaceForAuthChange();
  });

  it('clears both the old repository and every cached query immediately', async () => {
    await appServices.repository.importWorkspace(createTestWorkspace());
    appServices.queryClient.setQueryData(['dashboard'], { lists: ['stale account data'] });

    resetWorkspaceForAuthChange();

    await expect(appServices.repository.listLists()).resolves.toEqual([]);
    expect(appServices.queryClient.getQueryData(['dashboard'])).toBeUndefined();
  });
});
