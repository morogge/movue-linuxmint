/** Zustand der automatischen Aktualisierung der App. */
export type UpdateZustand =
  | { phase: 'aus' }
  | { phase: 'pruefe' }
  | { phase: 'aktuell' }
  | { phase: 'laedt'; version: string; prozent: number }
  | { phase: 'bereit'; version: string }
  /** Automatisches Installieren nicht möglich – Nutzer lädt selbst herunter */
  | { phase: 'manuell'; version: string; url: string };

export const RELEASES_URL = 'https://github.com/morogge/movue-linuxmint/releases';

/** Soll nach dem Start „Was ist neu“ erscheinen? Nur nach einem echten Versionswechsel. */
export function zeigeWasIstNeu(zuletztGesehen: string | null, aktuell: string): boolean {
  return zuletztGesehen !== null && zuletztGesehen !== '' && zuletztGesehen !== aktuell;
}
