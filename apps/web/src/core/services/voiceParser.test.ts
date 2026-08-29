import { describe, it, expect } from 'vitest';
import { parseVoiceCommand } from './voiceParser';

describe('voiceParser', () => {
  it('parses simple task addition without list', () => {
    const result = parseVoiceCommand('Add buy milk');
    expect(result.taskTitle).toBe('Buy milk');
    expect(result.listName).toBeUndefined();
    expect(result.isNewListCreation).toBe(false);
  });

  it('parses task addition to an existing list using "to"', () => {
    const result = parseVoiceCommand('Add review contract to Legal');
    expect(result.taskTitle).toBe('Review contract');
    expect(result.listName).toBe('Legal');
    expect(result.isNewListCreation).toBe(false);
  });

  it('parses task addition to list using "in"', () => {
    const result = parseVoiceCommand('buy groceries in Shopping list');
    expect(result.taskTitle).toBe('Buy groceries');
    expect(result.listName).toBe('Shopping list');
  });

  it('parses new list creation with task', () => {
    const result = parseVoiceCommand('create list Fitness with task Morning run');
    expect(result.taskTitle).toBe('Morning run');
    expect(result.listName).toBe('Fitness');
    expect(result.isNewListCreation).toBe(true);
  });

  it('handles empty or raw fallback gracefully', () => {
    const result = parseVoiceCommand('   ');
    expect(result.taskTitle).toBe('   ');
  });
});
