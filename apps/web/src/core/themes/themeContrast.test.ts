import { describe, expect, it } from 'vitest';
import { THEMES } from './themes';

function relativeLuminance(hex: string) {
  const channels = hex.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Expected a six-digit hex color, received ${hex}`);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('theme color contrast', () => {
  it.each(Object.values(THEMES))('%s keeps all text readable on every surface', (theme) => {
    const surfaces = Object.values(theme.colors.bg).filter((color) => color.startsWith('#'));
    for (const [name, color] of Object.entries(theme.colors.text)) {
      if (name === 'inverse' || name === 'onAction') continue;
      for (const surface of surfaces) {
        expect(contrast(color, surface), `${theme.label}: ${name} text on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(Object.values(THEMES))('%s keeps action controls readable in every state', (theme) => {
    for (const [name, color] of Object.entries(theme.colors.action)) {
      if (name === 'disabled') continue;
      expect(contrast(theme.colors.text.onAction, color), `${theme.label}: on-action text on ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(Object.values(THEMES))('%s keeps action colors readable as text on every surface', (theme) => {
    const surfaces = Object.values(theme.colors.bg).filter((color) => color.startsWith('#'));
    for (const [name, color] of Object.entries(theme.colors.action)) {
      if (name === 'disabled') continue;
      for (const surface of surfaces) {
        expect(contrast(color, surface), `${theme.label}: ${name} action text on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(Object.values(THEMES))('%s keeps status text readable on every surface', (theme) => {
    const surfaces = Object.values(theme.colors.bg).filter((color) => color.startsWith('#'));
    for (const [name, color] of Object.entries(theme.colors.status)) {
      for (const surface of surfaces) {
        expect(contrast(color, surface), `${theme.label}: ${name} status on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(Object.values(THEMES))('%s keeps mobile navigation readable in every state', (theme) => {
    const surface = theme.colors.bg.secondary;

    expect(contrast(theme.colors.text.primary, surface), `${theme.label}: mobile navigation primary text`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.text.secondary, surface), `${theme.label}: mobile navigation secondary text`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.action.primary, surface), `${theme.label}: mobile navigation section label`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.text.onAction, theme.colors.action.primary), `${theme.label}: mobile navigation active icon`).toBeGreaterThanOrEqual(4.5);
  });
});
