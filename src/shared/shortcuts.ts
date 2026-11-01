/**
 * Einzige Quelle für alle Tastenkürzel der App.
 * Die Hilfeseite „Tastenkürzel“ wird aus dieser Liste erzeugt – neue Kürzel nur hier eintragen.
 */

export type ShortcutId =
  | 'help'
  | 'search'
  | 'back'
  | 'fullscreen'
  | 'close'
  | 'abspielen'
  | 'zurueckspulen'
  | 'vorspulen'
  | 'lauter'
  | 'leiser'
  | 'stumm'
  | 'vollbild'
  | 'untertitel'
  | 'naechste';

/** Wo ein Kürzel gilt: überall in der App oder nur auf der Player-Seite */
export type Bereich = 'app' | 'player';

export const BEREICH_NAME: Record<Bereich, string> = { app: 'Überall', player: 'Im Player' };

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
  /** Standard: 'app' */
  bereich?: Bereich;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'help', keys: ['F1'], key: 'F1', description: 'Hilfe zum aktuellen Bildschirm öffnen' },
  { id: 'search', keys: ['Strg', 'K'], key: 'k', ctrl: true, description: 'Ins Suchfeld springen' },
  { id: 'back', keys: ['Alt', '←'], key: 'ArrowLeft', alt: true, description: 'Zurück zur vorigen Seite' },
  { id: 'fullscreen', keys: ['F11'], key: 'F11', description: 'Vollbild ein- oder ausschalten' },
  { id: 'close', keys: ['Esc'], key: 'Escape', description: 'Hilfe schließen bzw. Suchfeld leeren' },
  { id: 'abspielen', keys: ['Leertaste'], key: ' ', bereich: 'player', description: 'Abspielen / Pause' },
  { id: 'zurueckspulen', keys: ['←'], key: 'ArrowLeft', bereich: 'player', description: '10 Sekunden zurück' },
  { id: 'vorspulen', keys: ['→'], key: 'ArrowRight', bereich: 'player', description: '10 Sekunden vor' },
  { id: 'lauter', keys: ['↑'], key: 'ArrowUp', bereich: 'player', description: 'Lauter' },
  { id: 'leiser', keys: ['↓'], key: 'ArrowDown', bereich: 'player', description: 'Leiser' },
  { id: 'stumm', keys: ['M'], key: 'm', bereich: 'player', description: 'Ton aus / an' },
  { id: 'vollbild', keys: ['F'], key: 'f', bereich: 'player', description: 'Video im Vollbild / zurück' },
  { id: 'untertitel', keys: ['C'], key: 'c', bereich: 'player', description: 'Untertitel ein / aus' },
  { id: 'naechste', keys: ['N'], key: 'n', bereich: 'player', description: 'Nächste Folge' }
];

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export function matchShortcut(event: KeyLike, bereich: Bereich = 'app'): ShortcutId | null {
  const ctrl = event.ctrlKey || event.metaKey;
  for (const s of SHORTCUTS) {
    if ((s.bereich ?? 'app') !== bereich) continue;
    const sameKey = s.key.length === 1 ? s.key.toLowerCase() === event.key.toLowerCase() : s.key === event.key;
    if (sameKey && !!s.ctrl === ctrl && !!s.shift === event.shiftKey && !!s.alt === event.altKey) {
      return s.id;
    }
  }
  return null;
}
