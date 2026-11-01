/**
 * Einzige Quelle für alle Tastenkürzel der App.
 * Die Hilfeseite „Tastenkürzel“ wird aus dieser Liste erzeugt – neue Kürzel nur hier eintragen.
 */

export type ShortcutId = 'help' | 'fullscreen' | 'close';

export interface Shortcut {
  id: ShortcutId;
  /** Anzeige in der Hilfe, z. B. ["Strg", "K"] */
  keys: string[];
  description: string;
  /** KeyboardEvent.key, das das Kürzel auslöst */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'help', keys: ['F1'], key: 'F1', description: 'Hilfe zum aktuellen Bildschirm öffnen' },
  { id: 'fullscreen', keys: ['F11'], key: 'F11', description: 'Vollbild ein- oder ausschalten' },
  { id: 'close', keys: ['Esc'], key: 'Escape', description: 'Hilfe schließen' }
];

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export function matchShortcut(event: KeyLike): ShortcutId | null {
  const ctrl = event.ctrlKey || event.metaKey;
  for (const s of SHORTCUTS) {
    const sameKey = s.key.length === 1 ? s.key.toLowerCase() === event.key.toLowerCase() : s.key === event.key;
    if (sameKey && !!s.ctrl === ctrl && !!s.shift === event.shiftKey && !!s.alt === event.altKey) {
      return s.id;
    }
  }
  return null;
}
