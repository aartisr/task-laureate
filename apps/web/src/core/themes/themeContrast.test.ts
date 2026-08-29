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

function mixSrgb(first: string, second: string, firstWeight: number) {
  const firstChannels = first.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16));
  const secondChannels = second.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16));
  if (!firstChannels || !secondChannels) throw new Error('Expected six-digit hex colors');
  const secondWeight = 1 - firstWeight;
  return `#${firstChannels.map((channel, index) => Math.round(channel * firstWeight + secondChannels[index] * secondWeight).toString(16).padStart(2, '0')).join('')}`;
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

  it.each(Object.values(THEMES))('%s keeps quiet action controls readable in every state', (theme) => {
    const quiet = theme.colors.control.quiet;

    expect(contrast(quiet.foreground, quiet.background), `${theme.label}: quiet action default`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(quiet.foreground, quiet.hoverBackground), `${theme.label}: quiet action hover`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.values(THEMES))('%s keeps primary button text readable across its premium gradient', (theme) => {
    const gradientEnd = mixSrgb(theme.colors.action.primary, theme.colors.accent.secondary, 0.72);
    expect(contrast(theme.colors.text.onAction, gradientEnd), `${theme.label}: on-action text on primary-button gradient`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.values(THEMES))('%s keeps status-backed controls readable', (theme) => {
    for (const [name, color] of Object.entries(theme.colors.status)) {
      expect(contrast(theme.colors.text.onAction, color), `${theme.label}: on-action text on ${name} status`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(Object.values(THEMES))('%s keeps list-management menu actions readable', (theme) => {
    const archiveSurface = mixSrgb(theme.colors.action.primary, theme.colors.bg.secondary, 0.12);
    const deleteSurface = mixSrgb(theme.colors.status.error, theme.colors.bg.secondary, 0.12);

    expect(contrast(theme.colors.text.primary, archiveSurface), `${theme.label}: archive action in list menu`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.text.primary, deleteSurface), `${theme.label}: delete action in list menu`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.text.onAction, theme.colors.status.error), `${theme.label}: delete confirmation in list menu`).toBeGreaterThanOrEqual(4.5);
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
