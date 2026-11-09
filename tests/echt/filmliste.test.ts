import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { anzahl, auchBei, fassungen, filmNachId, folgen, genreAnzahlen, oeffneDb, reihe, schliesseAufbau, suche } from '../../src/main/index/datenbank';
import type { GenreId } from '../../src/shared/genres';
import { importiere } from '../../src/main/index/import';
import { frageTitelInfo } from '../../src/main/titelinfo';
import { fassungKern } from '../../src/shared/fassung';
import { findeSerienBild } from '../../src/main/bilder';
import { baueSerien, mitSerien, serieDetail, serienSuche, stoebern } from '../../src/main/index/serien';
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
      // Startseite: alle Reihen wie in der App
      const REIHEN: GenreId[] = ['film', 'krimi', 'doku', 'serie', 'wissen', 'geschichte', 'reise', 'kultur', 'comedy', 'unterhaltung', 'gesellschaft', 'ratgeber', 'kinder', 'sport'];
      const r0 = Date.now();
      const reihen = REIHEN.map((g) => ({ g, filme: reihe(lese, { genre: g }) }));
      const reihenMs = Date.now() - r0;
      console.log(`REIHEN ${reihenMs} ms für ${REIHEN.length} Reihen`);
      for (const { g, filme } of reihen) console.log(`REIHE ${g} (${filme.length}): ` + filme.slice(0, 8).map((f) => `${f.sender}/${f.titel.slice(0, 35)}`).join(' | '));
      const tatortFolgen = folgen(lese, tatort.treffer.find((f) => f.thema === 'Tatort') ?? tatort.treffer[0]);
      console.log(`FOLGEN Tatort: ${tatortFolgen.length}`);
      expect(reihenMs).toBeLessThan(3000);

      // Serien: Aufbau (noch einmal, zum Messen), Arten, Abfragezeiten
      const bau = baueSerien(lese);
      const arten = lese.prepare('SELECT art, COUNT(*) AS n, SUM(folgen) AS f FROM serie GROUP BY art').all();
      const s0 = Date.now();
      const mit = reihen.map(({ filme }) => mitSerien(lese, filme));
      const s1 = Date.now();
      const stoebernSerie = stoebern(lese, { genre: 'serie' });
      const stoebernKrimi = stoebern(lese, { genre: 'krimi' });
      const s2 = Date.now();
      const gefunden = serienSuche(lese, 'rosenheim');
      const s3 = Date.now();
      const iaf = serieDetail(lese, 'ARD', 'In aller Freundschaft');
      const s4 = Date.now();
      console.log(
        'SERIEN ' +
          JSON.stringify({
            aufbauMs: bau.ms,
            schritte: bau.schritte,
            serien: bau.serien,
            arten,
            mitSerienMs: s1 - s0,
            stoebernMs: Math.round((s2 - s1) / 2),
            sucheMs: s3 - s2,
            detailMs: s4 - s3,
            dbMB: Math.round(statSync(pfad).size / 1e6),
            serieGenre: stoebernSerie.gesamt,
            krimi: stoebernKrimi.gesamt,
            suche: gefunden.map((x) => `${x.gruppe}/${x.thema} (${x.art}, ${x.folgen})`),
            iaf: iaf ? { ...iaf.serie, bild: undefined, folgen: iaf.folgen.length, erste: iaf.folgen.slice(0, 3).map((f) => f.titel) } : null
          })
      );
      for (const r of mit) console.log('SERIENREIHE ' + r.slice(0, 10).map((f) => (f.serie ? `[${f.serie.thema} · ${f.serie.art} · ${f.serie.folgen}]` : f.titel.slice(0, 30))).join(' | '));
      console.log('SERIEN Krimi: ' + stoebernKrimi.eintraege.slice(0, 20).map((e) => (e.typ === 'serie' ? `[${e.serie.thema} ${e.serie.folgen}]` : e.film.titel.slice(0, 30))).join(' | '));
      const proben = lese.prepare(`SELECT gruppe, thema, art, folgen, staffeln, extras FROM serie ORDER BY folgen DESC LIMIT 40`).all();
      console.log('SERIEN groesste: ' + JSON.stringify(proben));
      const zufall = lese.prepare(`SELECT gruppe, thema, art, folgen, staffeln, extras FROM serie ORDER BY (id * 2654435761) % 1000003 LIMIT 40`).all();
      console.log('SERIEN zufall: ' + JSON.stringify(zufall));
      expect(bau.ms).toBeLessThan(20_000);

      // Titelinfos: dieselbe Sendung bei mehreren Sendern, Besetzung (ZDF/3sat), Serienbilder (ARD)
      const filme = lese
        .prepare(`SELECT id FROM film WHERE variante = 0 AND dauer >= 3600 ORDER BY (id * 2654435761) % 1000003 LIMIT 400`)
        .all() as { id: number }[];
      const a0 = Date.now();
      let mitAnderen = 0;
      const auchBeispiele: string[] = [];
      for (const { id } of filme) {
        const f = filmNachId(lese, id)!;
        const andere = auchBei(lese, f);
        if (andere.length) {
          mitAnderen++;
          if (auchBeispiele.length < 12) auchBeispiele.push(`${f.gruppe}: ${f.titel} → ${andere.map((x) => `${x.gruppe}: ${x.titel}`).join(', ')}`);
        }
      }
      console.log(`AUCHBEI ${mitAnderen}/${filme.length} in ${Math.round((Date.now() - a0) / filme.length)} ms je Film: ${auchBeispiele.join(' | ')}`);
      const mitSeite = lese
        .prepare(
          `SELECT f.website, f.gruppe FROM film f JOIN film_genre g ON g.film_id = f.id
           WHERE f.gruppe IN ('ZDF', '3sat') AND g.genre IN ('film', 'serie', 'krimi') AND f.variante = 0 ORDER BY (f.id * 2654435761) % 1000003 LIMIT 8`
        )
        .all() as { website: string; gruppe: string }[];
      for (const m of mitSeite) {
        const info = await frageTitelInfo(m.website).catch((e: unknown) => String(e));
        console.log(`BESETZUNG ${m.gruppe} ${m.website}: ${JSON.stringify(info).slice(0, 400)}`);
      }
      // Fassungen: wie viele ausgeblendet, Beispiele mit Auswahl
      const fz = lese.prepare('SELECT SUM(fassung) AS fassung, SUM(variante) AS versteckt FROM film').get();
      const mitFassung = lese.prepare('SELECT id FROM film WHERE variante = 1 ORDER BY (id * 2654435761) % 1000003 LIMIT 6').all() as { id: number }[];
      for (const { id } of mitFassung) {
        const v = filmNachId(lese, id)!;
        const standard = lese.prepare('SELECT id FROM film WHERE gruppe = ? AND thema = ? AND kern = ? AND fassung = 0 LIMIT 1').get(v.gruppe, v.thema, fassungKern(v.titel)) as { id: number } | undefined;
        const liste = standard ? fassungen(lese, filmNachId(lese, standard.id)!) : [];
        console.log(`FASSUNG ${v.titel} → ${liste.map((x) => `${x.name ?? 'Standard'}: ${x.film.titel}`).join(' | ')}`);
      }
      console.log('FASSUNGEN ' + JSON.stringify(fz));
      const arteSeiten = lese.prepare(`SELECT website FROM film WHERE gruppe = 'Arte' AND dauer > 3000 ORDER BY (id * 2654435761) % 1000003 LIMIT 4`).all() as { website: string }[];
      for (const a of arteSeiten) console.log(`ARTE-INFO ${a.website}: ${JSON.stringify(await frageTitelInfo(a.website).catch((e: unknown) => String(e))).slice(0, 400)}`);
      const zdfSerien = lese
        .prepare(`SELECT f.website FROM serie s JOIN film f ON f.id = s.film_id WHERE s.gruppe IN ('ZDF', '3sat') AND s.art = 'serie' ORDER BY s.folgen DESC LIMIT 6`)
        .all() as { website: string }[];
      for (const z of zdfSerien) console.log(`SERIENBILD-ZDF ${z.website}: ${await findeSerienBild(z.website, 'serie').catch(() => null)}`);
      const ardSerien = lese
        .prepare(`SELECT f.website FROM serie s JOIN film f ON f.id = s.film_id WHERE s.gruppe = 'ARD' AND s.art = 'serie' ORDER BY s.folgen DESC LIMIT 6`)
        .all() as { website: string }[];
      for (const s of ardSerien) {
        const [k, b] = await Promise.all([findeSerienBild(s.website, 'serie').catch(() => null), findeSerienBild(s.website, 'banner').catch(() => null)]);
        console.log(`SERIENBILD ${s.website}: ${k} | ${b}`);
      }
      expect(s2 - s1).toBeLessThan(2000);
      for (const { filme } of reihen) expect(filme.length).toBeGreaterThan(5);

      // Genre-Bericht: Abdeckung, häufigste nicht zugeordnete Themen, Stichproben je Genre
      const genres = genreAnzahlen(lese);
      const ohne = genres.find((g) => g.id === 'sonstiges')!.anzahl;
      console.log(`GENRES zugeordnet: ${(100 - (100 * ohne) / n).toFixed(1)} %`);
      console.log('GENRES je Genre: ' + genres.map((g) => `${g.id}=${g.anzahl}`).join(' '));
      const proFilm = lese.prepare('SELECT avg(c) AS a FROM (SELECT count(*) AS c FROM film_genre GROUP BY film_id)').get() as { a: number };
      console.log(`GENRES pro Sendung im Schnitt: ${proFilm.a.toFixed(2)}`);
      for (const g of GRUPPEN) {
        const offen = lese
          .prepare(
            `SELECT f.thema, count(*) AS n, min(f.titel) AS bsp FROM film_genre fg JOIN film f ON f.id = fg.film_id
             WHERE fg.genre = 'sonstiges' AND f.gruppe = ? GROUP BY f.thema ORDER BY n DESC LIMIT 45`
          )
          .all(g.id) as { thema: string; n: number; bsp: string }[];
        console.log(`OFFEN ${g.id}: ` + offen.map((o) => `${o.n}× ${o.thema} [${o.bsp.slice(0, 40)}]`).join(' | '));
      }
      for (const g of genres) {
        if (g.id === 'sonstiges') continue;
        const bsp = lese
          .prepare(
            `SELECT f.sender, f.thema, f.titel FROM film_genre fg JOIN film f ON f.id = fg.film_id
             WHERE fg.genre = ? ORDER BY (f.id * 2654435761) % 1000003 LIMIT 14`
          )
          .all(g.id) as { sender: string; thema: string; titel: string }[];
        console.log(`STICHPROBE ${g.id}: ` + bsp.map((b) => `${b.sender}/${b.thema.slice(0, 30)}/${b.titel.slice(0, 45)}`).join(' | '));
      }
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
