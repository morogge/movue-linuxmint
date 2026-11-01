import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { anzahl, oeffneDb, schliesseAufbau, suche } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { GRUPPEN } from '../../src/shared/sender';

const UA = 'Movue-CI (+https://github.com/morogge/movue-linuxmint)';

describe('Echte Filmliste', () => {
  it('lässt sich vollständig importieren und durchsuchen', async () => {
    const ordner = mkdtempSync(join(tmpdir(), 'movue-echt-'));
    const pfad = join(ordner, 'index.db');
    try {
      const t0 = Date.now();
      const db = oeffneDb(pfad, { schnellaufbau: true });
      let verarbeitet = 0;
      const adresse = await listenAdresse('voll', UA);
      const ergebnis = await importiere(await oeffneListe(adresse, UA), db, (n) => (verarbeitet = n));
      const t1 = Date.now();
      schliesseAufbau(db);
      const t2 = Date.now();
      db.close();

      const lese = oeffneDb(pfad);
      const n = anzahl(lese);
      const proGruppe = Object.fromEntries(GRUPPEN.map((g) => [g.id, suche(lese, { text: '', gruppe: g.id, limit: 1 }).gesamt]));
      const t3 = Date.now();
      const tatort = suche(lese, { text: 'tatort' });
      const terra = suche(lese, { text: 'terra x', gruppe: 'ZDF' });
      const t4 = Date.now();

      console.log(
        JSON.stringify(
          {
            adresse,
            eintraegeGelesen: verarbeitet,
            uebernommen: n,
            proGruppe,
            stand: ergebnis.stand ? new Date(ergebnis.stand).toISOString() : null,
            importSekunden: (t1 - t0) / 1000,
            volltextSekunden: (t2 - t1) / 1000,
            dbMB: Math.round(statSync(pfad).size / 1e6),
            sucheMs: Math.round((t4 - t3) / 2),
            tatort: { gesamt: tatort.gesamt, erste: tatort.treffer.slice(0, 5).map((f) => `${f.sender}: ${f.titel}`) },
            terraX: terra.gesamt
          },
          null,
          2
        )
      );
      lese.close();

      expect(verarbeitet).toBeGreaterThan(300_000);
      expect(n).toBeGreaterThan(200_000);
      for (const g of GRUPPEN) expect(proGruppe[g.id]).toBeGreaterThan(1000);
      expect(tatort.treffer.some((f) => f.gruppe === 'ARD')).toBe(true);
      expect(terra.gesamt).toBeGreaterThan(0);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });
});
