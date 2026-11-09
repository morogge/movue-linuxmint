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
          `SELECT id, gruppe, sender, thema, titel, website, serie_id, url, datum FROM film
           WHERE gruppe = ? AND variante = 0 AND extra = 0 AND live = 0 ORDER BY random() LIMIT 80`
        )
        .all(g) as { id: number; gruppe: string; sender: string; thema: string; titel: string; website: string; serie_id: number | null; url: string; datum: number }[];
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
        // Ist das Video selbst noch da?
        let video = '';
        if (!bild) {
          try {
            const v = await fetch(z.url.replace(/^http:/, 'https:'), { headers: { 'User-Agent': UA, Range: 'bytes=0-1023' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
            video = String(v.status);
            void v.body?.cancel();
          } catch (e) {
            video = 'fehler';
          }
        }
        const alter = Math.floor((Date.now() / 1000 - z.datum) / 86_400);
        const serie = !bild && z.serie_id ? await findeSerienBild(z.website, 'serie').catch(() => null) : null;
        if (bild) ok++;
        zeilen.push({ ...z, bild, fehler, status, serie, video, alter });
      }
      const jung = zeilen.filter((x) => x['gruppe'] === g && (x['alter'] as number) <= 60);
      const ohneJung = jung.filter((x) => !x['bild']);
      const ohne = zeilen.filter((x) => x['gruppe'] === g && !x['bild']);
      console.log(
        `BILDER ${g}: ${ok}/${stich.length} mit Bild; bis 60 Tage alt: ${jung.length - ohneJung.length}/${jung.length} mit Bild; ohne Bild: Video da ${ohne.filter((x) => /^2/.test(String(x['video']))).length}/${ohne.length}, Serienbild ${ohne.filter((x) => x['serie']).length}`
      );
    }
    for (const z of zeilen.filter((x) => !x['bild'] && (x['alter'] as number) <= 60).slice(0, 60))
      console.log(`JUNG-OHNE video=${z['video']} alter=${z['alter']} | ${z['gruppe']} | ${z['sender']} | ${String(z['thema']).slice(0, 25)} | ${String(z['titel']).slice(0, 40)} | ${z['website']} | ${z['status']} | serie=${z['serie'] ? 'ja' : 'nein'} ${z['fehler']}`);
    for (const z of [].slice(0, 0))
      console.log(`OHNE ${z['gruppe']} | ${z['sender']} | ${String(z['thema']).slice(0, 25)} | ${String(z['titel']).slice(0, 40)} | ${z['website']} | ${z['status']} | serie=${z['serie'] ? 'ja' : 'nein'} ${z['fehler']}`);
    writeFileSync(join(ZIEL, 'bilder.json'), JSON.stringify(zeilen, null, 1));
  }, 1_200_000);
});
