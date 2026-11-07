import { dirname, join } from 'node:path';
import { existsSync, renameSync, rmSync } from 'node:fs';
import type { IndexZustand, SuchAnfrage, SuchErgebnis } from '@shared/film';
import type { ListenArt } from '../filmliste/quelle';
import {
  anzahl,
  filmNachId,
  filmeNachUrl,
  folgen,
  auchBei,
  fassungen,
  type Fassung,
  genreAnzahlen,
  leseMeta,
  oeffneDb,
  reihe,
  reihenStand,
  istReihenThema,
  SCHEMA_VERSION,
  type ReihenStand,
  suche,
  type Db,
  type ReihenAnfrage
} from './datenbank';
import type { Film } from '@shared/film';
import type { GenreAnzahl } from '@shared/genres';
import type { IndexerAuftrag, IndexerNachricht } from './indexer.worker';
import { naechsteAktion } from './plan';
import createIndexer from './indexer.worker?nodeWorker';
import { mitSerien, serieDetail, serienSuche, stoebern, type StoebernEintrag } from './serien';
import type { SerieDetail, Serie } from '@shared/serie';
import type { Format, GenreId } from '@shared/genres';
import type { SenderGruppe } from '@shared/sender';

const PRUEF_INTERVALL = 10 * 60 * 1000;

/**
 * Verwaltet den Sendungs-Index: hält eine Lese-Verbindung für die Suche,
 * startet bei Bedarf den Import im Hintergrund und meldet Zustandsänderungen.
 */
export class IndexDienst {
  private db: Db | null = null;
  private laeuft = false;
  private timer: NodeJS.Timeout | null = null;
  private zustand: IndexZustand = { phase: 'leer', anzahl: 0, stand: null };
  private genreCache: GenreAnzahl[] | null = null;

  constructor(
    private readonly dbPfad: string,
    private readonly userAgent: string,
    private readonly melde: (z: IndexZustand) => void
  ) {}

  start(): void {
    this.oeffne();
    void this.pruefe();
    this.timer = setInterval(() => void this.pruefe(), PRUEF_INTERVALL);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.db?.close();
    this.db = null;
  }

  aktuellerZustand(): IndexZustand {
    return this.zustand;
  }

  /** Anzahl je Genre – nach jedem Laden einmal berechnet */
  genres(): GenreAnzahl[] {
    if (!this.db) return [];
    this.genreCache ??= genreAnzahlen(this.db);
    return this.genreCache;
  }

  /** Neueste Sendungen eines Genres; Folgen einer Serie tragen ihr Bündel mit. Nachrichten nur im Genre Nachrichten. */
  reihe(anfrage: ReihenAnfrage): Film[] {
    if (!this.db) return [];
    const roh = reihe(this.db, anfrage);
    // Spielfilme stehen immer einzeln, auch wenn sie in einer Rubrik wie „Filme im Ersten“ laufen
    if (anfrage.genre === 'film') return roh;
    const gesehen = new Set<number>();
    return mitSerien(this.db, roh).filter((f) => {
      if (f.serie?.art === 'nachrichten' && anfrage.genre !== 'nachrichten') return false;
      // Jede Serie nur einmal je Reihe
      if (f.serieId === null) return true;
      if (gesehen.has(f.serieId)) return false;
      gesehen.add(f.serieId);
      return true;
    });
  }

  serie(gruppe: string, thema: string): SerieDetail | null {
    return this.db ? serieDetail(this.db, gruppe, thema) : null;
  }

  stoebern(a: { genre?: GenreId | null; format?: Format | null; gruppe?: SenderGruppe | null; limit?: number; offset?: number }): {
    eintraege: StoebernEintrag[];
    gesamt: number;
  } {
    return this.db ? stoebern(this.db, a) : { eintraege: [], gesamt: 0 };
  }

  serienSuche(text: string, gruppe?: SenderGruppe | null): Serie[] {
    return this.db ? serienSuche(this.db, text, gruppe) : [];
  }

  film(id: number): Film | null {
    return this.db ? filmNachId(this.db, id) : null;
  }

  filmeNachUrl(urls: string[]): Map<string, Film> {
    return this.db ? filmeNachUrl(this.db, urls) : new Map();
  }

  istReihe(thema: string): boolean {
    return istReihenThema(thema);
  }

  reihenStand(gruppe: string, thema: string, seit: number): ReihenStand | null {
    return this.db ? reihenStand(this.db, gruppe, thema, seit) : null;
  }

  /** Fassungen derselben Sendung (Audiodeskription, Original …), Standardfassung zuerst */
  fassungen(id: number): Fassung[] {
    if (!this.db) return [];
    const f = filmNachId(this.db, id);
    return f ? fassungen(this.db, f) : [];
  }

  /** Dieselbe Sendung bei anderen Sendern */
  auchBei(id: number): Film[] {
    if (!this.db) return [];
    const f = filmNachId(this.db, id);
    return f ? auchBei(this.db, f) : [];
  }

  folgen(id: number): Film[] {
    if (!this.db) return [];
    const f = filmNachId(this.db, id);
    return f ? folgen(this.db, f) : [];
  }

  suche(anfrage: SuchAnfrage): SuchErgebnis {
    if (!this.db) return { treffer: [], gesamt: 0 };
    return suche(this.db, anfrage);
  }

  private setze(z: Partial<IndexZustand>): void {
    this.zustand = { ...this.zustand, ...z };
    this.melde(this.zustand);
  }

  private oeffne(): void {
    this.genreCache = null;
    this.db?.close();
    this.db = null;
    if (!existsSync(this.dbPfad)) {
      this.setze({ phase: 'leer', anzahl: 0, stand: null });
      return;
    }
    try {
      this.db = oeffneDb(this.dbPfad);
      const stand = Number(leseMeta(this.db, 'stand')) || null;
      this.setze({ phase: 'bereit', anzahl: anzahl(this.db), stand, meldung: undefined, fortschritt: undefined });
    } catch {
      // Beschädigte Datei: verwerfen, der nächste Lauf baut neu auf
      this.db = null;
      rmSync(this.dbPfad, { force: true });
      this.setze({ phase: 'leer', anzahl: 0, stand: null });
    }
  }

  private async pruefe(): Promise<void> {
    if (this.laeuft) return;
    const meta = (key: string) => (this.db ? Number(leseMeta(this.db, key)) || null : null);
    const art = naechsteAktion(
      {
        vorhanden: this.db !== null,
        schemaAktuell: meta('schema') === SCHEMA_VERSION,
        vollGeladen: meta('vollGeladen'),
        diffGeladen: meta('diffGeladen')
      },
      Date.now()
    );
    if (art) await this.lade(art);
  }

  private async lade(art: ListenArt): Promise<void> {
    this.laeuft = true;
    const ziel = art === 'voll' ? `${this.dbPfad}.neu` : this.dbPfad;
    if (art === 'voll') rmSync(ziel, { force: true });
    // Mit vorhandenem Index bleibt die Suche „bereit“; der Fortschritt zeigt die Aktualisierung an
    this.setze({ phase: this.db ? 'bereit' : 'laedt', fortschritt: 0, meldung: undefined });

    try {
      // Das Wikidata-Paket liegt neben dem Verzeichnis (siehe MetadatenDienst)
      const ergebnis = await this.imWorker({ art, dbPfad: ziel, userAgent: this.userAgent, metaPfad: join(dirname(this.dbPfad), 'metadaten.json') });
      if (art === 'voll') {
        this.db?.close();
        this.db = null;
        renameSync(ziel, this.dbPfad);
        rmSync(`${this.dbPfad}-wal`, { force: true });
        rmSync(`${this.dbPfad}-shm`, { force: true });
      }
      this.oeffne();
      if (ergebnis.stand) this.setze({ stand: ergebnis.stand });
    } catch (err) {
      if (art === 'voll') rmSync(ziel, { force: true });
      const meldung = err instanceof Error ? err.message : String(err);
      this.setze({ phase: this.db ? 'bereit' : 'fehler', fortschritt: undefined, meldung });
    } finally {
      this.laeuft = false;
    }
  }

  private imWorker(auftrag: IndexerAuftrag): Promise<{ anzahl: number; stand: number | null }> {
    return new Promise((resolve, reject) => {
      const worker = createIndexer({ workerData: auftrag });
      let fertig = false;
      worker.on('message', (n: IndexerNachricht) => {
        if (n.typ === 'fortschritt') {
          this.setze({ fortschritt: n.verarbeitet });
        } else if (n.typ === 'fertig') {
          fertig = true;
          resolve({ anzahl: n.anzahl, stand: n.stand });
        } else {
          fertig = true;
          reject(new Error(n.meldung));
        }
      });
      worker.on('error', (err) => {
        fertig = true;
        reject(err);
      });
      worker.on('exit', (code) => {
        if (!fertig) reject(new Error(`Der Index-Dienst wurde unerwartet beendet (Code ${code}).`));
      });
    });
  }
}
