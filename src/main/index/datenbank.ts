import Database from 'better-sqlite3';
import type { Film, Sortierung, SuchAnfrage, SuchErgebnis } from '@shared/film';
import { GENRES, istGenre, type GenreAnzahl, type GenreId } from '@shared/genres';
import { istGruppe, type SenderGruppe } from '@shared/sender';
import type { FilmEintrag } from '../filmliste/eintrag';

export type Db = Database.Database;

/** Erhöhen, wenn sich Tabellen oder abgeleitete Daten (z. B. Genre-Regeln) ändern – erzwingt einen Neuaufbau. */
export const SCHEMA_VERSION = 3;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS film (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  sender TEXT NOT NULL,
  gruppe TEXT NOT NULL,
  thema TEXT NOT NULL,
  titel TEXT NOT NULL,
  datum INTEGER NOT NULL,
  dauer INTEGER NOT NULL,
  beschreibung TEXT NOT NULL,
  website TEXT NOT NULL,
  url_klein TEXT NOT NULL,
  url_hd TEXT NOT NULL,
  url_untertitel TEXT NOT NULL,
  geo TEXT NOT NULL,
  neu INTEGER NOT NULL,
  -- 1 = Fassung mit Audiodeskription, Gebärdensprache o. Ä.; beim Stöbern ausgeblendet
  variante INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS film_thema ON film(gruppe, thema, datum DESC);
CREATE INDEX IF NOT EXISTS film_gruppe_datum ON film(gruppe, datum DESC);
CREATE INDEX IF NOT EXISTS film_datum ON film(datum DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS film_fts USING fts5(
  titel, thema, beschreibung,
  content='film', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Genres je Sendung; datum doppelt gespeichert, damit „neueste im Genre“ über den Index geht
CREATE TABLE IF NOT EXISTS film_genre (
  genre TEXT NOT NULL,
  film_id INTEGER NOT NULL,
  datum INTEGER NOT NULL,
  PRIMARY KEY (genre, film_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS film_genre_datum ON film_genre(genre, datum DESC);
CREATE INDEX IF NOT EXISTS film_genre_film ON film_genre(film_id);
`;

const TRIGGER = `
CREATE TRIGGER IF NOT EXISTS film_ai AFTER INSERT ON film BEGIN
  INSERT INTO film_fts(rowid, titel, thema, beschreibung) VALUES (new.id, new.titel, new.thema, new.beschreibung);
END;
CREATE TRIGGER IF NOT EXISTS film_ad AFTER DELETE ON film BEGIN
  INSERT INTO film_fts(film_fts, rowid, titel, thema, beschreibung) VALUES ('delete', old.id, old.titel, old.thema, old.beschreibung);
END;
CREATE TRIGGER IF NOT EXISTS film_au AFTER UPDATE ON film BEGIN
  INSERT INTO film_fts(film_fts, rowid, titel, thema, beschreibung) VALUES ('delete', old.id, old.titel, old.thema, old.beschreibung);
  INSERT INTO film_fts(rowid, titel, thema, beschreibung) VALUES (new.id, new.titel, new.thema, new.beschreibung);
END;
`;

/**
 * Öffnet eine Index-Datenbank.
 * @param schnellaufbau true beim Neuaufbau in eine frische Datei: ohne Journal und ohne Trigger
 *   (der Volltextindex wird danach in einem Schritt gebaut, siehe schliesseAufbau).
 */
export function oeffneDb(pfad: string, opts: { schnellaufbau?: boolean; nurLesen?: boolean } = {}): Db {
  const db = new Database(pfad, { readonly: !!opts.nurLesen });
  if (opts.nurLesen) return db;
  if (opts.schnellaufbau) {
    db.pragma('journal_mode = OFF');
    db.pragma('synchronous = OFF');
    db.exec(SCHEMA);
  } else {
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA + TRIGGER);
  }
  return db;
}

/** Nach dem Neuaufbau: Volltextindex bauen, Trigger anlegen, aufräumen. */
export function schliesseAufbau(db: Db): void {
  db.exec(`INSERT INTO film_fts(film_fts) VALUES ('rebuild');`);
  db.exec(TRIGGER);
  db.exec(`INSERT INTO film_fts(film_fts) VALUES ('optimize');`);
  db.pragma('journal_mode = WAL');
}

/** Fassungen derselben Sendung, die beim Stöbern nicht doppelt erscheinen sollen */
const VARIANTE = /\((?:[^)]*\b)?(audiodeskription|gebärdensprache|originalversion|originalfassung|klare sprache|hörfassung|mit untertitel)\b[^)]*\)/i;

export function istVariante(titel: string): boolean {
  return VARIANTE.test(titel) || /\s[-–]\s(audiodeskription|gebärdensprache|hörfassung)\s*$/i.test(titel);
}

export function schreiber(db: Db): (e: FilmEintrag) => void {
  const stmt = db.prepare(`
    INSERT INTO film (url, sender, gruppe, thema, titel, datum, dauer, beschreibung, website,
                      url_klein, url_hd, url_untertitel, geo, neu, variante)
    VALUES (@url, @sender, @gruppe, @thema, @titel, @datum, @dauer, @beschreibung, @website,
            @urlKlein, @urlHd, @urlUntertitel, @geo, @neu, @variante)
    ON CONFLICT(url) DO UPDATE SET
      sender = excluded.sender, gruppe = excluded.gruppe, thema = excluded.thema, titel = excluded.titel,
      datum = excluded.datum, dauer = excluded.dauer, beschreibung = excluded.beschreibung,
      website = excluded.website, url_klein = excluded.url_klein, url_hd = excluded.url_hd,
      url_untertitel = excluded.url_untertitel, geo = excluded.geo, neu = excluded.neu,
      variante = excluded.variante
    RETURNING id
  `);
  const loescheGenres = db.prepare('DELETE FROM film_genre WHERE film_id = ?');
  const genre = db.prepare('INSERT OR IGNORE INTO film_genre (genre, film_id, datum) VALUES (?, ?, ?)');
  return (e) => {
    const { genres, ...felder } = e;
    const { id } = stmt.get({ ...felder, neu: e.neu ? 1 : 0, variante: istVariante(e.titel) ? 1 : 0 }) as { id: number };
    loescheGenres.run(id);
    for (const g of genres ?? ['sonstiges']) genre.run(g, id, e.datum);
  };
}

/** Anzahl Sendungen je Genre, in der Reihenfolge von GENRES */
export function genreAnzahlen(db: Db): GenreAnzahl[] {
  const zeilen = db.prepare('SELECT genre, count(*) AS n FROM film_genre GROUP BY genre').all() as {
    genre: string;
    n: number;
  }[];
  const map = new Map(zeilen.map((z) => [z.genre, z.n]));
  return GENRES.map((g) => ({ id: g.id, name: g.name, anzahl: map.get(g.id) ?? 0 }));
}

/** Genres zu einer Liste von Sendungen nachladen */
function genresFuer(db: Db, ids: number[]): Map<number, GenreId[]> {
  const map = new Map<number, GenreId[]>();
  if (ids.length === 0) return map;
  const zeilen = db
    .prepare(`SELECT film_id, genre FROM film_genre WHERE film_id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as { film_id: number; genre: string }[];
  for (const z of zeilen) {
    if (!istGenre(z.genre)) continue;
    const liste = map.get(z.film_id) ?? [];
    liste.push(z.genre);
    map.set(z.film_id, liste);
  }
  return map;
}

export function leseMeta(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function schreibeMeta(db: Db, key: string, value: string | number): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    String(value)
  );
}

export function anzahl(db: Db): number {
  return (db.prepare('SELECT count(*) AS n FROM film').get() as { n: number }).n;
}

/**
 * Baut aus der Eingabe eine FTS5-Abfrage: jedes Wort als Präfix-Suche, alle Wörter müssen vorkommen.
 * Sonderzeichen werden neutralisiert, damit Eingaben wie „ARD-alpha“ oder „"Tatort“ nicht scheitern.
 */
export function baueFtsAbfrage(text: string): string | null {
  const woerter = text
    .normalize('NFC')
    .split(/[\s\p{P}\p{S}]+/u)
    .filter((w) => w.length > 0)
    .slice(0, 12);
  if (woerter.length === 0) return null;
  return woerter.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ');
}

interface FilmZeile {
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
  url_klein: string;
  url_hd: string;
  url_untertitel: string;
  geo: string;
}

function zuFilm(z: FilmZeile, genres: Map<number, GenreId[]>): Film {
  return {
    genres: genres.get(z.id) ?? [],
    id: z.id,
    sender: z.sender,
    gruppe: istGruppe(z.gruppe) ? z.gruppe : 'ARD',
    thema: z.thema,
    titel: z.titel,
    datum: z.datum,
    dauer: z.dauer,
    beschreibung: z.beschreibung,
    website: z.website,
    url: z.url,
    urlKlein: z.url_klein,
    urlHd: z.url_hd,
    urlUntertitel: z.url_untertitel,
    geo: z.geo
  };
}

const SPALTEN = `f.id, f.sender, f.gruppe, f.thema, f.titel, f.datum, f.dauer, f.beschreibung, f.website,
  f.url, f.url_klein, f.url_hd, f.url_untertitel, f.geo`;

export function suche(db: Db, anfrage: SuchAnfrage): SuchErgebnis {
  const limit = Math.min(Math.max(anfrage.limit ?? 50, 1), 200);
  const offset = Math.max(anfrage.offset ?? 0, 0);
  const gruppe = anfrage.gruppe && istGruppe(anfrage.gruppe) ? anfrage.gruppe : null;
  const genre = anfrage.genre && istGenre(anfrage.genre) ? anfrage.genre : null;
  const sortierung: Sortierung = anfrage.sortierung ?? 'relevanz';
  const fts = baueFtsAbfrage(anfrage.text);
  const p = { fts, gruppe, genre, limit, offset };

  let treffer: FilmZeile[];
  let gesamt: number;

  if (!fts && genre) {
    // Neueste im Genre: über den Index (genre, datum)
    const filter = gruppe ? 'AND f.gruppe = @gruppe' : '';
    treffer = db
      .prepare(
        `SELECT ${SPALTEN} FROM film_genre g JOIN film f ON f.id = g.film_id
         WHERE g.genre = @genre ${filter} ORDER BY g.datum DESC LIMIT @limit OFFSET @offset`
      )
      .all(p) as FilmZeile[];
    gesamt = (
      db
        .prepare(`SELECT count(*) AS n FROM film_genre g JOIN film f ON f.id = g.film_id WHERE g.genre = @genre ${filter}`)
        .get(p) as { n: number }
    ).n;
  } else if (!fts) {
    // Ohne Suchbegriff: neueste Sendungen
    const where = gruppe ? 'WHERE f.gruppe = @gruppe' : '';
    treffer = db
      .prepare(`SELECT ${SPALTEN} FROM film f ${where} ORDER BY f.datum DESC LIMIT @limit OFFSET @offset`)
      .all(p) as FilmZeile[];
    gesamt = (db.prepare(`SELECT count(*) AS n FROM film f ${where}`).get(p) as { n: number }).n;
  } else {
    const filter = [
      gruppe ? 'AND f.gruppe = @gruppe' : '',
      genre ? 'AND EXISTS (SELECT 1 FROM film_genre g WHERE g.genre = @genre AND g.film_id = f.id)' : ''
    ].join(' ');
    const order = sortierung === 'datum' ? 'f.datum DESC' : 'bm25(film_fts, 10.0, 5.0, 1.0), f.datum DESC';
    treffer = db
      .prepare(
        `SELECT ${SPALTEN} FROM film_fts JOIN film f ON f.id = film_fts.rowid
         WHERE film_fts MATCH @fts ${filter} ORDER BY ${order} LIMIT @limit OFFSET @offset`
      )
      .all(p) as FilmZeile[];
    gesamt = (
      db
        .prepare(`SELECT count(*) AS n FROM film_fts JOIN film f ON f.id = film_fts.rowid WHERE film_fts MATCH @fts ${filter}`)
        .get(p) as { n: number }
    ).n;
  }

  const genres = genresFuer(
    db,
    treffer.map((t) => t.id)
  );
  return { treffer: treffer.map((t) => zuFilm(t, genres)), gesamt };
}

/** Eine Sendung nach id */
export function filmNachId(db: Db, id: number): Film | null {
  const z = db.prepare(`SELECT ${SPALTEN} FROM film f WHERE f.id = ?`).get(id) as FilmZeile | undefined;
  return z ? zuFilm(z, genresFuer(db, [z.id])) : null;
}

/** Themen, die keine Reihe sind, sondern Sammelrubriken – dort gibt es keine „weiteren Folgen“ */
const SAMMELTHEMEN = new Set(
  ['filme', 'film', 'spielfilm', 'spielfilme', 'fernsehfilm', 'fernsehfilme', 'kino', 'beiträge', 'dokumentationen',
    'dokus', 'serien', 'videos', 'sendungen', 'clips', 'br', 'sr', 'ard', 'zdf', '3sat', 'livestream']
);

/** Ob ein Thema eine Reihe ist (und sich damit abonnieren lässt) */
export function istReihenThema(thema: string): boolean {
  return thema.trim() !== '' && !SAMMELTHEMEN.has(thema.trim().toLowerCase());
}

/** Weitere Folgen derselben Reihe (gleicher Sender, gleiches Thema), neueste zuerst; ohne Varianten */
export function folgen(db: Db, film: Pick<Film, 'gruppe' | 'thema'>, limit = 200): Film[] {
  if (!istReihenThema(film.thema)) return [];
  const zeilen = db
    .prepare(
      `SELECT ${SPALTEN} FROM film f WHERE f.gruppe = ? AND f.thema = ? AND f.variante = 0
       ORDER BY f.datum DESC LIMIT ?`
    )
    .all(film.gruppe, film.thema, limit) as FilmZeile[];
  const genres = genresFuer(
    db,
    zeilen.map((z) => z.id)
  );
  return zeilen.map((z) => zuFilm(z, genres));
}

export interface ReihenAnfrage {
  genre: GenreId;
  gruppe?: SenderGruppe | null;
  limit?: number;
  /** Mindestlänge in Sekunden – blendet kurze Clips aus */
  minDauer?: number;
  jetzt?: number;
}

/** Normalisierter Titel zum Erkennen von Dubletten (ARD und ONE zeigen oft dieselbe Sendung) */
function titelSchluessel(titel: string): string {
  return titel.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Neueste Sendungen eines Genres für eine Reihe auf der Startseite: je Reihe (Thema) nur die neueste Folge,
 * ohne Varianten und kurze Clips. Bei Spielfilmen zählt jeder Film einzeln.
 */
export function reihe(db: Db, anfrage: ReihenAnfrage): Film[] {
  const limit = Math.min(Math.max(anfrage.limit ?? 18, 1), 60);
  const jetzt = Math.floor((anfrage.jetzt ?? Date.now()) / 1000);
  const gruppe = anfrage.gruppe && istGruppe(anfrage.gruppe) ? anfrage.gruppe : null;
  const filter = gruppe ? 'AND f.gruppe = @gruppe' : '';
  const sql = `
    WITH k AS (
      SELECT f.id, g.datum,
             CASE WHEN @genre = 'film' THEN CAST(f.id AS TEXT) ELSE f.gruppe || '|' || f.thema END AS schluessel
      FROM film_genre g JOIN film f ON f.id = g.film_id
      WHERE g.genre = @genre AND g.datum >= @seit AND g.datum <= @bis
        AND f.dauer >= @minDauer AND f.variante = 0 ${filter}
    ), r AS (
      SELECT id, datum, ROW_NUMBER() OVER (PARTITION BY schluessel ORDER BY datum DESC) AS rn FROM k
    )
    SELECT ${SPALTEN} FROM r JOIN film f ON f.id = r.id WHERE r.rn = 1 ORDER BY r.datum DESC LIMIT @mehr`;
  const stmt = db.prepare(sql);
  const p = { genre: anfrage.genre, gruppe, minDauer: anfrage.minDauer ?? 600, bis: jetzt + 86400, mehr: limit * 2 };

  // Erst die letzten zwei Monate; reicht das nicht, ein Jahr zurück
  let zeilen = stmt.all({ ...p, seit: jetzt - 60 * 86400 }) as FilmZeile[];
  if (zeilen.length < limit) zeilen = stmt.all({ ...p, seit: jetzt - 400 * 86400 }) as FilmZeile[];

  const gesehen = new Set<string>();
  const eindeutig = zeilen.filter((z) => {
    const k = titelSchluessel(z.titel);
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });
  const auswahl = eindeutig.slice(0, limit);
  const genres = genresFuer(
    db,
    auswahl.map((z) => z.id)
  );
  return auswahl.map((z) => zuFilm(z, genres));
}

/** Sendungen zu Videoadressen (für „Weiterschauen“ – die Adresse überdauert den Neuaufbau, die id nicht) */
export function filmeNachUrl(db: Db, urls: string[]): Map<string, Film> {
  const map = new Map<string, Film>();
  if (urls.length === 0) return map;
  const zeilen = db
    .prepare(`SELECT ${SPALTEN} FROM film f WHERE f.url IN (${urls.map(() => '?').join(',')})`)
    .all(...urls) as FilmZeile[];
  const genres = genresFuer(
    db,
    zeilen.map((z) => z.id)
  );
  for (const z of zeilen) map.set(z.url, zuFilm(z, genres));
  return map;
}

export interface ReihenStand {
  /** Folgen im Verzeichnis (ohne Varianten) */
  anzahl: number;
  /** Folgen mit Datum nach `seit` */
  neu: number;
  /** Neueste Folge, null wenn die Reihe nicht mehr im Verzeichnis ist */
  neueste: Film | null;
}

/** Stand einer abonnierten Reihe: wie viele Folgen gibt es, wie viele sind neuer als `seit` (Sekunden) */
export function reihenStand(db: Db, gruppe: string, thema: string, seit: number): ReihenStand {
  const z = db
    .prepare(`SELECT COUNT(*) AS anzahl, COALESCE(SUM(datum > ?), 0) AS neu FROM film WHERE gruppe = ? AND thema = ? AND variante = 0`)
    .get(seit, gruppe, thema) as { anzahl: number; neu: number };
  const n = db
    .prepare(`SELECT ${SPALTEN} FROM film f WHERE f.gruppe = ? AND f.thema = ? AND f.variante = 0 ORDER BY f.datum DESC LIMIT 1`)
    .get(gruppe, thema) as FilmZeile | undefined;
  return { anzahl: z.anzahl, neu: z.neu, neueste: n ? zuFilm(n, genresFuer(db, [n.id])) : null };
}
