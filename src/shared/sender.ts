/**
 * Sendergruppen der App und Zuordnung der Sendernamen aus der MediathekView-Filmliste.
 * Die ARD-Mediathek erscheint in der Filmliste aufgeteilt auf ihre Landesrundfunkanstalten.
 */

export type SenderGruppe = 'ARD' | 'ZDF' | '3sat' | 'Arte';

export const GRUPPEN: readonly { id: SenderGruppe; name: string }[] = [
  { id: 'ARD', name: 'ARD Mediathek' },
  { id: 'ZDF', name: 'ZDF Mediathek' },
  { id: '3sat', name: '3sat Mediathek' },
  { id: 'Arte', name: 'Arte Mediathek' }
];

const ZUORDNUNG: Readonly<Record<string, SenderGruppe>> = {
  ARD: 'ARD',
  'ARD-alpha': 'ARD',
  BR: 'ARD',
  HR: 'ARD',
  MDR: 'ARD',
  NDR: 'ARD',
  ONE: 'ARD',
  RBB: 'ARD',
  'Radio Bremen TV': 'ARD',
  rbtv: 'ARD',
  RBTV: 'ARD',
  SR: 'ARD',
  SWR: 'ARD',
  tagesschau24: 'ARD',
  WDR: 'ARD',
  ZDF: 'ZDF',
  ZDFinfo: 'ZDF',
  ZDFneo: 'ZDF',
  'ZDF-tivi': 'ZDF',
  '3Sat': '3sat',
  'ARTE.DE': 'Arte'
};

/** Gruppe zu einem Sendernamen der Filmliste; null für Sender, die Movue nicht anzeigt. */
export function gruppeFuer(sender: string): SenderGruppe | null {
  return ZUORDNUNG[sender] ?? null;
}

export function istGruppe(wert: unknown): wert is SenderGruppe {
  return GRUPPEN.some((g) => g.id === wert);
}
