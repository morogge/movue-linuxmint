import type { ListenArt } from '../filmliste/quelle';

export const STUNDE = 60 * 60 * 1000;

/** Komplette Liste spätestens nach 24 Stunden, dazwischen höchstens stündlich die Diff-Liste. */
export const VOLL_INTERVALL = 24 * STUNDE;
export const DIFF_INTERVALL = STUNDE;

export interface LadeStand {
  /** Index vorhanden? */
  vorhanden: boolean;
  /** Stammt der Index von der aktuellen Programmversion (Tabellen, Genre-Regeln)? */
  schemaAktuell?: boolean;
  /** Zeitpunkt (ms) des letzten vollständigen Imports */
  vollGeladen: number | null;
  /** Zeitpunkt (ms) des letzten Diff-Imports */
  diffGeladen: number | null;
}

/** Entscheidet, welche Liste jetzt geladen werden soll – oder ob nichts zu tun ist. */
export function naechsteAktion(stand: LadeStand, jetzt: number): ListenArt | null {
  if (!stand.vorhanden || stand.vollGeladen === null || stand.schemaAktuell === false) return 'voll';
  if (jetzt - stand.vollGeladen >= VOLL_INTERVALL) return 'voll';
  const zuletzt = Math.max(stand.vollGeladen, stand.diffGeladen ?? 0);
  if (jetzt - zuletzt >= DIFF_INTERVALL) return 'diff';
  return null;
}
