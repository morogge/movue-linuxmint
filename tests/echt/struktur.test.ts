import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, reihe, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { mitSerien, stoebern } from '../../src/main/index/serien';
import { GRUPPEN } from '../../src/shared/sender';
import type { GenreId } from '../../src/shared/genres';

const UA = 'Movue-CI (+https://github.com/morogge/movue-linuxmint)';
const REIHEN: GenreId[] = ['film', 'krimi', 'doku', 'serie', 'wissen', 'geschichte', 'reise', 'kultur', 'comedy', 'unterhaltung', 'gesellschaft', 'ratgeber', 'kinder', 'sport'];

// Prüft Bündel und Genres an der echten Liste: Bericht für Menschen, dazu ein paar harte Regeln
describe('Struktur der echten Filmliste', () => {
  it('bündelt sinnvoll und ordnet Bündel ihren Genres zu', async () => {
    const ordner = mkdtempSync(join(tmpdir(), 'movue-struktur-'));
    try {
      const db = oeffneDb(join(ordner, 'index.db'), { schnellaufbau: true });
      await importiere(await oeffneListe(await listenAdresse('voll', UA), UA), db);
      schliesseAufbau(db);

      const arten = db.prepare('SELECT gruppe, art, COUNT(*) AS n, SUM(folgen) AS folgen FROM serie GROUP BY gruppe, art').all();
      console.log('STRUKTUR arten ' + JSON.stringify(arten));
      const rubriken = db
        .prepare(`SELECT gruppe, thema, COUNT(*) AS n, COUNT(DISTINCT buendel) AS buendel FROM film WHERE variante = 0 AND (buendel IS NULL OR buendel != thema) GROUP BY gruppe, thema HAVING n >= 20 ORDER BY n DESC LIMIT 60`)
        .all();
      console.log('STRUKTUR rubriken ' + JSON.stringify(rubriken));
      const arte = db.prepare(`SELECT thema, art, folgen, staffeln FROM serie WHERE gruppe = 'Arte' ORDER BY neueste DESC LIMIT 40`).all();
      console.log('STRUKTUR arte-serien ' + JSON.stringify(arte));
      const groesste = db.prepare(`SELECT gruppe, thema, art, folgen FROM serie WHERE art IN ('serie', 'filmreihe') ORDER BY folgen DESC LIMIT 50`).all();
      console.log('STRUKTUR groesste ' + JSON.stringify(groesste));

      for (const g of GRUPPEN) {
        for (const genre of REIHEN) {
          const zeile = mitSerien(db, reihe(db, { genre, gruppe: g.id, limit: 12 }))
            .map((f) => (f.serie ? `[${f.serie.thema} · ${f.serie.art} · ${f.serie.folgen}]` : f.titel.slice(0, 40)))
            .join(' | ');
          console.log(`STRUKTUR reihe ${g.id}/${genre}: ${zeile}`);
        }
        const serien = stoebern(db, { format: 'serie', gruppe: g.id, limit: 25 })
          .eintraege.map((e) => (e.typ === 'serie' ? `${e.serie.thema} (${e.serie.folgen})` : e.film.titel))
          .join(' | ');
        console.log(`STRUKTUR serien ${g.id}: ${serien}`);
      }

      // Harte Regeln aus den Rückmeldungen
      const bundelGenre = (gruppe: string, thema: string) =>
        (db.prepare('SELECT sg.genre FROM serie s JOIN serie_genre sg ON sg.serie_id = s.id WHERE s.gruppe = ? AND s.thema = ?').all(gruppe, thema) as { genre: string }[]).map((x) => x.genre);
      expect(db.prepare(`SELECT COUNT(*) AS n FROM serie WHERE gruppe = 'Arte' AND thema LIKE 'Fernsehfilme%'`).get()).toEqual({ n: 0 });
      expect(bundelGenre('3sat', 'Kulturzeit')).not.toContain('krimi');
      expect(bundelGenre('ARD', 'Sportschau')).not.toContain('kultur');
      const kleinesFernsehspiel = db.prepare(`SELECT art FROM serie WHERE gruppe = 'ZDF' AND thema = 'Das kleine Fernsehspiel'`).get() as { art: string } | undefined;
      console.log('STRUKTUR kleines-fernsehspiel ' + JSON.stringify(kleinesFernsehspiel ?? null));
      expect(kleinesFernsehspiel?.art).not.toBe('serie');
      // Kein Bündel mit Thema als Kulturzeit-Krimi: Folgen eines Magazins tragen die Genres des Magazins
      const kulturzeitKrimi = db
        .prepare(`SELECT COUNT(*) AS n FROM film f JOIN film_genre g ON g.film_id = f.id WHERE f.gruppe = '3sat' AND f.thema = 'Kulturzeit' AND g.genre = 'krimi'`)
        .get() as { n: number };
      expect(kulturzeitKrimi.n).toBe(0);
      db.close();
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });
});
