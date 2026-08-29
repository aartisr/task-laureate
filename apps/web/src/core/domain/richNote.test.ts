import { describe, expect, it } from 'vitest';
import { noteOutline, notePreview, noteToPlainText, sanitizeNoteHtml } from './richNote';

describe('rich notes', () => {
  it('removes executable markup and unsafe URLs', () => {
    const safe = sanitizeNoteHtml('<h2 onclick="alert(1)">Plan</h2><img src=x onerror="alert(1)"><a href="javascript:alert(1)">bad</a><svg><img onerror="alert(1)"></svg>');
    expect(safe).toContain('<h2>Plan</h2>');
    expect(safe).not.toContain('onclick');
    expect(safe).not.toContain('onerror');
    expect(safe).not.toContain('javascript:');
  });

  it('derives accessible previews and outlines from rich content', () => {
    const note = '<h2>Objective</h2><p>Ship a clear reader experience for everyone.</p><h3>Risks</h3>';
    expect(noteToPlainText(note)).toContain('Ship a clear reader experience');
    expect(notePreview(note, 15)).toBe('Objective Ship…');
    expect(noteOutline(note).map((heading) => heading.text)).toEqual(['Objective', 'Risks']);
  });
});
