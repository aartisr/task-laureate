import { describe, expect, it } from 'vitest';
import { parseAiProposal } from './aiDecomposition';

const valid = {
  taskTitle: 'Write a research paper',
  summary: 'Create a small, reviewable first draft.',
  firstAction: 'List the three questions the paper must answer.',
  steps: [
    { title: 'List the questions the paper must answer', estimateMinutes: 10, energyLevel: 'quick' },
    { title: 'Collect the most relevant sources', estimateMinutes: 30, energyLevel: 'light' },
    { title: 'Draft the argument and evidence', estimateMinutes: 45, energyLevel: 'deep' },
  ],
  assumptions: ['The topic is already selected.'], warnings: [],
  provenance: { provider: 'gemini', model: 'pinned-model', promptVersion: 'task-decomposition.v1', schemaVersion: 1 },
};

describe('AI decomposition response boundary', () => {
  it('accepts only a bounded, canonical proposal', () => {
    expect(parseAiProposal(valid)).toMatchObject({ source: 'ai', steps: valid.steps, provenance: valid.provenance });
  });

  it('rejects malformed provider responses before they reach the UI', () => {
    expect(parseAiProposal({ ...valid, steps: [{ ...valid.steps[0], estimateMinutes: 999 }] })).toBeNull();
    expect(parseAiProposal({ ...valid, provenance: undefined })).toBeNull();
    expect(parseAiProposal({ ...valid, steps: valid.steps.slice(0, 2) })).toBeNull();
  });
});
