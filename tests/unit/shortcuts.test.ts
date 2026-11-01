import { describe, expect, it } from 'vitest';
import { matchShortcut, SHORTCUTS } from '@shared/shortcuts';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...mods
});

describe('Tastenkürzel', () => {
  it('erkennt F1, F11 und Esc', () => {
    expect(matchShortcut(key('F1'))).toBe('help');
    expect(matchShortcut(key('F11'))).toBe('fullscreen');
    expect(matchShortcut(key('Escape'))).toBe('close');
  });

  it('ignoriert Kürzel mit falschen Zusatztasten', () => {
    expect(matchShortcut(key('F1', { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key('a'))).toBeNull();
  });

  it('hat eindeutige ids und Beschreibungen für die Hilfe', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHORTCUTS) {
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
});
