import type { Film } from '@shared/film';
import { filmSchluessel, genresAusWikidata, serienSchluessel, type MetaEintrag } from '@shared/metadaten';
import { buendelFormat, istFormat, istGenre, KONZERT, type Format, type GenreId } from '@shared/genres';
import { istGruppe, type SenderGruppe } from '@shared/sender';
import { JAHRGANG_AB, MIN_FOLGEN, serienArt, sortiereFolgen, type Serie, type SerieDetail } from '@shared/serie';
import { baueFtsAbfrage, gelistet, genresFuer, istReihenThema, SPALTEN, zuFilm, type Db, type FilmZeile } from './datenbank';

/** Mindestanteile, ab denen ein Thema als Rubrik gilt (siehe istRubrik) */
const FILM_DAUER = 75 * 60;
/** Kürzer und ohne Reihe: Kurzbeitrag (Clip, Ausschnitt) */
const KURZ_BIS = 5 * 60;

export interface ThemaStatistik {
  gruppe: string;
  thema: string;
  n: number;
  nummeriert: number;
  /** Folgen ab 75 Minuten */
  filme: number;
  /** Folgen unter 10 Minuten (Trailer, Clips) */
  kurz: number;
  /** Titel, die das Thema oder ein Datum nennen („Volle Kanne vom 3. November“) – typisch für Magazine */
  wiederkehrend: number;
  /** Anteil des häufigsten inhaltlichen Genres (ohne Film/Serie/Sonstiges) */
  topGenre: number;
}

/** Sendeplätze und Rubriken nach ihrem Namen: „Dokumentarfilm“, „ZDFinfo Doku“, „Spielfilm-Highlights“, „Filme im Ersten“ … */
const RUBRIK_NAME = /\bdokus?\b|dokumentarfilm|einzeldoku|dokumentation(en)?$|^spielfilm|^fernsehfilm|^filme?\b|highlights|^kino\b|^comedy\b|kabarett\b.*comedy|comedy.*kabarett|^märchen$/i;

/**
 * Rubrik statt Reihe: Unter dem Thema stehen verschiedene Filme oder Serien, keine Folgen eines Formats.
 * - Arte führt als Thema nur Rubriken („Fernsehfilme und Serien - Serien“).
 * - Nummerierte Folgen oder Titel, die das Thema bzw. ein Datum nennen, sprechen für eine Reihe oder ein Magazin.
 * - Sendeplätze mit Rubriken-Namen („Dokumentarfilm“, „Spielfilm-Highlights“).
 * - Überwiegend Filme ohne gemeinsames Genre („Filme im Ersten“, „Das kleine Fernsehspiel“) – anders als
 *   Filmreihen wie „Tatort“, deren Filme alle Krimis sind; ebenso lange Filme gemischt mit vielen Trailern.
 */
export function istRubrik(z: ThemaStatistik): boolean {
  if (z.gruppe === 'Arte') return true;
  if (z.nummeriert >= z.n * 0.2) return false;
  if (z.wiederkehrend >= z.n * 0.3) return false;
  if (RUBRIK_NAME.test(z.thema)) return true;
  if (z.topGenre >= 0.6) return false;
  return z.filme >= z.n * 0.4 || (z.filme >= z.n * 0.2 && z.kurz >= z.n * 0.2);
}

/**
 * Ob ein gemeinsamer Titelanfang eine Reihe ist: ab drei Sendungen. Ein einzelnes Wort („Brasilien: …“,
 * „Israel - …“, „Finale - …“) ist meist nur das Thema einzelner Beiträge – das zählt erst bei sehr vielen
 * Sendungen als Reihe (Arte „Re: …“).
 */
export function istReihenAnfang(anfang: string, anzahl: number): boolean {
  if (anzahl < MIN_FOLGEN) return false;
  const einWort = !/\s/.test(anfang.trim()) && !/\d/.test(anfang);
  return !einWort || anzahl >= 50;
}

/** Gemeinsamer Anfang eines Titels („360° Reportage - Mongolei“ → „360° Reportage“), sonst null */
export function titelAnfang(titel: string, teile = 1): string | null {
  const muster = teile === 1 ? /^(.{2,60}?)(?:\s[-–|]\s|:\s)/ : /^(.{2,60}?(?:\s[-–|]\s|:\s).{2,60}?)(?:\s[-–|]\s|:\s)/;
  const m = muster.exec(titel);
  if (!m) return null;
  const anfang = m[1].trim();
  // Kein Anfang: reine Zahlen, Datumsangaben oder einzelne Buchstaben
  if (!/\p{L}{2}/u.test(anfang) || /^\d+\.?$/.test(anfang)) return null;
  return anfang;
}

/**
 * Bündelt die Folgen zu Serien bzw. Sendereihen (Tabelle `serie`): je Sender und Thema – bei Rubriken je
 * Serienname aus dem Titel. Läuft nach jedem Import im Index-Thread; die Oberfläche fragt die fertigen Bündel nur ab.
 */
/**
 * Genres aus dem Wikidata-Paket (Drama, Komödie, Krimi …): für Filme über ihren Titel, für Serien und Filmreihen über
 * den Namen des Bündels – alle Folgen bekommen sie. Läuft im Aufbau nach dem Bündeln der Namen, vor den Genres der Bündel.
 */
function wikidataGenres(db: Db, eintraege: Record<string, MetaEintrag>): void {
  const neu = db.prepare('INSERT OR IGNORE INTO film_genre (genre, film_id, datum) VALUES (?, ?, ?)');
  const keinKrimi = db.prepare("DELETE FROM film_genre WHERE film_id = ? AND genre = 'krimi'");
  const setze = (id: number, datum: number, genres: GenreId[]) => {
    for (const g of genres) neu.run(g, id, datum);
    if (genres.includes('doku')) keinKrimi.run(id);
  };
  const filme = db
    .prepare(`SELECT f.id, f.titel, f.datum FROM film f JOIN film_genre g ON g.film_id = f.id AND g.genre = 'film' WHERE f.variante = 0`)
    .all() as { id: number; titel: string; datum: number }[];
  for (const f of filme) {
    const e = eintraege[filmSchluessel(f.titel)];
    if (e?.g) setze(f.id, f.datum, genresAusWikidata(e.g));
  }
  const folgen = db.prepare('SELECT id, datum FROM film WHERE gruppe = ? AND buendel = ?');
  for (const b of db.prepare('SELECT DISTINCT gruppe, buendel FROM film WHERE buendel IS NOT NULL').all() as { gruppe: string; buendel: string }[]) {
    const e = eintraege[serienSchluessel(b.buendel)];
    if (!e?.g) continue;
    const genres = genresAusWikidata(e.g);
    if (genres.length === 0) continue;
    for (const f of folgen.all(b.gruppe, b.buendel) as { id: number; datum: number }[]) setze(f.id, f.datum, genres);
  }
}

export function baueSerien(
  db: Db,
  meta?: Record<string, MetaEintrag> | null
): { serien: number; rubriken: number; ms: number; schritte: Record<string, number> } {
  const t0 = Date.now();
  // Dauer je Schritt – für die Messung an der echten Filmliste
  const schritte: Record<string, number> = {};
  let marke = t0;
  const stopp = (name: string) => {
    const jetzt = Date.now();
    schritte[name] = jetzt - marke;
    marke = jetzt;
  };
  const lauf = db.transaction(() => {
    db.exec(`
      DELETE FROM serie;
      DELETE FROM serie_genre;
      DELETE FROM serie_fts;
      -- Indizes auf serie_id und buendel: am Ende in einem Rutsch neu bauen statt bei jeder der
      -- Hunderttausenden Änderungen nachzuführen (spart den größten Teil der Zeit)
      DROP INDEX IF EXISTS film_serie;
      DROP INDEX IF EXISTS film_buendel;
      DROP TABLE IF EXISTS temp.rubrik;
      CREATE TEMP TABLE rubrik (gruppe TEXT NOT NULL, thema TEXT NOT NULL, PRIMARY KEY (gruppe, thema));
      DROP TABLE IF EXISTS temp.reihenthema;
      CREATE TEMP TABLE reihenthema (thema TEXT PRIMARY KEY) WITHOUT ROWID;
    `);
    // Welche Themen Reihen sein können: einmal je Thema prüfen statt einmal je Sendung
    const reihenthema = db.prepare('INSERT INTO temp.reihenthema (thema) VALUES (?)');
    for (const { thema } of db.prepare('SELECT DISTINCT thema FROM film').all() as { thema: string }[]) {
      if (istReihenThema(thema)) reihenthema.run(thema);
    }

    stopp('0 leeren');
    // 1. Rubriken erkennen
    const themen = db
      .prepare(
        `SELECT gruppe, thema, COUNT(*) AS n,
                SUM(extra = 0 AND folge IS NOT NULL AND (staffel IS NULL OR staffel < ${JAHRGANG_AB})) AS nummeriert,
                SUM(extra = 0 AND dauer >= ${FILM_DAUER}) AS filme,
                SUM(dauer < 600) AS kurz,
                SUM(instr(lower(titel), lower(thema)) > 0 OR titel GLOB '*[0-9].[0-9][0-9].[0-9][0-9]*'
                    OR titel GLOB '*[0-9][0-9].[0-9][0-9].*' OR lower(titel) LIKE '% vom %' OR lower(titel) LIKE 'sendung vom%') AS wiederkehrend
         FROM film WHERE variante = 0 AND live = 0 AND thema IN (SELECT thema FROM temp.reihenthema)
         GROUP BY gruppe, thema HAVING COUNT(*) >= ${MIN_FOLGEN}`
      )
      .all() as { gruppe: string; thema: string; n: number; nummeriert: number; filme: number; kurz: number; wiederkehrend: number }[];
    const genreAnteil = db.prepare(
      `SELECT MAX(c) AS top FROM (SELECT COUNT(*) AS c FROM film f JOIN film_genre g ON g.film_id = f.id
       WHERE f.gruppe = ? AND f.thema = ? AND f.variante = 0 AND g.genre NOT IN ('film', 'serie', 'sonstiges') GROUP BY g.genre)`
    );
    const rubrik = db.prepare('INSERT OR IGNORE INTO temp.rubrik (gruppe, thema) VALUES (?, ?)');
    let rubriken = 0;
    for (const z of themen) {
      // Das Genre zählt nur, wo es die Entscheidung treffen kann (kaum Nummern, kein Magazin)
      const kandidat = z.gruppe === 'Arte' || (z.nummeriert < z.n * 0.2 && z.wiederkehrend < z.n * 0.3);
      if (!kandidat) continue;
      const top = z.gruppe === 'Arte' || RUBRIK_NAME.test(z.thema) ? 0 : ((genreAnteil.get(z.gruppe, z.thema) as { top: number | null }).top ?? 0) / z.n;
      if (istRubrik({ ...z, topGenre: top })) {
        rubrik.run(z.gruppe, z.thema);
        rubriken++;
      }
    }
    // Arte: auch kleine Themen sind Rubriken
    db.exec(`INSERT OR IGNORE INTO temp.rubrik (gruppe, thema) SELECT DISTINCT gruppe, thema FROM film WHERE gruppe = 'Arte'`);

    stopp('1 rubriken');
    // 2. Name des Bündels: das Thema – bei Rubriken (und Sammelthemen) der Serienname aus dem Titel
    db.exec(`
      UPDATE film SET serie_id = NULL, buendel = CASE
        WHEN live = 1 THEN NULL
        WHEN thema IN (SELECT thema FROM temp.reihenthema) AND NOT EXISTS (SELECT 1 FROM temp.rubrik r WHERE r.gruppe = film.gruppe AND r.thema = film.thema) THEN thema
        ELSE NULLIF(reihe_titel, '') END;
    `);

    stopp('2 buendel');
    // 2b. Was in Rubriken und Sammelthemen noch einzeln steht, aber denselben Titelanfang hat, ist eine Reihe:
    //     „360° Reportage - Mongolei“, „Re: Quallen-Flut“, „Berlin erleben – Der Ku'damm“ (ab drei Sendungen)
    const einzeln = db
      .prepare(`SELECT id, gruppe, titel FROM film WHERE variante = 0 AND live = 0 AND buendel IS NULL`)
      .all() as { id: number; gruppe: string; titel: string }[];
    const anfaenge = new Map<string, number[]>();
    for (const f of einzeln) {
      const a = titelAnfang(f.titel);
      if (!a || !istReihenThema(a)) continue;
      const k = `${f.gruppe}\u0001${a}`;
      const liste = anfaenge.get(k);
      if (liste) liste.push(f.id);
      else anfaenge.set(k, [f.id]);
    }
    const setze = db.prepare('UPDATE film SET buendel = ? WHERE id = ?');
    const vergeben = new Set<number>();
    for (const [k, ids] of anfaenge) {
      const name = k.slice(k.indexOf('\u0001') + 1);
      if (!istReihenAnfang(name, ids.length)) continue;
      for (const id of ids) {
        setze.run(name, id);
        vergeben.add(id);
      }
    }
    // Zweiter Versuch mit zwei Titelteilen: „Konfliktzone - Globale Krisen kurz erklärt - Sudan“
    const zweiteilig = new Map<string, number[]>();
    for (const f of einzeln) {
      if (vergeben.has(f.id)) continue;
      const a = titelAnfang(f.titel, 2);
      if (!a) continue;
      const k = `${f.gruppe}\u0001${a}`;
      const liste = zweiteilig.get(k);
      if (liste) liste.push(f.id);
      else zweiteilig.set(k, [f.id]);
    }
    for (const [k, ids] of zweiteilig) {
      const name = k.slice(k.indexOf('\u0001') + 1);
      if (!istReihenAnfang(name, ids.length)) continue;
      for (const id of ids) setze.run(name, id);
    }

    stopp('2b titelanfaenge');
    // 2c. Genres aus Wikidata, solange die Bündel-Genres noch nicht gezählt sind
    if (meta) wikidataGenres(db, meta);

    stopp('2c wikidata');
    // 3. Bündel zählen: ab drei Folgen; Serien aus Titeln (Mehrteiler, Arte-Serien) ab zwei
    const zeilen = db
      .prepare(
        `SELECT gruppe, buendel,
                SUM(extra = 0) AS folgen,
                SUM(extra) AS extras,
                SUM(extra = 0 AND folge IS NOT NULL AND (staffel IS NULL OR staffel < ${JAHRGANG_AB})) AS nummeriert,
                SUM(extra = 0 AND dauer >= ${FILM_DAUER}) AS filme,
                COUNT(DISTINCT CASE WHEN extra = 0 THEN staffel END) AS staffeln,
                -- neueste Folge, die schon zu sehen ist (angekündigte Sendungen tragen ein Datum in der Zukunft)
                COALESCE(MAX(CASE WHEN extra = 0 AND datum <= ${Math.floor(Date.now() / 1000)} THEN datum END), MAX(datum)) AS neueste,
                AVG(CASE WHEN extra = 0 THEN dauer END) AS dauer,
                SUM(extra = 0 AND (titel GLOB '*[0-9].[0-9][0-9].[0-9][0-9]*' OR titel GLOB '*[0-9][0-9].[0-9][0-9].*'
                    OR lower(titel) LIKE '% vom %' OR lower(titel) LIKE 'sendung vom%')) AS datiert
         FROM film WHERE variante = 0 AND buendel IS NOT NULL
         GROUP BY gruppe, buendel
         HAVING SUM(extra = 0) >= CASE WHEN MAX(buendel != thema) = 1 THEN 2 ELSE ${MIN_FOLGEN} END`
      )
      .all() as {
      gruppe: string;
      buendel: string;
      folgen: number;
      extras: number;
      nummeriert: number;
      filme: number;
      staffeln: number;
      neueste: number;
      dauer: number;
      datiert: number;
    }[];

    stopp('3 zaehlen');
    const neu = db.prepare(
      `INSERT INTO serie (gruppe, thema, art, folgen, extras, staffeln, neueste) VALUES (?, ?, 'reihe', ?, ?, ?, ?) RETURNING id`
    );
    const fts = db.prepare('INSERT INTO serie_fts (rowid, thema) VALUES (?, ?)');
    const daten = new Map<number, { nummeriert: number; dauer: number; folgen: number; filme: number; thema: string; datiert: number }>();
    for (const z of zeilen) {
      const { id } = neu.get(z.gruppe, z.buendel, z.folgen, z.extras, z.staffeln, z.neueste) as { id: number };
      fts.run(id, z.buendel);
      daten.set(id, { nummeriert: z.nummeriert, dauer: z.dauer ?? 0, folgen: z.folgen, filme: z.filme, thema: z.buendel, datiert: z.datiert });
    }

    stopp('3 einfuegen');
    db.exec(`
      UPDATE film SET serie_id = s.id FROM serie s WHERE s.gruppe = film.gruppe AND s.thema = film.buendel;
      CREATE INDEX IF NOT EXISTS film_serie ON film(serie_id, datum DESC);
      -- Genres des Bündels: was die Mehrheit der Folgen hat – eine Folge mit „ermittelt“ macht keine Krimireihe
      INSERT INTO serie_genre (genre, serie_id, neueste)
        SELECT g.genre, s.id, s.neueste FROM serie s
        JOIN film f ON f.serie_id = s.id AND f.variante = 0 AND f.extra = 0
        JOIN film_genre g ON g.film_id = f.id
        GROUP BY s.id, g.genre HAVING COUNT(*) * 2 > s.folgen;
      -- Ohne Mehrheit: was mindestens ein Drittel hat (gemischte Magazine)
      INSERT INTO serie_genre (genre, serie_id, neueste)
        SELECT g.genre, s.id, s.neueste FROM serie s
        JOIN film f ON f.serie_id = s.id AND f.variante = 0 AND f.extra = 0
        JOIN film_genre g ON g.film_id = f.id
        WHERE s.id NOT IN (SELECT serie_id FROM serie_genre WHERE genre != 'sonstiges')
        GROUP BY s.id, g.genre HAVING COUNT(*) * 3 >= s.folgen AND g.genre != 'sonstiges';
      -- „Weitere Sendungen“ nur, wenn das Bündel sonst nichts hat
      DELETE FROM serie_genre WHERE genre = 'sonstiges'
        AND serie_id IN (SELECT serie_id FROM serie_genre WHERE genre != 'sonstiges');
      -- Kachelbild: neueste Folge
      UPDATE serie SET film_id = (
        SELECT f.id FROM film f WHERE f.serie_id = serie.id AND f.variante = 0 AND f.extra = 0
        ORDER BY f.datum DESC LIMIT 1);
    `);

    stopp('3 genres');
    // 4. Art (Serie, Sendereihe, Filmreihe, Nachrichten) aus Nummerierung, Dauer und Genres
    const genres = new Map<number, GenreId[]>();
    for (const g of db.prepare('SELECT serie_id, genre FROM serie_genre').all() as { serie_id: number; genre: string }[]) {
      if (!istGenre(g.genre)) continue;
      const liste = genres.get(g.serie_id) ?? [];
      liste.push(g.genre);
      genres.set(g.serie_id, liste);
    }
    // … und daraus das Format (Serie, Film, Doku, Magazin …)
    const art = db.prepare('UPDATE serie SET art = ?, format = ? WHERE id = ?');
    for (const [id, d] of daten) {
      const g = genres.get(id) ?? [];
      const a = serienArt({ ...d, genres: g });
      art.run(a, buendelFormat({ art: a, genres: g, thema: d.thema, dauer: d.dauer, datiert: d.folgen ? d.datiert / d.folgen : 0 }), id);
    }

    stopp('4 art');
    // 5. Genres der Folgen an ihr Bündel angleichen: Eine Kulturzeit-Ausgabe über einen Krimi macht das
    //    Magazin nicht zum Krimi, eine Sportschau mit Musik nicht zu Kultur. Nur für Bündel mit echten Genres –
    //    „Weitere Sendungen“ überschreibt nie, was eine Folge selbst hat.
    db.exec(`
      DELETE FROM film_genre WHERE film_id IN (
          SELECT f.id FROM film f WHERE f.serie_id IN (SELECT serie_id FROM serie_genre WHERE genre != 'sonstiges'))
        AND NOT EXISTS (
          SELECT 1 FROM film f JOIN serie_genre sg ON sg.serie_id = f.serie_id WHERE f.id = film_genre.film_id AND sg.genre = film_genre.genre);
      INSERT OR IGNORE INTO film_genre (genre, film_id, datum)
        SELECT sg.genre, f.id, f.datum FROM film f JOIN serie_genre sg ON sg.serie_id = f.serie_id WHERE sg.genre != 'sonstiges';
    `);

    stopp('5 angleichen');
    // 6. Format der Sendungen: Folgen erben es von ihrem Bündel; Einzelsendungen aus Länge und Genres.
    //    Kurzbeiträge (unter 5 Minuten, ohne Reihe) erscheinen nur in Suche und auf Sender-Seiten.
    const hat = (g: string) => `EXISTS (SELECT 1 FROM film_genre fg WHERE fg.film_id = film.id AND fg.genre = '${g}')`;
    db.function('ist_konzert', { deterministic: true }, (text: unknown) => (typeof text === 'string' && KONZERT.test(text) ? 1 : 0));
    db.exec(`
      UPDATE film SET format = (SELECT s.format FROM serie s WHERE s.id = film.serie_id) WHERE serie_id IS NOT NULL;
      UPDATE film SET format = CASE
          WHEN dauer > 0 AND dauer < ${KURZ_BIS} THEN 'kurz'
          WHEN ${hat('nachrichten')} THEN 'nachrichten'
          WHEN ${hat('sport')} THEN 'sport'
          WHEN ${hat('film')} THEN 'film'
          WHEN ${hat('serie')} OR ${hat('krimi')} THEN CASE WHEN dauer >= ${FILM_DAUER} THEN 'film' ELSE 'serie' END
          WHEN ${hat('kultur')} AND ist_konzert(thema || ' ' || titel) = 1 THEN 'konzert'
          WHEN ${hat('comedy')} OR ${hat('unterhaltung')} THEN 'show'
          ELSE 'doku' END
        WHERE serie_id IS NULL;
    `);
    db.exec('CREATE INDEX IF NOT EXISTS film_buendel ON film(gruppe, buendel, datum DESC)');
    stopp('6 format');
    return { serien: zeilen.length, rubriken };
  });
  const { serien, rubriken } = lauf();
  stopp('commit');
  return { serien, rubriken, ms: Date.now() - t0, schritte };
}

interface SerieZeile {
  id: number;
  gruppe: string;
  thema: string;
  art: string;
  format: string;
  folgen: number;
  extras: number;
  staffeln: number;
  neueste: number;
  film_id: number | null;
}

const SERIE_SPALTEN = 's.id, s.gruppe, s.thema, s.art, s.format, s.folgen, s.extras, s.staffeln, s.neueste, s.film_id';

/** Zeilen → Serien, mit Genres und Bild-Folge in je einer Abfrage */
function zuSerien(db: Db, zeilen: SerieZeile[]): Serie[] {
  if (zeilen.length === 0) return [];
  const ids = zeilen.map((z) => z.id);
  const genres = new Map<number, GenreId[]>();
  for (const g of db
    .prepare(`SELECT serie_id, genre FROM serie_genre WHERE serie_id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as { serie_id: number; genre: string }[]) {
    if (!istGenre(g.genre)) continue;
    genres.set(g.serie_id, [...(genres.get(g.serie_id) ?? []), g.genre]);
  }
  const filmIds = zeilen.map((z) => z.film_id).filter((x): x is number => x !== null);
  const filme = new Map<number, Film>();
  if (filmIds.length) {
    const fz = db.prepare(`SELECT ${SPALTEN} FROM film f WHERE f.id IN (${filmIds.map(() => '?').join(',')})`).all(...filmIds) as FilmZeile[];
    const fg = genresFuer(
      db,
      fz.map((z) => z.id)
    );
    for (const z of fz) filme.set(z.id, zuFilm(z, fg));
  }
  return zeilen.map((z) => ({
    id: z.id,
    gruppe: (istGruppe(z.gruppe) ? z.gruppe : 'ARD') as SenderGruppe,
    thema: z.thema,
    art: z.art === 'serie' || z.art === 'nachrichten' || z.art === 'filmreihe' ? z.art : 'reihe',
    format: istFormat(z.format) ? z.format : 'doku',
    folgen: z.folgen,
    extras: z.extras,
    staffeln: z.staffeln,
    neueste: z.neueste,
    genres: genres.get(z.id) ?? [],
    bild: z.film_id !== null ? (filme.get(z.film_id) ?? null) : null
  }));
}

export function serieNachThema(db: Db, gruppe: string, thema: string): Serie | null {
  const z = db.prepare(`SELECT ${SERIE_SPALTEN} FROM serie s WHERE s.gruppe = ? AND s.thema = ?`).get(gruppe, thema) as SerieZeile | undefined;
  return z ? zuSerien(db, [z])[0] : null;
}

export function serienNachId(db: Db, ids: number[]): Map<number, Serie> {
  const map = new Map<number, Serie>();
  const eindeutig = [...new Set(ids)];
  if (eindeutig.length === 0) return map;
  const zeilen = db
    .prepare(`SELECT ${SERIE_SPALTEN} FROM serie s WHERE s.id IN (${eindeutig.map(() => '?').join(',')})`)
    .all(...eindeutig) as SerieZeile[];
  for (const s of zuSerien(db, zeilen)) map.set(s.id, s);
  return map;
}

/** Hängt an Folgen, die zu einem Bündel gehören, das Bündel an (für Serienkacheln) */
export function mitSerien(db: Db, filme: Film[]): Film[] {
  const serien = serienNachId(
    db,
    filme.map((f) => f.serieId).filter((x): x is number => x !== null)
  );
  return filme.map((f) => (f.serieId !== null && serien.has(f.serieId) ? { ...f, serie: serien.get(f.serieId)! } : f));
}

/** Eine Serie mit allen Folgen (ohne Varianten), sortiert für die Serienseite */
export function serieDetail(db: Db, gruppe: string, thema: string): SerieDetail | null {
  const serie = serieNachThema(db, gruppe, thema);
  if (!serie) return null;
  const zeilen = db
    .prepare(`SELECT ${SPALTEN} FROM film f WHERE f.serie_id = ? AND f.variante = 0 AND f.live = 0 ORDER BY f.datum DESC LIMIT 2000`)
    .all(serie.id) as FilmZeile[];
  const genres = genresFuer(
    db,
    zeilen.map((z) => z.id)
  );
  // Doppelte Folgen (gleicher Titel, z. B. Wiederholung): nur die neueste
  const gesehen = new Set<string>();
  const filme = zeilen
    .map((z) => zuFilm(z, genres))
    .filter((f) => {
      const k = f.titel.trim().toLowerCase();
      if (gesehen.has(k)) return false;
      gesehen.add(k);
      return true;
    });
  return { serie, folgen: sortiereFolgen(filme, serie.art) };
}

export type StoebernEintrag = { typ: 'serie'; serie: Serie; datum: number } | { typ: 'film'; film: Film; datum: number };

/**
 * Genre-Seite mit Bündeln: Serien und Sendereihen als je ein Eintrag, Einzelsendungen dazwischen,
 * nach der neuesten Folge sortiert. Nachrichten-Bündel erscheinen nur im Genre Nachrichten.
 */
export function stoebern(
  db: Db,
  a: { genre?: GenreId | null; format?: Format | null; gruppe?: SenderGruppe | null; limit?: number; offset?: number }
): { eintraege: StoebernEintrag[]; gesamt: number } {
  const limit = Math.min(Math.max(a.limit ?? 60, 1), 200);
  const offset = Math.max(a.offset ?? 0, 0);
  const gruppe = a.gruppe && istGruppe(a.gruppe) ? a.gruppe : null;
  const genre = a.genre ?? null;
  const format = a.format ?? null;
  const nachrichten = genre === 'nachrichten' || format === 'nachrichten' ? 1 : 0;
  const p = { genre, gruppe, limit, offset, nachrichten, format };

  // Bündel: Serien und Sendereihen der gewählten Art, ohne Nachrichten außerhalb ihrer Seiten
  const serienTeil = `SELECT 'serie' AS typ, s.id AS id, s.neueste AS datum FROM serie s
      ${genre ? 'JOIN serie_genre sg ON sg.serie_id = s.id AND sg.genre = @genre' : ''}
      WHERE (@gruppe IS NULL OR s.gruppe = @gruppe) AND (s.art != 'nachrichten' OR @nachrichten = 1)
      ${format ? 'AND s.format = @format' : ''}`;
  // Einzelne Sendungen: ohne Bündel; bei Filmen alle Filme, auch aus Reihen wie „Tatort“.
  // Kurzbeiträge nur auf der Seite eines Senders oder wenn ausdrücklich gewählt
  const filmTeil = `SELECT 'film' AS typ, f.id AS id, f.datum AS datum FROM film f
      ${genre ? 'JOIN film_genre g ON g.film_id = f.id AND g.genre = @genre' : ''}
      WHERE ${gelistet()} AND (@gruppe IS NULL OR f.gruppe = @gruppe)
      ${format ? 'AND f.format = @format' : ''}
      ${format === 'film' ? '' : 'AND f.serie_id IS NULL'}
      ${format === 'kurz' || gruppe ? '' : "AND f.format != 'kurz'"}`;
  const quelle = format === 'film' ? filmTeil : format === 'kurz' ? filmTeil : `${serienTeil} UNION ALL ${filmTeil}`;
  const gesamt = (db.prepare(`SELECT COUNT(*) AS n FROM (${quelle})`).get(p) as { n: number }).n;
  const zeilen = db.prepare(`${quelle} ORDER BY datum DESC LIMIT @limit OFFSET @offset`).all(p) as { typ: string; id: number; datum: number }[];

  const serien = serienNachId(
    db,
    zeilen.filter((z) => z.typ === 'serie').map((z) => z.id)
  );
  const filmIds = zeilen.filter((z) => z.typ === 'film').map((z) => z.id);
  const filme = new Map<number, Film>();
  if (filmIds.length) {
    const fz = db.prepare(`SELECT ${SPALTEN} FROM film f WHERE f.id IN (${filmIds.map(() => '?').join(',')})`).all(...filmIds) as FilmZeile[];
    const fg = genresFuer(
      db,
      fz.map((z) => z.id)
    );
    for (const z of fz) filme.set(z.id, zuFilm(z, fg));
  }
  const eintraege = zeilen.flatMap((z): StoebernEintrag[] => {
    if (z.typ === 'serie') {
      const s = serien.get(z.id);
      return s ? [{ typ: 'serie', serie: s, datum: z.datum }] : [];
    }
    const f = filme.get(z.id);
    return f ? [{ typ: 'film', film: f, datum: z.datum }] : [];
  });
  return { eintraege, gesamt };
}

/**
 * Wie viele Einträge jede Art beim Stöbern hat (wie in `stoebern` gezählt): Bündel als einer,
 * Filme immer einzeln. Für die Kacheln unter „Alle Kategorien“ und die Reiter einer Genre-Seite.
 */
export function artAnzahlen(db: Db, a: { genre?: GenreId | null; gruppe?: SenderGruppe | null } = {}): Partial<Record<Format, number>> {
  const gruppe = a.gruppe && istGruppe(a.gruppe) ? a.gruppe : null;
  const genre = a.genre ?? null;
  const p = { genre, gruppe };
  const ergebnis: Partial<Record<Format, number>> = {};
  const dazu = (zeilen: { format: string | null; n: number }[]) => {
    for (const z of zeilen) if (istFormat(z.format)) ergebnis[z.format] = (ergebnis[z.format] ?? 0) + z.n;
  };
  dazu(
    db
      .prepare(
        `SELECT s.format AS format, COUNT(*) AS n FROM serie s
         ${genre ? 'JOIN serie_genre sg ON sg.serie_id = s.id AND sg.genre = @genre' : ''}
         WHERE (@gruppe IS NULL OR s.gruppe = @gruppe) AND s.format != 'film' GROUP BY s.format`
      )
      .all(p) as { format: string | null; n: number }[]
  );
  dazu(
    db
      .prepare(
        `SELECT f.format AS format, COUNT(*) AS n FROM film f
         ${genre ? 'JOIN film_genre g ON g.film_id = f.id AND g.genre = @genre' : ''}
         WHERE ${gelistet()} AND (@gruppe IS NULL OR f.gruppe = @gruppe) AND (f.serie_id IS NULL OR f.format = 'film')
         GROUP BY f.format`
      )
      .all(p) as { format: string | null; n: number }[]
  );
  return ergebnis;
}

/** Serien, deren Name zur Suche passt – für die Reihe „Serien“ über den Suchtreffern */
export function serienSuche(db: Db, text: string, gruppe?: SenderGruppe | null, limit = 8): Serie[] {
  const abfrage = baueFtsAbfrage(text);
  if (!abfrage) return [];
  const g = gruppe && istGruppe(gruppe) ? gruppe : null;
  const zeilen = db
    .prepare(
      `SELECT ${SERIE_SPALTEN} FROM serie_fts JOIN serie s ON s.id = serie_fts.rowid
       WHERE serie_fts MATCH ? AND (? IS NULL OR s.gruppe = ?)
       ORDER BY bm25(serie_fts), s.neueste DESC LIMIT ?`
    )
    .all(abfrage, g, g, limit) as SerieZeile[];
  return zuSerien(db, zeilen);
}
