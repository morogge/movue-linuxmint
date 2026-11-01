import Database from 'better-sqlite3';

/**
 * Daten des Nutzers, die das tägliche Neuladen des Sendungsverzeichnisses überstehen müssen:
 * Abspielposition je Video. Schlüssel ist die Videoadresse, weil sich die interne Nummer einer
 * Sendung beim Neuaufbau des Verzeichnisses ändert.
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
}
