import type { Film } from '@shared/film';
import { istGenre, type Format, type GenreId } from '@shared/genres';
import { istGruppe, type SenderGruppe } from '@shared/sender';
import { JAHRGANG_AB, MIN_FOLGEN, serienArt, sortiereFolgen, type Serie, type SerieDetail } from '@shared/serie';
import { baueFtsAbfrage, genresFuer, istReihenThema, SPALTEN, zuFilm, type Db, type FilmZeile } from './datenbank';

/**
 * Bündelt die Folgen je Sender und Thema zu Serien bzw. Sendereihen (Tabelle `serie`).
 * Läuft nach jedem Import im Index-Thread; die Oberfläche fragt die fertigen Bündel nur ab.
 */
export function baueSerien(db: Db): { serien: number; ms: number } {
  const t0 = Date.now();
  db.function('ist_reihe', { deterministic: true }, (thema: unknown) => (typeof thema === 'string' && istReihenThema(thema) ? 1 : 0));
  const lauf = db.transaction(() => {
    db.exec(`
      DELETE FROM serie;
      DELETE FROM serie_genre;
      DELETE FROM serie_fts;
      UPDATE film SET serie_id = NULL WHERE serie_id IS NOT NULL;
    `);
    // Zählen: Folgen ohne Extras/Varianten, Staffeln (ohne Jahrgänge), neueste Folge
    const zeilen = db
      .prepare(
        `SELECT gruppe, thema,
                SUM(extra = 0) AS folgen,
                SUM(extra) AS extras,
                SUM(extra = 0 AND folge IS NOT NULL AND (staffel IS NULL OR staffel < ${JAHRGANG_AB})) AS nummeriert,
                COUNT(DISTINCT CASE WHEN extra = 0 THEN staffel END) AS staffeln,
                MAX(datum) AS neueste,
                AVG(CASE WHEN extra = 0 THEN dauer END) AS dauer
         FROM film WHERE variante = 0 AND ist_reihe(thema) = 1
         GROUP BY gruppe, thema
         HAVING SUM(extra = 0) >= ${MIN_FOLGEN}`
      )
      .all() as { gruppe: string; thema: string; folgen: number; extras: number; nummeriert: number; staffeln: number; neueste: number; dauer: number }[];

    const neu = db.prepare(
      `INSERT INTO serie (gruppe, thema, art, folgen, extras, staffeln, neueste) VALUES (?, ?, 'reihe', ?, ?, ?, ?) RETURNING id`
    );
    const fts = db.prepare('INSERT INTO serie_fts (rowid, thema) VALUES (?, ?)');
    const daten = new Map<number, { nummeriert: number; dauer: number; folgen: number }>();
    for (const z of zeilen) {
      const { id } = neu.get(z.gruppe, z.thema, z.folgen, z.extras, z.staffeln, z.neueste) as { id: number };
      fts.run(id, z.thema);
      daten.set(id, { nummeriert: z.nummeriert, dauer: z.dauer ?? 0, folgen: z.folgen });
    }

    db.exec(`
      UPDATE film SET serie_id = s.id FROM serie s WHERE s.gruppe = film.gruppe AND s.thema = film.thema;
      -- Genres des Bündels: was mindestens ein Drittel der Folgen hat
      INSERT INTO serie_genre (genre, serie_id, neueste)
        SELECT g.genre, s.id, s.neueste FROM serie s
        JOIN film f ON f.serie_id = s.id AND f.variante = 0 AND f.extra = 0
        JOIN film_genre g ON g.film_id = f.id
        GROUP BY s.id, g.genre HAVING COUNT(*) * 3 >= s.folgen;
      -- Kachelbild: neueste Folge
      UPDATE serie SET film_id = (
        SELECT f.id FROM film f WHERE f.gruppe = serie.gruppe AND f.thema = serie.thema AND f.variante = 0 AND f.extra = 0
        ORDER BY f.datum DESC LIMIT 1);
    `);

    // Art (Serie, Sendereihe, Nachrichten) aus Nummerierung, Dauer und Genres
    const genres = new Map<number, GenreId[]>();
    for (const g of db.prepare('SELECT serie_id, genre FROM serie_genre').all() as { serie_id: number; genre: string }[]) {
      if (!istGenre(g.genre)) continue;
      const liste = genres.get(g.serie_id) ?? [];
      liste.push(g.genre);
      genres.set(g.serie_id, liste);
    }
    const art = db.prepare('UPDATE serie SET art = ? WHERE id = ?');
    for (const [id, d] of daten) art.run(serienArt({ ...d, genres: genres.get(id) ?? [] }), id);
    return zeilen.length;
  });
  const serien = lauf();
  return { serien, ms: Date.now() - t0 };
}

interface SerieZeile {
  id: number;
  gruppe: string;
  thema: string;
  art: string;
  folgen: number;
  extras: number;
  staffeln: number;
  neueste: number;
  film_id: number | null;
}

const SERIE_SPALTEN = 's.id, s.gruppe, s.thema, s.art, s.folgen, s.extras, s.staffeln, s.neueste, s.film_id';

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
    art: z.art === 'serie' || z.art === 'nachrichten' ? z.art : 'reihe',
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
    .prepare(`SELECT ${SPALTEN} FROM film f WHERE f.serie_id = ? AND f.variante = 0 ORDER BY f.datum DESC LIMIT 2000`)
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
  const p = { genre, gruppe, limit, offset, nachrichten: genre === 'nachrichten' ? 1 : 0 };
  const istFilm = "EXISTS (SELECT 1 FROM film_genre fg WHERE fg.genre = 'film' AND fg.film_id = f.id)";

  // Bündel: Serien (bei Format „Serien“ nur echte Serien), ohne Nachrichten außerhalb ihres Genres
  const serienTeil = `SELECT 'serie' AS typ, s.id AS id, s.neueste AS datum FROM serie s
      ${genre ? 'JOIN serie_genre sg ON sg.serie_id = s.id AND sg.genre = @genre' : ''}
      WHERE (@gruppe IS NULL OR s.gruppe = @gruppe) AND (s.art != 'nachrichten' OR @nachrichten = 1)
      ${format === 'serie' ? "AND s.art = 'serie'" : ''}`;
  // Einzelne Sendungen: ohne Bündel; bei Format „Filme“ alle Filme, auch aus Reihen wie „Tatort“
  const filmTeil = `SELECT 'film', f.id, f.datum FROM film f
      ${genre ? 'JOIN film_genre g ON g.film_id = f.id AND g.genre = @genre' : ''}
      WHERE f.variante = 0 AND (@gruppe IS NULL OR f.gruppe = @gruppe)
      ${format === 'film' ? `AND ${istFilm}` : 'AND f.serie_id IS NULL'}`;
  const quelle = format === 'serie' ? serienTeil : format === 'film' ? filmTeil : `${serienTeil} UNION ALL ${filmTeil}`;
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
