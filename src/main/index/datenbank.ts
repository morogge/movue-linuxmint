import Database from 'better-sqlite3';
import type { Film, Sortierung, SuchAnfrage, SuchErgebnis } from '@shared/film';
import { istGruppe } from '@shared/sender';
import type { FilmEintrag } from '../filmliste/eintrag';

export type Db = Database.Database;

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
  neu INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS film_gruppe_datum ON film(gruppe, datum DESC);
CREATE INDEX IF NOT EXISTS film_datum ON film(datum DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS film_fts USING fts5(
  titel, thema, beschreibung,
  content='film', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
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

export function schreiber(db: Db): (e: FilmEintrag) => void {
  const stmt = db.prepare(`
    INSERT INTO film (url, sender, gruppe, thema, titel, datum, dauer, beschreibung, website,
                      url_klein, url_hd, url_untertitel, geo, neu)
    VALUES (@url, @sender, @gruppe, @thema, @titel, @datum, @dauer, @beschreibung, @website,
            @urlKlein, @urlHd, @urlUntertitel, @geo, @neu)
    ON CONFLICT(url) DO UPDATE SET
      sender = excluded.sender, gruppe = excluded.gruppe, thema = excluded.thema, titel = excluded.titel,
      datum = excluded.datum, dauer = excluded.dauer, beschreibung = excluded.beschreibung,
      website = excluded.website, url_klein = excluded.url_klein, url_hd = excluded.url_hd,
      url_untertitel = excluded.url_untertitel, geo = excluded.geo, neu = excluded.neu
  `);
  return (e) => stmt.run({ ...e, neu: e.neu ? 1 : 0 });
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

function zuFilm(z: FilmZeile): Film {
  return {
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
  const sortierung: Sortierung = anfrage.sortierung ?? 'relevanz';
  const fts = baueFtsAbfrage(anfrage.text);

  if (!fts) {
    // Ohne Suchbegriff: neueste Sendungen
    const where = gruppe ? 'WHERE f.gruppe = @gruppe' : '';
    const treffer = db
      .prepare(`SELECT ${SPALTEN} FROM film f ${where} ORDER BY f.datum DESC LIMIT @limit OFFSET @offset`)
      .all({ gruppe, limit, offset }) as FilmZeile[];
    const gesamt = (db.prepare(`SELECT count(*) AS n FROM film f ${where}`).get({ gruppe }) as { n: number }).n;
    return { treffer: treffer.map(zuFilm), gesamt };
  }

  const filter = gruppe ? 'AND f.gruppe = @gruppe' : '';
  const order = sortierung === 'datum' ? 'f.datum DESC' : 'bm25(film_fts, 10.0, 5.0, 1.0), f.datum DESC';
  const treffer = db
    .prepare(
      `SELECT ${SPALTEN} FROM film_fts JOIN film f ON f.id = film_fts.rowid
       WHERE film_fts MATCH @fts ${filter} ORDER BY ${order} LIMIT @limit OFFSET @offset`
    )
    .all({ fts, gruppe, limit, offset }) as FilmZeile[];
  const gesamt = (
    db
      .prepare(
        `SELECT count(*) AS n FROM film_fts JOIN film f ON f.id = film_fts.rowid WHERE film_fts MATCH @fts ${filter}`
      )
      .get({ fts, gruppe }) as { n: number }
  ).n;
  return { treffer: treffer.map(zuFilm), gesamt };
}
