import { describe, expect, it } from 'vitest';
import { canManageTaskReminders } from './TaskFocusPage';

describe('task-focus reminder access', () => {
  it('keeps collaborator requests available to the owner in the focused task view', () => {
    expect(canManageTaskReminders(true, 'owner')).toBe(true);
    expect(canManageTaskReminders(false, undefined)).toBe(true);
  });

  it('does not expose outbound reminder controls to editors or viewers', () => {
    expect(canManageTaskReminders(true, 'editor')).toBe(false);
    expect(canManageTaskReminders(true, 'viewer')).toBe(false);
    expect(canManageTaskReminders(true, null)).toBe(false);
  });
});
