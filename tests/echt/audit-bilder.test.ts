import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { findeBild, findeSerienBild } from '../../src/main/bilder';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';

// Erkundung: Welche Einträge bekommen kein Titelbild – und warum?
const ZIEL = join(__dirname, '../../test-results/audit');
const UA = 'Movue-Audit (+https://github.com/morogge/movue-linuxmint)';

describe('Titelbilder', () => {
  it('Stichprobe je Sender', async () => {
    mkdirSync(ZIEL, { recursive: true });
    const db = oeffneDb(join(mkdtempSync(join(tmpdir(), 'bild-')), 'i.db'));
    await importiere(await oeffneListe(await listenAdresse('voll', UA), UA), db);
    schliesseAufbau(db);
    const zeilen: Record<string, unknown>[] = [];
    for (const g of ['ARD', 'ZDF', '3sat', 'Arte']) {
      const stich = db
        .prepare(
          `SELECT id, gruppe, sender, thema, titel, website, serie_id FROM film
           WHERE gruppe = ? AND variante = 0 AND extra = 0 AND live = 0 ORDER BY random() LIMIT 60`
        )
        .all(g) as { id: number; gruppe: string; sender: string; thema: string; titel: string; website: string; serie_id: number | null }[];
      let ok = 0;
      for (const z of stich) {
        let bild: string | null = null;
        let fehler = '';
        try {
          bild = await findeBild(z.website);
        } catch (e) {
          fehler = String(e).slice(0, 120);
        }
        let status = '';
        if (!bild && /^https?:\/\//.test(z.website)) {
          try {
            const a = await fetch(z.website.replace(/^http:/, 'https:'), { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
            status = `${a.status} ${a.url.slice(0, 120)}`;
            void a.body?.cancel();
          } catch (e) {
            status = String(e).slice(0, 80);
          }
        }
        const serie = !bild && z.serie_id ? await findeSerienBild(z.website, 'serie').catch(() => null) : null;
        if (bild) ok++;
        zeilen.push({ ...z, bild, fehler, status, serie });
      }
      console.log(`BILDER ${g}: ${ok}/${stich.length} mit Bild`);
    }
    for (const z of zeilen.filter((x) => !x['bild']).slice(0, 80))
      console.log(`OHNE ${z['gruppe']} | ${z['sender']} | ${String(z['thema']).slice(0, 25)} | ${String(z['titel']).slice(0, 40)} | ${z['website']} | ${z['status']} | serie=${z['serie'] ? 'ja' : 'nein'} ${z['fehler']}`);
    writeFileSync(join(ZIEL, 'bilder.json'), JSON.stringify(zeilen, null, 1));
  }, 1_200_000);
});
