import { createWriteStream, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { leseMeta, oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { bestimmeGenres } from '../../src/main/genre/regeln';

const UA = 'Movue-CI (+https://github.com/morogge/movue-linuxmint)';
const ZIEL = join(process.cwd(), 'test-results', 'audit');

/**
 * Audit der Klassifizierung: schreibt die komplette echte Liste mit Genres und Bündeln als Dump nach
 * test-results/audit/ (Artefakt der Action „Echtdaten“). Ändert nichts an der Zuordnung, prüft nichts hart.
 */

function csvFeld(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function schreibeGz(pfad: string, zeilen: Iterable<string>): Promise<void> {
  const gz = createGzip({ level: 6 });
  const aus = createWriteStream(pfad);
  gz.pipe(aus);
  for (const z of zeilen) {
    if (!gz.write(z)) await once(gz, 'drain');
  }
  gz.end();
  await once(aus, 'finish');
}

describe('Audit der Klassifizierung', () => {
  it('schreibt Dumps aller Sendungen und Bündel', async () => {
    const ordner = mkdtempSync(join(tmpdir(), 'movue-audit-'));
    mkdirSync(ZIEL, { recursive: true });
    try {
      const db = oeffneDb(join(ordner, 'index.db'), { schnellaufbau: true });
      await importiere(await oeffneListe(await listenAdresse('voll', UA), UA), db);
      schliesseAufbau(db);

      const genresJeFilm = new Map<number, string[]>();
      for (const g of db.prepare('SELECT film_id, genre FROM film_genre').iterate() as Iterable<{ film_id: number; genre: string }>) {
        const l = genresJeFilm.get(g.film_id);
        if (l) l.push(g.genre);
        else genresJeFilm.set(g.film_id, [g.genre]);
      }
      const serien = db.prepare('SELECT id, gruppe, thema, art, folgen, extras, staffeln, neueste FROM serie').all() as {
        id: number;
        gruppe: string;
        thema: string;
        art: string;
        folgen: number;
        extras: number;
        staffeln: number;
        neueste: number;
      }[];
      const serieGenres = new Map<number, string[]>();
      for (const g of db.prepare('SELECT serie_id, genre FROM serie_genre').all() as { serie_id: number; genre: string }[]) {
        serieGenres.set(g.serie_id, [...(serieGenres.get(g.serie_id) ?? []), g.genre]);
      }
      const serieNachId = new Map(serien.map((s) => [s.id, s]));

      const zeilen = db
        .prepare(
          `SELECT id, sender, gruppe, thema, titel, datum, dauer, beschreibung, website, url, url_hd, geo, variante, fassung,
                  staffel, folge, extra, serie_id, buendel, reihe_titel FROM film`
        )
        .all() as {
        id: number;
        sender: string;
        gruppe: string;
        thema: string;
        titel: string;
        datum: number;
        dauer: number;
        beschreibung: string;
        website: string;
        url: string;
        url_hd: string;
        geo: string;
        variante: number;
        fassung: number;
        staffel: number | null;
        folge: number | null;
        extra: number;
        serie_id: number | null;
        buendel: string | null;
        reihe_titel: string | null;
      }[];

      const spalten = [
        'id', 'gruppe', 'sender', 'thema', 'titel', 'datum', 'dauer', 'genres', 'genres_roh', 'serie', 'serie_art', 'buendel',
        'extra', 'variante', 'fassung', 'staffel', 'folge', 'website', 'url', 'beschreibung'
      ];
      const datensaetze = zeilen.map((z) => {
        const s = z.serie_id !== null ? serieNachId.get(z.serie_id) : undefined;
        return {
          id: z.id,
          gruppe: z.gruppe,
          sender: z.sender,
          thema: z.thema,
          titel: z.titel,
          datum: z.datum,
          dauer: z.dauer,
          // endgültige Genres (nach Angleichung ans Bündel) und die Rohgenres aus den Regeln
          genres: (genresJeFilm.get(z.id) ?? []).sort().join('|'),
          genres_roh: bestimmeGenres(z).sort().join('|'),
          serie: s?.thema ?? '',
          serie_art: s?.art ?? '',
          buendel: z.buendel ?? '',
          extra: z.extra,
          variante: z.variante,
          fassung: z.fassung,
          staffel: z.staffel ?? '',
          folge: z.folge ?? '',
          website: z.website,
          url: z.url,
          beschreibung: z.beschreibung.slice(0, 200)
        };
      });

      await schreibeGz(
        join(ZIEL, 'filme.jsonl.gz'),
        (function* () {
          for (const d of datensaetze) yield JSON.stringify(d) + '\n';
        })()
      );
      await schreibeGz(
        join(ZIEL, 'filme.csv.gz'),
        (function* () {
          yield spalten.join(';') + '\n';
          for (const d of datensaetze) yield spalten.map((k) => csvFeld((d as Record<string, unknown>)[k])).join(';') + '\n';
        })()
      );

      // Bündel mit Beispieltiteln
      const beispiele = db.prepare(`SELECT titel FROM film WHERE serie_id = ? AND variante = 0 ORDER BY datum DESC LIMIT 5`);
      const themen = db.prepare(`SELECT thema, COUNT(*) AS n FROM film WHERE serie_id = ? GROUP BY thema ORDER BY n DESC LIMIT 5`);
      const buendel = serien.map((s) => ({
        id: s.id,
        gruppe: s.gruppe,
        thema: s.thema,
        art: s.art,
        folgen: s.folgen,
        extras: s.extras,
        staffeln: s.staffeln,
        neueste: s.neueste,
        genres: (serieGenres.get(s.id) ?? []).sort().join('|'),
        quellthemen: (themen.all(s.id) as { thema: string; n: number }[]).map((t) => `${t.thema} (${t.n})`).join(' | '),
        beispiele: (beispiele.all(s.id) as { titel: string }[]).map((t) => t.titel).join(' | ')
      }));
      writeFileSync(join(ZIEL, 'buendel.json'), JSON.stringify(buendel));
      const bSpalten = Object.keys(buendel[0] ?? { id: 0 });
      writeFileSync(
        join(ZIEL, 'buendel.csv'),
        [bSpalten.join(';'), ...buendel.map((b) => bSpalten.map((k) => csvFeld((b as Record<string, unknown>)[k])).join(';'))].join('\n')
      );
      writeFileSync(
        join(ZIEL, 'meta.json'),
        JSON.stringify({ stand: Number(leseMeta(db, 'stand')), erstellt: Date.now(), filme: zeilen.length, buendel: serien.length })
      );
      console.log(`AUDIT filme=${zeilen.length} buendel=${serien.length}`);
      expect(zeilen.length).toBeGreaterThan(1000);
      db.close();
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });
});
