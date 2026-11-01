/**
 * Alle Bildschirme der App und die Hilfeseite, die F1 bzw. „?“ dort öffnet.
 * Jeder neue Bildschirm braucht einen Eintrag – ein Unit-Test prüft, dass die Hilfeseite existiert.
 */

export const SCREENS = {
  start: { title: 'Start', help: 'erste-schritte' },
  suche: { title: 'Suche', help: 'suchen' },
  genres: { title: 'Genres', help: 'genres' }
} as const;

export type ScreenId = keyof typeof SCREENS;
