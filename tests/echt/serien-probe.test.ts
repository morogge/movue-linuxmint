import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';

const UA = 'Movue-CI (+https://github.com/morogge/movue-linuxmint)';

// Einmalige Probe: wie gut lassen sich Serien/Formate aus Sender + Thema bündeln?
it('Serien-Probe', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'movue-probe-'));
  const pfad = join(ordner, 'index.db');
  try {
    const db = oeffneDb(pfad, { schnellaufbau: true });
    await importiere(await oeffneListe(await listenAdresse('voll', UA), UA), db, () => {});
    schliesseAufbau(db);
    const q = (sql: string) => db.prepare(sql).all();
    db.exec(`CREATE TEMP TABLE g AS
      SELECT gruppe, thema, COUNT(*) n, MIN(datum) von, MAX(datum) bis, AVG(dauer) dauer,
        SUM(titel GLOB '*(S[0-9]*/E[0-9]*)*') se,
        SUM(titel LIKE '%Folge %') folge,
        SUM(lower(titel) LIKE lower(thema) || '%') praefix,
        COUNT(DISTINCT titel) titel
      FROM film WHERE variante = 0 GROUP BY gruppe, thema`);
    const gesamt = q(`SELECT COUNT(*) filme FROM film WHERE variante = 0`);
    const buckets = q(`SELECT CASE WHEN n = 1 THEN '1' WHEN n = 2 THEN '2' WHEN n < 5 THEN '3-4' WHEN n < 10 THEN '5-9'
        WHEN n < 30 THEN '10-29' WHEN n < 100 THEN '30-99' WHEN n < 500 THEN '100-499' ELSE '500+' END b,
        COUNT(*) themen, SUM(n) filme FROM g GROUP BY b ORDER BY MIN(n)`);
    const art = q(`SELECT CASE WHEN se > 0 THEN 'staffel-folge' WHEN folge > 0 THEN 'folge-n'
        WHEN dauer < 900 THEN 'kurz' ELSE 'sonst' END art, COUNT(*) themen, SUM(n) filme
        FROM g WHERE n >= 3 GROUP BY art`);
    const proGruppe = q(`SELECT gruppe, COUNT(*) themen, SUM(n >= 3) themen3, SUM(CASE WHEN n >= 3 THEN n END) filme3, SUM(n) filme
        FROM g GROUP BY gruppe`);
    const gruppenUebergreifend = q(`SELECT thema, COUNT(*) gruppen, SUM(n) n FROM g WHERE n >= 3 GROUP BY lower(thema)
        HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 25`);
    const top = q(`SELECT gruppe, thema, n, titel, se, folge, praefix, CAST(dauer / 60 AS INT) min,
        CAST((bis - von) / 86400 AS INT) tage FROM g ORDER BY n DESC LIMIT 60`);
    const serienTop = q(`SELECT gruppe, thema, n, se, CAST(dauer / 60 AS INT) min FROM g WHERE se > 0 ORDER BY n DESC LIMIT 40`);
    const serienGenre = q(`SELECT COUNT(DISTINCT f.gruppe || '|' || f.thema) themen, COUNT(*) filme FROM film f
        JOIN film_genre fg ON fg.film_id = f.id AND fg.genre = 'serie' WHERE f.variante = 0`);
    const beispiele = q(`SELECT gruppe, thema, titel FROM film WHERE titel GLOB '*(S[0-9]*/E[0-9]*)*' ORDER BY random() LIMIT 25`);
    const folgeBeispiele = q(`SELECT gruppe, thema, titel FROM film WHERE titel LIKE '%Folge %' AND titel NOT GLOB '*(S[0-9]*/E[0-9]*)*'
        ORDER BY random() LIMIT 25`);
    const genreIds = q(`SELECT genre, COUNT(*) n FROM film_genre GROUP BY genre ORDER BY n DESC`);
    console.log(
      'SERIEN-PROBE ' +
        JSON.stringify({ gesamt, buckets, art, proGruppe, gruppenUebergreifend, top, serienTop, serienGenre, beispiele, folgeBeispiele, genreIds })
    );
    db.close();
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
