/**
 * Alle Bildschirme der App und die Hilfeseite, die F1 bzw. „?“ dort öffnet.
 * Jeder neue Bildschirm braucht einen Eintrag – ein Unit-Test prüft, dass die Hilfeseite existiert.
 */

export const SCREENS = {
  start: { title: 'Start', help: 'stoebern' },
  suche: { title: 'Suche', help: 'suchen' },
  genres: { title: 'Genres', help: 'genres' },
  sender: { title: 'Sender', help: 'stoebern' },
  detail: { title: 'Sendung', help: 'stoebern' },
  serie: { title: 'Serie', help: 'serien' },
  player: { title: 'Player', help: 'player' },
  merkliste: { title: 'Merkliste', help: 'merkliste' },
  ablauf: { title: 'Läuft bald ab', help: 'merkliste' }
} as const;

export type ScreenId = keyof typeof SCREENS;

export function istScreen(x: unknown): x is ScreenId {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(SCREENS, x);
}
