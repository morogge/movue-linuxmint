import type { Readable } from 'node:stream';
import { EintragsLeser, parseListenStand } from '../filmliste/eintrag';
import { FilmlistenParser } from '../filmliste/parser';
import { schreiber, schreibeMeta, type Db } from './datenbank';

export interface ImportErgebnis {
  /** Anzahl übernommener Sendungen (nur Sender, die Movue anzeigt) */
  anzahl: number;
  /** Erstellungszeit der Liste in ms (UTC) */
  stand: number | null;
}

const BLOCK = 5000;

/**
 * Liest eine Filmliste (entpackter JSON-Strom) und schreibt alle passenden Einträge in die Datenbank.
 * Schreibt blockweise in Transaktionen; vorhandene Einträge (gleiche Adresse) werden aktualisiert.
 */
export async function importiere(
  quelle: Readable,
  db: Db,
  onFortschritt?: (verarbeitet: number) => void
): Promise<ImportErgebnis> {
  const schreibe = schreiber(db);
  const leser = new EintragsLeser();
  let stand: number | null = null;
  let anzahl = 0;
  let verarbeitet = 0;
  let puffer: ReturnType<EintragsLeser['lies']>[] = [];

  const flush = db.transaction((eintraege: typeof puffer) => {
    for (const e of eintraege) if (e) schreibe(e);
  });

  const parser = new FilmlistenParser((key, werte) => {
    if (key === 'Filmliste') {
      // Erster Kopf: [Stand lokal, Stand UTC, Version, Programm, Prüfsumme]
      if (stand === null && werte.length >= 2) stand = parseListenStand(werte[1]);
      return;
    }
    if (key !== 'X') return;
    verarbeitet++;
    const e = leser.lies(werte);
    if (e) {
      puffer.push(e);
      anzahl++;
    }
  });

  for await (const chunk of quelle) {
    parser.push(chunk as Buffer);
    if (puffer.length >= BLOCK) {
      flush(puffer);
      puffer = [];
      onFortschritt?.(verarbeitet);
    }
  }
  parser.end();
  flush(puffer);
  onFortschritt?.(verarbeitet);

  if (stand !== null) schreibeMeta(db, 'stand', stand);
  return { anzahl, stand };
}
