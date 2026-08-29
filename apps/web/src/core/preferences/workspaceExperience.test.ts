import { beforeEach, describe, expect, it } from 'vitest';
import { getWorkspaceExperience, setWorkspaceExperience, toggleWorkspaceExperience } from './workspaceExperience';

describe('workspace experience preference', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Focus Mode without a stored preference', () => {
    expect(getWorkspaceExperience()).toBe('focus');
  });

  it('persists and toggles the presentation preference', () => {
    setWorkspaceExperience('workspace');
    expect(getWorkspaceExperience()).toBe('workspace');
    toggleWorkspaceExperience();
    expect(getWorkspaceExperience()).toBe('focus');
    expect(localStorage.getItem('task-laureate.workspace-experience')).toBe('focus');
  });

  it('treats unknown stored values as the safe Focus default', () => {
    localStorage.setItem('task-laureate.workspace-experience', 'unknown');
    expect(getWorkspaceExperience()).toBe('focus');
  });
});