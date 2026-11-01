/**
 * Läuft in einem eigenen Thread: lädt eine Filmliste und schreibt sie in die Datenbank,
 * damit der Hauptprozess (und damit die Oberfläche) nicht blockiert.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { listenAdresse, oeffneListe, type ListenArt } from '../filmliste/quelle';
import { anzahl, oeffneDb, schliesseAufbau, schreibeMeta, SCHEMA_VERSION } from './datenbank';
import { importiere } from './import';

export interface IndexerAuftrag {
  art: ListenArt;
  /** Ziel: beim vollen Import eine frische Datei, beim Diff die bestehende Datenbank */
  dbPfad: string;
  userAgent: string;
}

export type IndexerNachricht =
  | { typ: 'fortschritt'; verarbeitet: number }
  | { typ: 'fertig'; anzahl: number; stand: number | null }
  | { typ: 'fehler'; meldung: string };

function sende(n: IndexerNachricht): void {
  parentPort?.postMessage(n);
}

async function lauf(auftrag: IndexerAuftrag): Promise<void> {
  const voll = auftrag.art === 'voll';
  const db = oeffneDb(auftrag.dbPfad, { schnellaufbau: voll });
  try {
    const adresse = await listenAdresse(auftrag.art, auftrag.userAgent);
    const quelle = await oeffneListe(adresse, auftrag.userAgent);
    const ergebnis = await importiere(quelle, db, (verarbeitet) => sende({ typ: 'fortschritt', verarbeitet }));
    const jetzt = Date.now();
    if (voll) {
      schliesseAufbau(db);
      schreibeMeta(db, 'vollGeladen', jetzt);
      schreibeMeta(db, 'schema', SCHEMA_VERSION);
    } else {
      schreibeMeta(db, 'diffGeladen', jetzt);
    }
    sende({ typ: 'fertig', anzahl: anzahl(db), stand: ergebnis.stand });
  } finally {
    db.close();
  }
}

lauf(workerData as IndexerAuftrag).catch((err: unknown) => {
  sende({ typ: 'fehler', meldung: err instanceof Error ? err.message : String(err) });
});
