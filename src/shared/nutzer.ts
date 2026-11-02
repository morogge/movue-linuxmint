import type { Film } from './film';
import type { SenderGruppe } from './sender';

/** Wie lange ein Video noch abrufbar ist. `bis` in ms (UTC), null = kein Ende bekannt. */
export interface Ablauf {
  bis: number | null;
  /** Die Sendungsseite gibt es beim Sender nicht mehr */
  weg: boolean;
}

export interface MerkEintrag {
  /** Bei Sendungen, die nicht mehr im Verzeichnis sind, die beim Merken gespeicherte Fassung */
  film: Film;
  zeit: number;
  /** Noch im Sendungsverzeichnis */
  verfuegbar: boolean;
  ablauf: Ablauf | null;
}

export interface Abo {
  gruppe: SenderGruppe;
  thema: string;
  /** Abonniert seit (ms) */
  seit: number;
  anzahl: number;
  /** Folgen, die seit dem letzten Besuch dazugekommen sind */
  neu: number;
  neueste: Film | null;
}

/** Ab diesem Anteil gilt eine Folge als gesehen */
export const GESEHEN_ANTEIL = 0.95;

/** Ab so vielen Tagen vor dem Ende gilt ein Video als „läuft bald ab“ */
export const BALD_TAGE = 14;
const TAG = 86_400_000;

export function laeuftBaldAb(ablauf: Ablauf | null | undefined, jetzt = Date.now()): boolean {
  if (!ablauf || ablauf.weg || ablauf.bis === null) return false;
  return ablauf.bis >= jetzt && ablauf.bis - jetzt <= BALD_TAGE * TAG;
}

function datum(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** „nur noch heute“, „noch 3 Tage“, „bis 30.11.2026“ – null, wenn nichts zu sagen ist */
export function formatAblauf(ablauf: Ablauf | null | undefined, jetzt = Date.now()): string | null {
  if (!ablauf) return null;
  if (ablauf.weg) return 'nicht mehr verfügbar';
  if (ablauf.bis === null) return null;
  if (ablauf.bis < jetzt) return 'abgelaufen';
  const ende = new Date(ablauf.bis);
  const heute = new Date(jetzt);
  const tage = Math.round(
    (new Date(ende.getFullYear(), ende.getMonth(), ende.getDate()).getTime() -
      new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()).getTime()) /
      TAG
  );
  if (tage <= 0) return 'nur noch heute';
  if (tage === 1) return 'nur noch bis morgen';
  if (tage <= BALD_TAGE) return `noch ${tage} Tage`;
  return `bis ${datum(ablauf.bis)}`;
}

/** Text für die Benachrichtigung über neue Folgen */
export function aboMeldung(neue: { thema: string; neu: number }[]): { titel: string; text: string } | null {
  const liste = neue.filter((n) => n.neu > 0);
  if (liste.length === 0) return null;
  const folgen = (n: number) => (n === 1 ? '1 neue Folge' : `${n} neue Folgen`);
  if (liste.length === 1) return { titel: `${folgen(liste[0].neu)}: ${liste[0].thema}`, text: 'Jetzt in deiner Merkliste unter „Abos“.' };
  const summe = liste.reduce((s, n) => s + n.neu, 0);
  const namen = liste.slice(0, 3).map((n) => n.thema).join(', ') + (liste.length > 3 ? ` und ${liste.length - 3} weitere` : '');
  return { titel: `${folgen(summe)} in deinen Abos`, text: namen };
}
