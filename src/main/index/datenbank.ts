import Database from 'better-sqlite3';
import type { Film, Sortierung, SuchAnfrage, SuchErgebnis } from '@shared/film';
import { GENRES, istFormat, istGenre, type GenreAnzahl, type GenreId } from '@shared/genres';
import { istGruppe, type SenderGruppe } from '@shared/sender';
import type { FilmEintrag } from '../filmliste/eintrag';
import { folgenInfo, serieAusTitel } from '@shared/serie';
import { titelKern } from '@shared/titelinfo';
import { liveGruppe, senderName, sortiereSender, type LiveAngebot, type LiveSender } from '@shared/live';
import { fassungKern, fassungName, istFassung } from '@shared/fassung';

export type Db = Database.Database;

/** Erhöhen, wenn sich Tabellen oder abgeleitete Daten (z. B. Genre-Regeln) ändern – erzwingt einen Neuaufbau. */
export const SCHEMA_VERSION = 8;

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
  -- 1 = andere Fassung (Audiodeskription, Gebärdensprache, Original …), zu der es eine Standardfassung gibt;
  -- in allen Listen ausgeblendet, auf der Seite der Sendung als Auswahl (siehe baueFassungen)
  variante INTEGER NOT NULL DEFAULT 0,
  -- 1 = der Titel kennzeichnet eine besondere Fassung; kern = Titel ohne solche Zusätze
  fassung INTEGER NOT NULL DEFAULT 0,
  kern TEXT NOT NULL DEFAULT '',
  -- aus dem Titel gelesen (shared/serie.ts)
  staffel INTEGER,
  folge INTEGER,
  extra INTEGER NOT NULL DEFAULT 0,
  -- 1 = Livestream (Sender-Stream oder angekündigte Übertragung): nicht in Listen und Bündeln
  live INTEGER NOT NULL DEFAULT 0,
  -- Art der Sendung (Format: serie, film, doku …), beim Bündeln gesetzt
  format TEXT,
  -- Bündel (Serie/Reihe), nach jedem Import neu zugeordnet
  serie_id INTEGER,
  -- Serienname aus dem Titel („Twin Peaks - Staffel 1 (3/8)“) – für Themen, die nur eine Rubrik sind
  reihe_titel TEXT,
  -- Name des Bündels: das Thema, bei Rubriken der Serienname aus dem Titel, sonst leer (Einzelsendung)
  buendel TEXT
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
-- Serien und Sendereihen: je Sender und Thema ein Bündel (siehe serien.ts)
CREATE TABLE IF NOT EXISTS serie (
  id INTEGER PRIMARY KEY,
  gruppe TEXT NOT NULL,
  thema TEXT NOT NULL,
  art TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'doku',
  folgen INTEGER NOT NULL,
  extras INTEGER NOT NULL,
  staffeln INTEGER NOT NULL,
  neueste INTEGER NOT NULL,
  film_id INTEGER,
  UNIQUE (gruppe, thema)
);
CREATE TABLE IF NOT EXISTS serie_genre (
  genre TEXT NOT NULL,
  serie_id INTEGER NOT NULL,
  neueste INTEGER NOT NULL,
  PRIMARY KEY (genre, serie_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS serie_genre_neueste ON serie_genre(genre, neueste DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS serie_fts USING fts5(thema, tokenize='unicode61 remove_diacritics 2');
`;

/** Spalten, die ältere Datenbanken noch nicht haben – bis zum Neuaufbau ergänzt, damit Abfragen laufen */
const NEUE_SPALTEN: [string, string][] = [
  ['staffel', 'INTEGER'],
  ['folge', 'INTEGER'],
  ['extra', 'INTEGER NOT NULL DEFAULT 0'],
  ['live', 'INTEGER NOT NULL DEFAULT 0'],
  ['format', 'TEXT'],
  ['serie_id', 'INTEGER'],
  ['fassung', 'INTEGER NOT NULL DEFAULT 0'],
  ['kern', "TEXT NOT NULL DEFAULT ''"],
  ['reihe_titel', 'TEXT'],
  ['buendel', 'TEXT']
];

function ergaenzeSpalten(db: Database.Database): void {
  const vorhanden = new Set((db.pragma('table_info(film)') as { name: string }[]).map((c) => c.name));
  for (const [name, typ] of NEUE_SPALTEN) if (!vorhanden.has(name)) db.exec(`ALTER TABLE film ADD COLUMN ${name} ${typ}`);
  db.exec('CREATE INDEX IF NOT EXISTS film_serie ON film(serie_id, datum DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS film_fassung ON film(gruppe, thema, kern)');
  db.exec('CREATE INDEX IF NOT EXISTS film_buendel ON film(gruppe, buendel, datum DESC)');
}

const TRIGGER = `
CREATE TRIGGER IF NOT EXISTS film_ai AFTER INSERT ON film BEGIN
  INSERT INTO film_fts(rowid, titel, thema, beschreibung) VALUES (new.id, new.titel, new.thema, new.beschreibung);
END;
CREATE TRIGGER IF NOT EXISTS film_ad AFTER DELETE ON film BEGIN
  INSERT INTO film_fts(film_fts, rowid, titel, thema, beschreibung) VALUES ('delete', old.id, old.titel, old.thema, old.beschreibung);
END;
CREATE TRIGGER IF NOT EXISTS film_au AFTER UPDATE OF titel, thema, beschreibung ON film BEGIN
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
    ergaenzeSpalten(db);
  } else {
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA + TRIGGER);
    ergaenzeSpalten(db);
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
  return VARIANTE.test(titel) || istFassung(titel);
}

/** Livestream statt Video: HLS-Live-Adresse, Thema „Livestream“ oder weder Datum noch Dauer (Sender-Streams) */
export function istLive(e: Pick<FilmEintrag, 'url' | 'thema' | 'datum' | 'dauer'>): boolean {
  return /\/hls\/live\/|\/live\/hls\//i.test(e.url) || e.thema.trim().toLowerCase() === 'livestream' || (e.datum === 0 && e.dauer === 0);
}

/**
 * Bedingung für alles, was in Listen, Suche und auf Genre-Seiten erscheint: nur Standardfassungen, keine Trailer
 * und Extras (die stehen auf der Seite ihrer Sendung), keine Livestreams und nichts mit Datum in der Zukunft.
 */
export function gelistet(jetzt = Date.now(), alias = 'f', mitVorab = false): string {
  const basis = `${alias}.variante = 0 AND ${alias}.extra = 0 AND ${alias}.live = 0`;
  // Vorab: Sendungen, die schon vor ihrem Fernsehtermin online stehen – in der Suche ja, in Listen nicht
  if (mitVorab) return basis;
  // „+“ vor dem Datum: SQLite soll dafür keinen Index nehmen – sonst läuft die Volltextsuche über alle Filme nach Datum
  return `${basis} AND +${alias}.datum <= ${Math.floor(jetzt / 1000)}`;
}

export function schreiber(db: Db): (e: FilmEintrag) => void {
  const stmt = db.prepare(`
    INSERT INTO film (url, sender, gruppe, thema, titel, datum, dauer, beschreibung, website,
                      url_klein, url_hd, url_untertitel, geo, neu, variante, staffel, folge, extra, live, fassung, kern, reihe_titel)
    VALUES (@url, @sender, @gruppe, @thema, @titel, @datum, @dauer, @beschreibung, @website,
            @urlKlein, @urlHd, @urlUntertitel, @geo, @neu, @variante, @staffel, @folge, @extra, @live, @fassung, @kern, @reiheTitel)
    ON CONFLICT(url) DO UPDATE SET
      sender = excluded.sender, gruppe = excluded.gruppe, thema = excluded.thema, titel = excluded.titel,
      datum = excluded.datum, dauer = excluded.dauer, beschreibung = excluded.beschreibung,
      website = excluded.website, url_klein = excluded.url_klein, url_hd = excluded.url_hd,
      url_untertitel = excluded.url_untertitel, geo = excluded.geo, neu = excluded.neu,
      variante = excluded.variante, staffel = excluded.staffel, folge = excluded.folge, extra = excluded.extra, live = excluded.live,
      fassung = excluded.fassung, kern = excluded.kern, reihe_titel = excluded.reihe_titel
    RETURNING id
  `);
  const loescheGenres = db.prepare('DELETE FROM film_genre WHERE film_id = ?');
  const genre = db.prepare('INSERT OR IGNORE INTO film_genre (genre, film_id, datum) VALUES (?, ?, ?)');
  return (e) => {
    const { genres, ...felder } = e;
    const info = folgenInfo(e.titel, e.dauer);
    // Bei Rubrik-Themen (Arte, „Fernsehfilm der Woche“) steht der Serienname im Titel
    const ausTitel = serieAusTitel(e.titel);
    if (ausTitel && info.folge === null) {
      info.folge = ausTitel.folge;
      info.staffel ??= ausTitel.staffel;
    }
    const fassung = istVariante(e.titel) ? 1 : 0;
    const { id } = stmt.get({
      ...felder,
      neu: e.neu ? 1 : 0,
      // vorläufig; baueFassungen blendet nur Fassungen aus, zu denen es eine Standardfassung gibt
      variante: fassung,
      fassung,
      kern: fassungKern(e.titel),
      reiheTitel: ausTitel?.name ?? null,
      staffel: info.staffel,
      folge: info.folge,
      extra: info.extra ? 1 : 0,
      live: istLive(e) ? 1 : 0
    }) as { id: number };
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
export function genresFuer(db: Db, ids: number[]): Map<number, GenreId[]> {
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

export interface FilmZeile {
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
  staffel: number | null;
  folge: number | null;
  extra: number;
  serie_id: number | null;
  buendel: string | null;
  format: string | null;
}

export function zuFilm(z: FilmZeile, genres: Map<number, GenreId[]>): Film {
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
    geo: z.geo,
    staffel: z.staffel,
    folge: z.folge,
    extra: z.extra === 1,
    serieId: z.serie_id,
    buendel: z.buendel || null,
    format: istFormat(z.format) ? z.format : null
  };
}

export const SPALTEN = `f.id, f.sender, f.gruppe, f.thema, f.titel, f.datum, f.dauer, f.beschreibung, f.website,
  f.url, f.url_klein, f.url_hd, f.url_untertitel, f.geo, f.staffel, f.folge, f.extra, f.serie_id, f.buendel, f.format`;

export function suche(db: Db, anfrage: SuchAnfrage): SuchErgebnis {
  const limit = Math.min(Math.max(anfrage.limit ?? 50, 1), 200);
  const offset = Math.max(anfrage.offset ?? 0, 0);
  const gruppe = anfrage.gruppe && istGruppe(anfrage.gruppe) ? anfrage.gruppe : null;
  const genre = anfrage.genre && istGenre(anfrage.genre) ? anfrage.genre : null;
  const sortierung: Sortierung = anfrage.sortierung ?? 'relevanz';
  const fts = baueFtsAbfrage(anfrage.text);
  // Format: nur Sendungen dieser Art (Serie, Film, Doku …)
  const format = istFormat(anfrage.format) ? anfrage.format : null;
  const p = { fts, gruppe, genre, limit, offset, format };
  const formatFilter = format ? 'AND f.format = @format' : '';

  let treffer: FilmZeile[];
  let gesamt: number;
  const sichtbar = gelistet();

  if (!fts && genre) {
    // Neueste im Genre: über den Index (genre, datum)
    const filter = (gruppe ? 'AND f.gruppe = @gruppe ' : '') + formatFilter;
    treffer = db
      .prepare(
        `SELECT ${SPALTEN} FROM film_genre g JOIN film f ON f.id = g.film_id
         WHERE g.genre = @genre AND ${sichtbar} ${filter} ORDER BY g.datum DESC LIMIT @limit OFFSET @offset`
      )
      .all(p) as FilmZeile[];
    gesamt = (
      db
        .prepare(`SELECT count(*) AS n FROM film_genre g JOIN film f ON f.id = g.film_id WHERE g.genre = @genre AND ${sichtbar} ${filter}`)
        .get(p) as { n: number }
    ).n;
  } else if (!fts) {
    // Ohne Suchbegriff: neueste Sendungen
    // Nur Standardfassungen – andere Fassungen stehen auf der Seite der Sendung
    const where = `WHERE ${sichtbar} ` + (gruppe ? 'AND f.gruppe = @gruppe ' : '') + formatFilter;
    treffer = db
      .prepare(`SELECT ${SPALTEN} FROM film f ${where} ORDER BY f.datum DESC LIMIT @limit OFFSET @offset`)
      .all(p) as FilmZeile[];
    gesamt = (db.prepare(`SELECT count(*) AS n FROM film f ${where}`).get(p) as { n: number }).n;
  } else {
    // Mit Suchbegriff auch Vorab-Sendungen: wer „Tatort“ sucht, soll die Folge vom Samstag schon finden
    const filter = [
      `AND ${gelistet(Date.now(), 'f', true)}`,
      formatFilter,
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
    'dokus', 'serien', 'videos', 'sendungen', 'clips', 'br', 'sr', 'ard', 'zdf', '3sat', 'livestream',
    // Rubriken, die die Echtdaten-Probe als Sammelbecken gezeigt hat
    'filme in der ard', 'märchen in der ard', 'kurzfilm', 'kinderfilm', 'unterhaltung', 'unterhaltung & comedy',
    'kabarett & comedy', 'reise', 'reisen', 'tiere', 'natur', 'politik', 'politik und gesellschaft', 'gesellschaft',
    'sport', 'sport allgemein', 'musik', 'kultur', 'wissen', 'geschichte', 'dokumentation', 'doku & reportage',
    'dokus & reportagen im br', 'kultur und pop - kunst', 'serie', 'beitrag']
);

/** Ob ein Thema eine Reihe ist (und sich damit abonnieren lässt) */
export function istReihenThema(thema: string): boolean {
  return thema.trim() !== '' && !SAMMELTHEMEN.has(thema.trim().toLowerCase());
}

/** Weitere Folgen derselben Reihe (gleicher Sender, gleiches Thema), neueste zuerst; ohne Varianten */
export function folgen(db: Db, film: Pick<Film, 'gruppe' | 'thema' | 'buendel'>, limit = 200): Film[] {
  // Einzelsendungen (z. B. Filme einer Rubrik) haben keine weiteren Folgen
  if (!film.buendel) return [];
  const zeilen = db
    .prepare(
      `SELECT ${SPALTEN} FROM film f WHERE f.gruppe = ? AND f.buendel = ? AND f.variante = 0
       ORDER BY f.datum DESC LIMIT ?`
    )
    .all(film.gruppe, film.buendel, limit) as FilmZeile[];
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
             CASE WHEN @genre = 'film' THEN CAST(f.id AS TEXT)
                  ELSE f.gruppe || '|' || COALESCE(f.buendel, 'id' || f.id) END AS schluessel
      FROM film_genre g JOIN film f ON f.id = g.film_id
      WHERE g.genre = @genre AND g.datum >= @seit
        AND f.dauer >= @minDauer AND ${gelistet(jetzt * 1000)} ${filter}
        -- Spielfilme: keine Folgen von Serien und Magazinen, nur Einzelfilme und Filmreihen (Tatort)
        AND (@genre != 'film' OR f.serie_id IS NULL OR EXISTS (SELECT 1 FROM serie s WHERE s.id = f.serie_id AND s.art = 'filmreihe'))
    ), r AS (
      SELECT id, datum, ROW_NUMBER() OVER (PARTITION BY schluessel ORDER BY datum DESC) AS rn FROM k
    )
    SELECT ${SPALTEN} FROM r JOIN film f ON f.id = r.id WHERE r.rn = 1 ORDER BY r.datum DESC LIMIT @mehr`;
  const stmt = db.prepare(sql);
  const p = { genre: anfrage.genre, gruppe, minDauer: anfrage.minDauer ?? 600, mehr: limit * 2 };

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
    .prepare(`SELECT COUNT(*) AS anzahl, COALESCE(SUM(datum > ?), 0) AS neu FROM film f WHERE gruppe = ? AND buendel = ? AND ${gelistet()}`)
    .get(seit, gruppe, thema) as { anzahl: number; neu: number };
  const n = db
    .prepare(`SELECT ${SPALTEN} FROM film f WHERE f.gruppe = ? AND f.buendel = ? AND ${gelistet()} ORDER BY f.datum DESC LIMIT 1`)
    .get(gruppe, thema) as FilmZeile | undefined;
  return { anzahl: z.anzahl, neu: z.neu, neueste: n ? zuFilm(n, genresFuer(db, [n.id])) : null };
}

/**
 * Dieselbe Sendung bei anderen Sendern (z. B. ein Fernsehfilm in der ARD und bei 3sat):
 * gleicher Titel ohne Zusätze, Länge höchstens drei Minuten verschieden. Je Sender die neueste Fassung.
 */
export function auchBei(db: Db, film: Film): Film[] {
  if (film.dauer < 600) return [];
  const kern = titelKern(film.titel);
  if (kern.length < 3) return [];
  const { treffer } = suche(db, { text: kern, limit: 80 });
  const jeSender = new Map<string, Film>();
  for (const f of treffer) {
    if (f.gruppe === film.gruppe || istVariante(f.titel) || Math.abs(f.dauer - film.dauer) > 180) continue;
    if (titelKern(f.titel) !== kern) continue;
    // Gleicher Titel, aber andere Folge (z. B. „Schiffbruch (S03/E02)“ und „Schiffbruch (S01/E21)“)
    if (film.folge !== null && f.folge !== null && (film.folge !== f.folge || film.staffel !== f.staffel)) continue;
    const alt = jeSender.get(f.gruppe);
    if (!alt || f.datum > alt.datum) jeSender.set(f.gruppe, f);
  }
  return [...jeSender.values()];
}

/**
 * Nach jedem Import: Eine besondere Fassung (Audiodeskription, Original …) wird nur ausgeblendet,
 * wenn es dieselbe Sendung auch in der Standardfassung gibt – sonst ist sie selbst der Eintrag im Listing.
 */
export function baueFassungen(db: Db): void {
  db.exec(`
    UPDATE film SET variante = CASE WHEN fassung = 1 AND EXISTS (
        SELECT 1 FROM film s WHERE s.gruppe = film.gruppe AND s.thema = film.thema AND s.kern = film.kern
          AND s.fassung = 0 AND s.staffel IS film.staffel AND s.folge IS film.folge)
      THEN 1 ELSE 0 END
    WHERE fassung = 1 OR variante = 1;
  `);
}

export interface Fassung {
  film: Film;
  /** null = Standardfassung */
  name: string | null;
}

/** Alle Fassungen einer Sendung, Standardfassung zuerst */
export function fassungen(db: Db, film: Film): Fassung[] {
  const zeilen = db
    .prepare(
      `SELECT ${SPALTEN} FROM film f WHERE f.gruppe = ? AND f.thema = ? AND f.kern = ? AND f.staffel IS ? AND f.folge IS ?
       ORDER BY f.fassung, f.datum DESC LIMIT 12`
    )
    .all(film.gruppe, film.thema, fassungKern(film.titel), film.staffel, film.folge) as FilmZeile[];
  const genres = genresFuer(
    db,
    zeilen.map((z) => z.id)
  );
  const gesehen = new Set<string>();
  return zeilen
    .map((z) => {
      const f = zuFilm(z, genres);
      return { film: f, name: fassungName(f.titel) };
    })
    .filter((x) => {
      const k = x.name ?? '';
      if (gesehen.has(k)) return false;
      gesehen.add(k);
      return true;
    });
}

/**
 * „Live & demnächst“: Livestreams der Sender, Live-Übertragungen, die noch laufen oder kommen, und
 * Sendungen, die schon vor ihrem Fernsehtermin abrufbar sind (Datum in der Zukunft).
 */
export function liveAngebot(db: Db, jetzt = Date.now(), vorabLimit = 120): LiveAngebot {
  const s = Math.floor(jetzt / 1000);
  const lade = (sql: string, ...p: unknown[]) => {
    const zeilen = db.prepare(`SELECT ${SPALTEN} FROM film f WHERE ${sql}`).all(...p) as FilmZeile[];
    const genres = genresFuer(
      db,
      zeilen.map((z) => z.id)
    );
    return zeilen.map((z) => zuFilm(z, genres));
  };
  const streams = lade(`f.live = 1 AND f.variante = 0 AND lower(trim(f.thema)) = 'livestream'`);
  const gesehen = new Set<string>();
  const sender: LiveSender[] = [];
  for (const film of streams) {
    const name = senderName(film.titel);
    // Doppelte Einträge (gleicher Sender aus zwei Quellen) nur einmal
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    sender.push({ name, gruppe: liveGruppe(name), film });
  }
  const uebertragungen = lade(
    `f.live = 1 AND f.variante = 0 AND lower(trim(f.thema)) != 'livestream' AND f.dauer > 0 AND f.datum + f.dauer >= ? ORDER BY f.datum LIMIT 100`,
    s
  );
  const vorab = lade(
    `f.live = 0 AND f.variante = 0 AND f.extra = 0 AND f.datum > ? AND f.format IS NOT 'kurz' ORDER BY f.datum LIMIT ?`,
    s,
    vorabLimit
  );
  return { sender: sortiereSender(sender), uebertragungen, vorab };
}

/**
 * Trailer und andere Extras zu einer Sendung: aus ihrem Bündel, sonst mit gleichem Sender und Thema
 * („Trailer: How to Dad“ unter dem Thema „How to Dad“). Neueste zuerst.
 */
export function extrasZu(db: Db, filmId: number, limit = 12): Film[] {
  const f = db.prepare('SELECT id, gruppe, thema, serie_id FROM film WHERE id = ?').get(filmId) as
    | { id: number; gruppe: string; thema: string; serie_id: number | null }
    | undefined;
  if (!f) return [];
  const zeilen = (
    f.serie_id !== null
      ? db
          .prepare(`SELECT ${SPALTEN} FROM film f WHERE f.serie_id = ? AND f.extra = 1 AND f.variante = 0 AND f.live = 0 ORDER BY f.datum DESC LIMIT ?`)
          .all(f.serie_id, limit)
      : db
          .prepare(
            `SELECT ${SPALTEN} FROM film f WHERE f.gruppe = ? AND f.thema = ? AND f.extra = 1 AND f.variante = 0 AND f.live = 0 AND f.id != ?
             ORDER BY f.datum DESC LIMIT ?`
          )
          .all(f.gruppe, f.thema, f.id, limit)
  ) as FilmZeile[];
  const genres = genresFuer(
    db,
    zeilen.map((z) => z.id)
  );
  return zeilen.map((z) => zuFilm(z, genres));
}
