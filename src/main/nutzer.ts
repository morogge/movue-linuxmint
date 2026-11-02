import Database from 'better-sqlite3';
import type { Film } from '@shared/film';
import type { Ablauf } from '@shared/nutzer';

/**
 * Daten des Nutzers, die das tägliche Neuladen des Sendungsverzeichnisses überstehen müssen:
 * Abspielposition, Merkliste, Abos und das Ablaufdatum gemerkter Videos. Schlüssel ist die
 * Videoadresse bzw. Sender + Thema, weil sich die interne Nummer einer Sendung beim Neuaufbau ändert.
 */
export interface Fortschritt {
  url: string;
  position: number;
  dauer: number;
  zeit: number;
}

/** Ab diesem Anteil gilt ein Video als zu Ende gesehen */
export const GESEHEN_AB = 0.95;

export class NutzerDb {
  private db: Database.Database;

  constructor(pfad: string) {
    this.db = new Database(pfad);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fortschritt (
        url TEXT PRIMARY KEY,
        position REAL NOT NULL,
        dauer REAL NOT NULL,
        zeit INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS fortschritt_zeit ON fortschritt(zeit DESC);
      CREATE TABLE IF NOT EXISTS merkliste (
        url TEXT PRIMARY KEY,
        film TEXT NOT NULL,
        zeit INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS abo (
        gruppe TEXT NOT NULL,
        thema TEXT NOT NULL,
        seit INTEGER NOT NULL,
        -- Datum (s) der neuesten Folge beim letzten Besuch bzw. bei der letzten Meldung
        gesehen INTEGER NOT NULL,
        gemeldet INTEGER NOT NULL,
        PRIMARY KEY (gruppe, thema)
      );
      CREATE TABLE IF NOT EXISTS ablauf (
        url TEXT PRIMARY KEY,
        bis INTEGER,
        weg INTEGER NOT NULL,
        geprueft INTEGER NOT NULL
      );
    `);
  }

  schliessen(): void {
    this.db.close();
  }

  setzeFortschritt(url: string, position: number, dauer: number, zeit = Date.now()): void {
    if (!url || !Number.isFinite(position) || !Number.isFinite(dauer) || dauer <= 0) return;
    this.db
      .prepare(
        `INSERT INTO fortschritt (url, position, dauer, zeit) VALUES (?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET position = excluded.position, dauer = excluded.dauer, zeit = excluded.zeit`
      )
      .run(url, Math.max(0, position), dauer, zeit);
  }

  fortschritt(url: string): Fortschritt | null {
    return (this.db.prepare('SELECT url, position, dauer, zeit FROM fortschritt WHERE url = ?').get(url) as Fortschritt) ?? null;
  }

  /** Angefangene, nicht zu Ende gesehene Videos, zuletzt gesehene zuerst */
  angefangen(limit = 30): Fortschritt[] {
    return this.db
      .prepare(
        `SELECT url, position, dauer, zeit FROM fortschritt
         WHERE position >= 30 AND position < dauer * ? ORDER BY zeit DESC LIMIT ?`
      )
      .all(GESEHEN_AB, limit) as Fortschritt[];
  }

  vergessen(url: string): void {
    this.db.prepare('DELETE FROM fortschritt WHERE url = ?').run(url);
  }

  // --- Merkliste ---

  merken(film: Film, zeit = Date.now()): void {
    this.db
      .prepare('INSERT INTO merkliste (url, film, zeit) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET film = excluded.film')
      .run(film.url, JSON.stringify(film), zeit);
  }

  entmerken(url: string): void {
    this.db.prepare('DELETE FROM merkliste WHERE url = ?').run(url);
  }

  istGemerkt(url: string): boolean {
    return this.db.prepare('SELECT 1 FROM merkliste WHERE url = ?').get(url) !== undefined;
  }

  /** Gemerkte Sendungen, zuletzt gemerkte zuerst */
  merkliste(): { film: Film; zeit: number }[] {
    const zeilen = this.db.prepare('SELECT film, zeit FROM merkliste ORDER BY zeit DESC').all() as { film: string; zeit: number }[];
    return zeilen.flatMap((z) => {
      try {
        return [{ film: JSON.parse(z.film) as Film, zeit: z.zeit }];
      } catch {
        return [];
      }
    });
  }

  // --- Abos ---

  abonnieren(gruppe: string, thema: string, neuesteDatum: number, zeit = Date.now()): void {
    this.db
      .prepare('INSERT OR IGNORE INTO abo (gruppe, thema, seit, gesehen, gemeldet) VALUES (?, ?, ?, ?, ?)')
      .run(gruppe, thema, zeit, neuesteDatum, neuesteDatum);
  }

  abbestellen(gruppe: string, thema: string): void {
    this.db.prepare('DELETE FROM abo WHERE gruppe = ? AND thema = ?').run(gruppe, thema);
  }

  abo(gruppe: string, thema: string): { gruppe: string; thema: string; seit: number; gesehen: number; gemeldet: number } | null {
    return (
      (this.db.prepare('SELECT gruppe, thema, seit, gesehen, gemeldet FROM abo WHERE gruppe = ? AND thema = ?').get(gruppe, thema) as
        | { gruppe: string; thema: string; seit: number; gesehen: number; gemeldet: number }
        | undefined) ?? null
    );
  }

  abos(): { gruppe: string; thema: string; seit: number; gesehen: number; gemeldet: number }[] {
    return this.db.prepare('SELECT gruppe, thema, seit, gesehen, gemeldet FROM abo ORDER BY thema COLLATE NOCASE').all() as {
      gruppe: string;
      thema: string;
      seit: number;
      gesehen: number;
      gemeldet: number;
    }[];
  }

  /** Reihe besucht: alles bis `datum` gilt als gesehen (und gemeldet) */
  aboGesehen(gruppe: string, thema: string, datum: number): void {
    this.db
      .prepare('UPDATE abo SET gesehen = MAX(gesehen, ?), gemeldet = MAX(gemeldet, ?) WHERE gruppe = ? AND thema = ?')
      .run(datum, datum, gruppe, thema);
  }

  aboGemeldet(gruppe: string, thema: string, datum: number): void {
    this.db.prepare('UPDATE abo SET gemeldet = MAX(gemeldet, ?) WHERE gruppe = ? AND thema = ?').run(datum, gruppe, thema);
  }

  // --- Ablaufdaten ---

  ablauf(url: string): (Ablauf & { geprueft: number }) | null {
    const z = this.db.prepare('SELECT bis, weg, geprueft FROM ablauf WHERE url = ?').get(url) as
      | { bis: number | null; weg: number; geprueft: number }
      | undefined;
    return z ? { bis: z.bis, weg: z.weg === 1, geprueft: z.geprueft } : null;
  }

  setzeAblauf(url: string, ablauf: Ablauf, geprueft = Date.now()): void {
    this.db
      .prepare(
        `INSERT INTO ablauf (url, bis, weg, geprueft) VALUES (?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET bis = excluded.bis, weg = excluded.weg, geprueft = excluded.geprueft`
      )
      .run(url, ablauf.bis, ablauf.weg ? 1 : 0, geprueft);
  }
}
