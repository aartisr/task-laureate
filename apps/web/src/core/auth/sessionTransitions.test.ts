import { describe, expect, it } from 'vitest';
import { shouldReinitializeForAuthChange } from './sessionTransitions';

describe('shouldReinitializeForAuthChange', () => {
  it.each([
    [undefined, null, '/', false, 'initial event'],
    ['user-a', 'user-a', '/', false, 'token refresh for same user'],
    ['user-a', 'user-b', '/', true, 'account switch'],
    ['user-a', null, '/', true, 'sign out'],
    [null, 'user-a', '/', true, 'sign in'],
    [null, 'user-a', '/auth/callback', false, 'OAuth callback completion'],
  ] as const)('handles %s → %s during %s (%s)', (previous, next, pathname, expected, _description) => {
    expect(shouldReinitializeForAuthChange(previous, next, pathname)).toBe(expected);
  });
});
